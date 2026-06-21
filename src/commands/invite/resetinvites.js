const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const MemberInvite = require('../../database/models/MemberInvite');
const { success, error, info } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');

module.exports = {
  name: 'resetinvites',
  description: 'Resets invite counts for a user or the entire server.',
  slashData: new SlashCommandBuilder()
    .setName('resetinvites')
    .setDescription('Resets invite counts for a user or the entire server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(opt => opt.setName('user').setDescription('The user to reset invites for').setRequired(false))
    .addBooleanOption(opt => opt.setName('all').setDescription('Reset invites for everyone in this server?').setRequired(false)),

  async executePrefix(message, args, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply({ embeds: [error('You must be an Administrator to use this command.')] });
    }

    const targetUser = message.mentions.users.first() || client.users.cache.get(args[0]);
    const isAll = args[0]?.toLowerCase() === 'all';

    if (!targetUser && !isAll) {
      return message.reply({ embeds: [error('Please mention a user to reset or type `-i resetinvites all` to reset everyone.')] });
    }

    await handleReset(message, targetUser, isAll, false);
  },

  async executeSlash(interaction, client) {
    const targetUser = interaction.options.getUser('user');
    const isAll = interaction.options.getBoolean('all');

    if (!targetUser && !isAll) {
      return interaction.reply({ embeds: [error('You must specify either a user to reset or set the "all" option to true.')], ephemeral: true });
    }

    await handleReset(interaction, targetUser, isAll, true);
  }
};

async function handleReset(context, targetUser, isAll, isInteraction) {
  const guild = context.guild;
  const author = isInteraction ? context.user : context.author;

  try {
    // Case 1: Reset All Invites
    if (isAll) {
      const confirmEmbed = info(
        `⚠️ **WARNING:** You are about to reset **ALL** invite counts in this server. This action is irreversible.\n` +
        `Are you sure you want to proceed?`,
        `Reset All Invites`
      );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('confirm_reset_all').setLabel('Confirm Reset All').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('cancel_reset_all').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
      );

      const msg = isInteraction
        ? await context.reply({ embeds: [confirmEmbed], components: [row], fetchReply: true })
        : await context.reply({ embeds: [confirmEmbed], components: [row] });

      const collector = msg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 30000
      });

      collector.on('collect', async (click) => {
        if (click.user.id !== author.id) {
          return click.reply({ embeds: [error('Only the administrator who triggered the command can confirm.')], ephemeral: true });
        }

        if (click.customId === 'confirm_reset_all') {
          // Delete all invite stats for this guild
          await MemberInvite.deleteMany({ guildId: guild.id });

          await click.update({
            embeds: [success('Successfully reset all invite statistics in the server.')],
            components: []
          });

          logger.logToGuild(guild, 'Invites Reset', `⚠️ **All invite stats** have been reset by ${author}`);
        } else {
          await click.update({
            embeds: [info('Reset operation cancelled.')],
            components: []
          });
        }
        collector.stop();
      });

      collector.on('end', (collected, reason) => {
        if (reason === 'time') {
          msg.edit({
            embeds: [error('Reset operation timed out.')],
            components: []
          }).catch(() => null);
        }
      });

      return;
    }

    // Case 2: Reset Single User Invites
    if (targetUser) {
      await MemberInvite.findOneAndUpdate(
        { guildId: guild.id, userId: targetUser.id },
        { $set: { total: 0, fake: 0, left: 0, rejoined: 0, bonus: 0 } },
        { upsert: true }
      );

      const replyEmbed = success(`Successfully reset invite counts for ${targetUser} (${targetUser.tag}).`);
      
      if (isInteraction) {
        await context.reply({ embeds: [replyEmbed] });
      } else {
        await context.reply({ embeds: [replyEmbed] });
      }

      logger.logToGuild(guild, 'User Invite Reset', `🔄 Invite stats for ${targetUser} have been reset by ${author}`);
    }

  } catch (err) {
    console.error('Error resetting invites:', err);
    if (typeof context.reply === 'function') {
      await context.reply({ embeds: [error('Failed to reset invite statistics.')], ephemeral: true }).catch(() => null);
    }
  }
}
