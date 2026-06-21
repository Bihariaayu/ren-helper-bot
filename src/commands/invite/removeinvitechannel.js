const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const GuildConfig = require('../../database/models/GuildConfig');
const { success, error } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');

module.exports = {
  name: 'removeinvitechannel',
  description: 'Removes the invite tracking channel setting.',
  slashData: new SlashCommandBuilder()
    .setName('removeinvitechannel')
    .setDescription('Removes the invite tracking channel setting.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async executePrefix(message, args, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply({ embeds: [error('You must be an Administrator to use this command.')] });
    }
    await removeInviteChannel(message);
  },

  async executeSlash(interaction, client) {
    await removeInviteChannel(interaction);
  }
};

async function removeInviteChannel(context) {
  try {
    const guild = context.guild;
    const author = context.user || context.author;

    await GuildConfig.findOneAndUpdate(
      { guildId: guild.id },
      { $set: { inviteChannelId: null } },
      { upsert: true }
    );

    const replyEmbed = success(`Invite tracking channel has been removed.`);
    
    if (context.deferred || context.replied) {
      await context.followUp({ embeds: [replyEmbed] });
    } else {
      await context.reply({ embeds: [replyEmbed] });
    }

    logger.logToGuild(guild, 'Settings Updated', `Invite tracking channel removed by ${author}`);
  } catch (err) {
    console.error('Error removing invite channel:', err);
    if (typeof context.reply === 'function') {
      await context.reply({ embeds: [error('Failed to remove invite tracking channel.')], ephemeral: true }).catch(() => null);
    }
  }
}
