const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { success, error } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');

module.exports = {
  name: 'unban',
  description: 'Unbans a user from the server using their user ID.',
  slashData: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unbans a user from the server.')
    .addStringOption(opt => opt.setName('userid').setDescription('The Discord ID of the user to unban').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for the unban').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async executePrefix(message, args, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return message.reply({ embeds: [error('You do not have permission to unban members.')] });
    }

    const userId = args[0];
    if (!userId) {
      return message.reply({ embeds: [error('Please specify a valid User ID. Usage: `r?unban <userId> [reason]`')] });
    }

    const reason = args.slice(1).join(' ') || 'No reason provided';
    await runUnban(message, userId, reason, false, client);
  },

  async executeSlash(interaction, client) {
    const userId = interaction.options.getString('userid');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    await runUnban(interaction, userId, reason, true, client);
  }
};

async function runUnban(context, userId, reason, isInteraction, client) {
  const guild = context.guild;
  const author = isInteraction ? context.user : context.author;

  try {
    const bans = await guild.bans.fetch();
    const bannedUser = bans.get(userId);

    if (!bannedUser) {
      return context.reply({ embeds: [error(`No active ban found for User ID \`${userId}\` in this server.`)], ephemeral: isInteraction });
    }

    await guild.members.unban(userId, `${author.tag}: ${reason}`);

    const replyEmbed = success(`Successfully unbanned **${bannedUser.user.tag}**.\n**Reason:** ${reason}`);
    
    if (isInteraction) {
      await context.reply({ embeds: [replyEmbed] });
    } else {
      await context.reply({ embeds: [replyEmbed] });
    }

    // Log to log channel
    logger.logToGuild(
      guild, 
      'Member Unbanned', 
      `🔓 **User:** ${bannedUser.user} (${bannedUser.user.tag})\n🆔 **ID:** ${userId}\n👮 **Moderator:** ${author}\n📝 **Reason:** ${reason}`
    );

  } catch (err) {
    console.error('Error during unban:', err);
    await context.reply({ embeds: [error('Failed to execute the unban. Double check that the ID is valid.')], ephemeral: isInteraction }).catch(() => null);
  }
}
