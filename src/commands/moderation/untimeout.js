const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { success, error } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');

module.exports = {
  name: 'untimeout',
  description: 'Removes the timeout from a member in the server.',
  slashData: new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Removes the timeout from a member.')
    .addUserOption(opt => opt.setName('user').setDescription('The user to untimeout').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for removing timeout').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async executePrefix(message, args, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return message.reply({ embeds: [error('You do not have permission to moderate members.')] });
    }

    const targetUser = message.mentions.users.first() || client.users.cache.get(args[0]);
    if (!targetUser) {
      return message.reply({ embeds: [error('Please mention a valid user. Usage: `r?untimeout @user [reason]`')] });
    }

    const reason = args.slice(1).join(' ') || 'No reason provided';
    await runUntimeout(message, targetUser, reason, false);
  },

  async executeSlash(interaction, client) {
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    await runUntimeout(interaction, targetUser, reason, true);
  }
};

async function runUntimeout(context, targetUser, reason, isInteraction) {
  const guild = context.guild;
  const author = isInteraction ? context.user : context.author;

  try {
    const member = await guild.members.fetch(targetUser.id).catch(() => null);

    if (!member) {
      return context.reply({ embeds: [error('This user is not currently in the server.')], ephemeral: isInteraction });
    }

    if (!member.isCommunicationDisabled()) {
      return context.reply({ embeds: [error('This user is not currently timed out.')], ephemeral: isInteraction });
    }

    // Hierarchy checks
    if (!member.moderatable) {
      return context.reply({ embeds: [error('I cannot moderate this user. They may have a higher role than me.')], ephemeral: isInteraction });
    }
    if (member.roles.highest.position >= context.member.roles.highest.position && author.id !== guild.ownerId) {
      return context.reply({ embeds: [error('You cannot untimeout this member because they have an equal or higher role than you.')], ephemeral: isInteraction });
    }

    await member.timeout(null, `${author.tag}: ${reason}`);

    const replyEmbed = success(`Successfully removed timeout from **${targetUser.tag}**.\n**Reason:** ${reason}`);
    await context.reply({ embeds: [replyEmbed] });

    // Log to log channel
    logger.logToGuild(
      guild, 
      'Member Untimeout', 
      `🔓 **User:** ${targetUser} (${targetUser.tag})\n🆔 **ID:** ${targetUser.id}\n👮 **Moderator:** ${author}\n📝 **Reason:** ${reason}`
    );

  } catch (err) {
    console.error('Error during untimeout:', err);
    await context.reply({ embeds: [error('Failed to remove timeout.')], ephemeral: isInteraction }).catch(() => null);
  }
}
