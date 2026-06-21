const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { success, error } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');

module.exports = {
  name: 'mute',
  description: 'Mutes a member in the server using a Muted role.',
  slashData: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mutes a member.')
    .addUserOption(opt => opt.setName('user').setDescription('The user to mute').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for the mute').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async executePrefix(message, args, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return message.reply({ embeds: [error('You do not have permission to manage roles.')] });
    }

    const targetUser = message.mentions.users.first() || message.guild.members.cache.get(args[0])?.user;
    if (!targetUser) {
      return message.reply({ embeds: [error('Please mention a valid user. Usage: `r?mute @user [reason]`')] });
    }

    const reason = args.slice(1).join(' ') || 'No reason provided';
    await runMute(message, targetUser, reason, false);
  },

  async executeSlash(interaction, client) {
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    await runMute(interaction, targetUser, reason, true);
  }
};

async function runMute(context, targetUser, reason, isInteraction) {
  const guild = context.guild;
  const author = isInteraction ? context.user : context.author;

  try {
    const member = await guild.members.fetch(targetUser.id).catch(() => null);

    if (!member) {
      return context.reply({ embeds: [error('This user is not currently in the server.')], ephemeral: isInteraction });
    }

    // Hierarchy checks
    if (member.id === author.id) {
      return context.reply({ embeds: [error('You cannot mute yourself.')], ephemeral: isInteraction });
    }
    if (member.id === guild.ownerId) {
      return context.reply({ embeds: [error('You cannot mute the server owner.')], ephemeral: isInteraction });
    }
    if (member.roles.highest.position >= context.member.roles.highest.position && author.id !== guild.ownerId) {
      return context.reply({ embeds: [error('You cannot mute this member because they have an equal or higher role than you.')], ephemeral: isInteraction });
    }

    // Get or Create Muted role
    let muteRole = guild.roles.cache.find(r => r.name === 'Muted');
    if (!muteRole) {
      // Check bot permission to create roles
      if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return context.reply({ embeds: [error('I do not have "Manage Roles" permission to create the Muted role.')], ephemeral: isInteraction });
      }

      muteRole = await guild.roles.create({
        name: 'Muted',
        color: 0x555555,
        reason: 'Automated Muted role setup'
      });

      // Configure overrides in all text & voice channels
      for (const channel of guild.channels.cache.values()) {
        await channel.permissionOverwrites.create(muteRole, {
          SendMessages: false,
          AddReactions: false,
          Speak: false,
          Connect: false
        }).catch(() => null);
      }
    }

    if (member.roles.cache.has(muteRole.id)) {
      return context.reply({ embeds: [error('This user is already muted.')], ephemeral: isInteraction });
    }

    await member.roles.add(muteRole, `${author.tag}: ${reason}`);

    const replyEmbed = success(`Successfully muted **${targetUser.tag}**.\n**Reason:** ${reason}`);
    await context.reply({ embeds: [replyEmbed] });

    // Log to log channel
    logger.logToGuild(
      guild, 
      'Member Muted', 
      `🔇 **User:** ${targetUser} (${targetUser.tag})\n🆔 **ID:** ${targetUser.id}\n👮 **Moderator:** ${author}\n📝 **Reason:** ${reason}`
    );

  } catch (err) {
    console.error('Error during mute:', err);
    await context.reply({ embeds: [error('Failed to mute the member.')], ephemeral: isInteraction }).catch(() => null);
  }
}
