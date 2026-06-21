const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { success, error } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');

module.exports = {
  name: 'unmute',
  description: 'Unmutes a member in the server by removing the Muted role.',
  slashData: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Unmutes a member.')
    .addUserOption(opt => opt.setName('user').setDescription('The user to unmute').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for the unmute').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async executePrefix(message, args, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return message.reply({ embeds: [error('You do not have permission to manage roles.')] });
    }

    const targetUser = message.mentions.users.first() || message.guild.members.cache.get(args[0])?.user;
    if (!targetUser) {
      return message.reply({ embeds: [error('Please mention a valid user. Usage: `r?unmute @user [reason]`')] });
    }

    const reason = args.slice(1).join(' ') || 'No reason provided';
    await runUnmute(message, targetUser, reason, false);
  },

  async executeSlash(interaction, client) {
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    await runUnmute(interaction, targetUser, reason, true);
  }
};

async function runUnmute(context, targetUser, reason, isInteraction) {
  const guild = context.guild;
  const author = isInteraction ? context.user : context.author;

  try {
    const member = await guild.members.fetch(targetUser.id).catch(() => null);

    if (!member) {
      return context.reply({ embeds: [error('This user is not currently in the server.')], ephemeral: isInteraction });
    }

    const muteRole = guild.roles.cache.find(r => r.name === 'Muted');
    if (!muteRole || !member.roles.cache.has(muteRole.id)) {
      return context.reply({ embeds: [error('This user is not currently muted.')], ephemeral: isInteraction });
    }

    await member.roles.remove(muteRole, `${author.tag}: ${reason}`);

    const replyEmbed = success(`Successfully unmuted **${targetUser.tag}**.`);
    await context.reply({ embeds: [replyEmbed] });

    // Log to log channel
    logger.logToGuild(
      guild, 
      'Member Unmuted', 
      `🔊 **User:** ${targetUser} (${targetUser.tag})\n🆔 **ID:** ${targetUser.id}\n👮 **Moderator:** ${author}\n📝 **Reason:** ${reason}`
    );

  } catch (err) {
    console.error('Error during unmute:', err);
    await context.reply({ embeds: [error('Failed to unmute the member.')], ephemeral: isInteraction }).catch(() => null);
  }
}
