const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { success, error } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');

module.exports = {
  name: 'lock',
  description: 'Locks the current channel preventing members from sending messages.',
  slashData: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Locks the current channel.')
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for locking').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async executePrefix(message, args, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return message.reply({ embeds: [error('You do not have permission to manage channels.')] });
    }

    const reason = args.join(' ') || 'No reason provided';
    await runLock(message, reason, false);
  },

  async executeSlash(interaction, client) {
    const reason = interaction.options.getString('reason') || 'No reason provided';
    await runLock(interaction, reason, true);
  }
};

async function runLock(context, reason, isInteraction) {
  const channel = context.channel;
  const guild = context.guild;
  const author = isInteraction ? context.user : context.author;

  try {
    // Check bot permission
    if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return context.reply({ embeds: [error('I do not have permission to manage channel permissions.')], ephemeral: isInteraction });
    }

    // Deny SendMessages permission override for @everyone role
    await channel.permissionOverwrites.edit(guild.roles.everyone, {
      SendMessages: false
    }, { reason: `Locked by ${author.tag}: ${reason}` });

    const replyEmbed = success(`🔒 This channel has been locked.\n**Reason:** ${reason}`);
    await context.reply({ embeds: [replyEmbed] });

    // Log to log channel
    logger.logToGuild(
      guild, 
      'Channel Locked', 
      `🔒 **Channel:** ${channel} (${channel.name})\n👮 **Moderator:** ${author}\n📝 **Reason:** ${reason}`
    );

  } catch (err) {
    console.error('Error locking channel:', err);
    await context.reply({ embeds: [error('Failed to lock the channel.')], ephemeral: isInteraction }).catch(() => null);
  }
}
