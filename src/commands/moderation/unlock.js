const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { success, error } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');

module.exports = {
  name: 'unlock',
  description: 'Unlocks the current channel permitting members to send messages.',
  slashData: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Unlocks the current channel.')
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for unlocking').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async executePrefix(message, args, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return message.reply({ embeds: [error('You do not have permission to manage channels.')] });
    }

    const reason = args.join(' ') || 'No reason provided';
    await runUnlock(message, reason, false);
  },

  async executeSlash(interaction, client) {
    const reason = interaction.options.getString('reason') || 'No reason provided';
    await runUnlock(interaction, reason, true);
  }
};

async function runUnlock(context, reason, isInteraction) {
  const channel = context.channel;
  const guild = context.guild;
  const author = isInteraction ? context.user : context.author;

  try {
    // Check bot permission
    if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return context.reply({ embeds: [error('I do not have permission to manage channel permissions.')], ephemeral: isInteraction });
    }

    // Reset override (null deletes the rule for SendMessages)
    await channel.permissionOverwrites.edit(guild.roles.everyone, {
      SendMessages: null
    }, { reason: `Unlocked by ${author.tag}: ${reason}` });

    const replyEmbed = success(`🔓 This channel has been unlocked.`);
    await context.reply({ embeds: [replyEmbed] });

    // Log to log channel
    logger.logToGuild(
      guild, 
      'Channel Unlocked', 
      `🔓 **Channel:** ${channel} (${channel.name})\n👮 **Moderator:** ${author}\n📝 **Reason:** ${reason}`
    );

  } catch (err) {
    console.error('Error unlocking channel:', err);
    await context.reply({ embeds: [error('Failed to unlock the channel.')], ephemeral: isInteraction }).catch(() => null);
  }
}
