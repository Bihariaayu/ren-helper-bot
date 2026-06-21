const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { success, error } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');

module.exports = {
  name: 'ban',
  description: 'Bans a member from the server.',
  slashData: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bans a member from the server.')
    .addUserOption(opt => opt.setName('user').setDescription('The user to ban').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for the ban').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async executePrefix(message, args, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return message.reply({ embeds: [error('You do not have permission to ban members.')] });
    }

    const targetUser = message.mentions.users.first() || client.users.cache.get(args[0]);
    if (!targetUser) {
      return message.reply({ embeds: [error('Please mention a valid user or specify a user ID. Usage: `r?ban @user [reason]`')] });
    }

    const reason = args.slice(1).join(' ') || 'No reason provided';
    await runBan(message, targetUser, reason, false);
  },

  async executeSlash(interaction, client) {
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    await runBan(interaction, targetUser, reason, true);
  }
};

async function runBan(context, targetUser, reason, isInteraction) {
  const guild = context.guild;
  const author = isInteraction ? context.user : context.author;

  try {
    const member = await guild.members.fetch(targetUser.id).catch(() => null);

    if (member) {
      // Role hierarchy validations
      if (member.id === author.id) {
        return context.reply({ embeds: [error('You cannot ban yourself.')], ephemeral: isInteraction });
      }
      if (member.id === guild.ownerId) {
        return context.reply({ embeds: [error('You cannot ban the server owner.')], ephemeral: isInteraction });
      }
      if (!member.bannable) {
        return context.reply({ embeds: [error('I cannot ban this user. They may have a higher role than me.')], ephemeral: isInteraction });
      }
      if (member.roles.highest.position >= context.member.roles.highest.position && author.id !== guild.ownerId) {
        return context.reply({ embeds: [error('You cannot ban this member because they have an equal or higher role than you.')], ephemeral: isInteraction });
      }
    }

    // Attempt to DM user before ban
    if (member) {
      await member.send({ embeds: [error(`You have been banned from **${guild.name}**.\n**Reason:** ${reason}`, `🛡️ Banned`)] }).catch(() => null);
    }

    await guild.members.ban(targetUser.id, { reason: `${author.tag}: ${reason}` });

    const replyEmbed = success(`Successfully banned **${targetUser.tag}**.\n**Reason:** ${reason}`);
    
    if (isInteraction) {
      await context.reply({ embeds: [replyEmbed] });
    } else {
      await context.reply({ embeds: [replyEmbed] });
    }

    // Log to log channel
    logger.logToGuild(
      guild, 
      'Member Banned', 
      `🛡️ **User:** ${targetUser} (${targetUser.tag})\n🆔 **ID:** ${targetUser.id}\n👮 **Moderator:** ${author}\n📝 **Reason:** ${reason}`
    );

  } catch (err) {
    console.error('Error during ban:', err);
    await context.reply({ embeds: [error('Failed to execute the ban.')], ephemeral: isInteraction }).catch(() => null);
  }
}
