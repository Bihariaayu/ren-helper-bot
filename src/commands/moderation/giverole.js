const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { success, error } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');

module.exports = {
  name: 'giverole',
  description: 'Grants a role to a member.',
  slashData: new SlashCommandBuilder()
    .setName('giverole')
    .setDescription('Grants a role to a member.')
    .addUserOption(opt => opt.setName('user').setDescription('The user to give the role to').setRequired(true))
    .addRoleOption(opt => opt.setName('role').setDescription('The role to grant').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async executePrefix(message, args, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return message.reply({ embeds: [error('You do not have permission to manage roles.')] });
    }

    const targetUser = message.mentions.users.first() || message.guild.members.cache.get(args[0])?.user;
    const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[1]);

    if (!targetUser || !role) {
      return message.reply({ embeds: [error('Invalid arguments. Usage: `r?giverole @user @role`')] });
    }

    await runGiveRole(message, targetUser, role, false);
  },

  async executeSlash(interaction, client) {
    const targetUser = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');
    await runGiveRole(interaction, targetUser, role, true);
  }
};

async function runGiveRole(context, targetUser, role, isInteraction) {
  const guild = context.guild;
  const author = isInteraction ? context.user : context.author;

  try {
    const member = await guild.members.fetch(targetUser.id).catch(() => null);

    if (!member) {
      return context.reply({ embeds: [error('This user is not currently in the server.')], ephemeral: isInteraction });
    }

    // Hierarchy validation
    if (role.position >= context.member.roles.highest.position && author.id !== guild.ownerId) {
      return context.reply({ embeds: [error('You cannot manage this role because it is higher than or equal to your highest role.')], ephemeral: isInteraction });
    }
    if (role.position >= guild.members.me.roles.highest.position) {
      return context.reply({ embeds: [error('I cannot grant this role because it is higher than or equal to my highest role.')], ephemeral: isInteraction });
    }

    if (member.roles.cache.has(role.id)) {
      return context.reply({ embeds: [error(`**${targetUser.tag}** already has the role ${role}.`)], ephemeral: isInteraction });
    }

    await member.roles.add(role, `Granted by moderator ${author.tag}`);

    const replyEmbed = success(`Successfully granted role ${role} to **${targetUser.tag}**.`);
    await context.reply({ embeds: [replyEmbed] });

    // Log to log channel
    logger.logToGuild(
      guild, 
      'Role Granted', 
      `➕ **User:** ${targetUser} (${targetUser.tag})\n🟢 **Role:** ${role} (${role.name})\n👮 **Moderator:** ${author}`
    );

  } catch (err) {
    console.error('Error giving role:', err);
    await context.reply({ embeds: [error('Failed to grant role.')], ephemeral: isInteraction }).catch(() => null);
  }
}
