const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { success, error } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');

module.exports = {
  name: 'timeout',
  description: 'Times out a member in the server.',
  slashData: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Times out a member.')
    .addUserOption(opt => opt.setName('user').setDescription('The user to timeout').setRequired(true))
    .addIntegerOption(opt => opt.setName('duration').setDescription('Duration of timeout in minutes').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for the timeout').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async executePrefix(message, args, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return message.reply({ embeds: [error('You do not have permission to moderate members.')] });
    }

    const targetUser = message.mentions.users.first() || client.users.cache.get(args[0]);
    if (!targetUser) {
      return message.reply({ embeds: [error('Please mention a valid user. Usage: `r?timeout @user <minutes> [reason]`')] });
    }

    const duration = parseInt(args[1]);
    if (isNaN(duration) || duration <= 0) {
      return message.reply({ embeds: [error('Please provide a valid duration in minutes. Usage: `r?timeout @user <minutes> [reason]`')] });
    }

    const reason = args.slice(2).join(' ') || 'No reason provided';
    await runTimeout(message, targetUser, duration, reason, false);
  },

  async executeSlash(interaction, client) {
    const targetUser = interaction.options.getUser('user');
    const duration = interaction.options.getInteger('duration');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    await runTimeout(interaction, targetUser, duration, reason, true);
  }
};

async function runTimeout(context, targetUser, durationMinutes, reason, isInteraction) {
  const guild = context.guild;
  const author = isInteraction ? context.user : context.author;
  const durationMs = durationMinutes * 60 * 1000;

  try {
    const member = await guild.members.fetch(targetUser.id).catch(() => null);

    if (!member) {
      return context.reply({ embeds: [error('This user is not currently in the server.')], ephemeral: isInteraction });
    }

    // Hierarchy checks
    if (member.id === author.id) {
      return context.reply({ embeds: [error('You cannot timeout yourself.')], ephemeral: isInteraction });
    }
    if (member.id === guild.ownerId) {
      return context.reply({ embeds: [error('You cannot timeout the server owner.')], ephemeral: isInteraction });
    }
    if (!member.moderatable) {
      return context.reply({ embeds: [error('I cannot moderate this user. They may have a higher role than me.')], ephemeral: isInteraction });
    }
    if (member.roles.highest.position >= context.member.roles.highest.position && author.id !== guild.ownerId) {
      return context.reply({ embeds: [error('You cannot timeout this member because they have an equal or higher role than you.')], ephemeral: isInteraction });
    }

    // Limit timeout to max 28 days (Discord API limit)
    if (durationMinutes > 40320) {
      return context.reply({ embeds: [error('Timeouts cannot exceed 28 days (40,320 minutes).')], ephemeral: isInteraction });
    }

    await member.timeout(durationMs, `${author.tag}: ${reason}`);

    const replyEmbed = success(`Successfully timed out **${targetUser.tag}** for **${durationMinutes}** minutes.\n**Reason:** ${reason}`);
    await context.reply({ embeds: [replyEmbed] });

    // Log to log channel
    logger.logToGuild(
      guild, 
      'Member Timeout', 
      `⏳ **User:** ${targetUser} (${targetUser.tag})\n🆔 **ID:** ${targetUser.id}\n👮 **Moderator:** ${author}\n⏱️ **Duration:** ${durationMinutes} minutes\n📝 **Reason:** ${reason}`
    );

  } catch (err) {
    console.error('Error during timeout:', err);
    await context.reply({ embeds: [error('Failed to execute the timeout.')], ephemeral: isInteraction }).catch(() => null);
  }
}
