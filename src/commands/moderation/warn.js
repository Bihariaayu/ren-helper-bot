const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Warning = require('../../database/models/Warning');
const { success, error } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');

module.exports = {
  name: 'warn',
  description: 'Issues a warning to a member and saves it in the database.',
  slashData: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warns a member.')
    .addUserOption(opt => opt.setName('user').setDescription('The user to warn').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for the warning').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async executePrefix(message, args, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return message.reply({ embeds: [error('You do not have permission to moderate members.')] });
    }

    const targetUser = message.mentions.users.first() || client.users.cache.get(args[0]);
    if (!targetUser) {
      return message.reply({ embeds: [error('Please mention a valid user. Usage: `r?warn @user <reason>`')] });
    }

    const reason = args.slice(1).join(' ').trim();
    if (!reason) {
      return message.reply({ embeds: [error('Please provide a reason for the warning. Usage: `r?warn @user <reason>`')] });
    }

    await runWarn(message, targetUser, reason, false);
  },

  async executeSlash(interaction, client) {
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');
    await runWarn(interaction, targetUser, reason, true);
  }
};

async function runWarn(context, targetUser, reason, isInteraction) {
  const guild = context.guild;
  const author = isInteraction ? context.user : context.author;

  try {
    const member = await guild.members.fetch(targetUser.id).catch(() => null);

    if (member) {
      if (member.id === author.id) {
        return context.reply({ embeds: [error('You cannot warn yourself.')], ephemeral: isInteraction });
      }
      if (member.id === guild.ownerId) {
        return context.reply({ embeds: [error('You cannot warn the server owner.')], ephemeral: isInteraction });
      }
      if (member.roles.highest.position >= context.member.roles.highest.position && author.id !== guild.ownerId) {
        return context.reply({ embeds: [error('You cannot warn this member because they have an equal or higher role than you.')], ephemeral: isInteraction });
      }
    }

    // Generate Warning Case ID
    const warnId = 'CASE-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    // Save Warning to DB
    await Warning.create({
      guildId: guild.id,
      userId: targetUser.id,
      warnId,
      moderatorId: author.id,
      reason
    });

    // Attempt to DM user
    if (member) {
      await member.send({ embeds: [error(`You have been warned in **${guild.name}**.\n**Reason:** ${reason}\n**Case ID:** \`${warnId}\``, `⚠️ Warning Issued`)] }).catch(() => null);
    }

    const replyEmbed = success(`Successfully warned **${targetUser.tag}**.\n**Reason:** ${reason}\n**Case ID:** \`${warnId}\``);
    await context.reply({ embeds: [replyEmbed] });

    // Log to log channel
    logger.logToGuild(
      guild, 
      'Member Warning', 
      `⚠️ **User:** ${targetUser} (${targetUser.tag})\n🆔 **ID:** ${targetUser.id}\n👮 **Moderator:** ${author}\n📝 **Reason:** ${reason}\n📁 **Case ID:** \`${warnId}\``
    );

  } catch (err) {
    console.error('Error during warning:', err);
    await context.reply({ embeds: [error('Failed to issue the warning.')], ephemeral: isInteraction }).catch(() => null);
  }
}
