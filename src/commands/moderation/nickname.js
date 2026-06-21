const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { success, error } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');

module.exports = {
  name: 'nickname',
  aliases: ['nick'],
  description: 'Changes the nickname of a member in the server.',
  slashData: new SlashCommandBuilder()
    .setName('nickname')
    .setDescription('Changes the nickname of a member.')
    .addUserOption(opt => opt.setName('user').setDescription('The user whose nickname to change').setRequired(true))
    .addStringOption(opt => opt.setName('nick').setDescription('New nickname (leave empty to reset)').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),

  async executePrefix(message, args, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageNicknames)) {
      return message.reply({ embeds: [error('You do not have permission to manage nicknames.')] });
    }

    const targetUser = message.mentions.users.first() || client.users.cache.get(args[0]);
    if (!targetUser) {
      return message.reply({ embeds: [error('Please mention a valid user. Usage: `r?nickname @user <new nickname>`')] });
    }

    const newNick = args.slice(1).join(' ').trim() || null;
    await runNickname(message, targetUser, newNick, false);
  },

  async executeSlash(interaction, client) {
    const targetUser = interaction.options.getUser('user');
    const newNick = interaction.options.getString('nick') || null;
    await runNickname(interaction, targetUser, newNick, true);
  }
};

async function runNickname(context, targetUser, newNick, isInteraction) {
  const guild = context.guild;
  const author = isInteraction ? context.user : context.author;

  try {
    const member = await guild.members.fetch(targetUser.id).catch(() => null);

    if (!member) {
      return context.reply({ embeds: [error('This user is not currently in the server.')], ephemeral: isInteraction });
    }

    // Hierarchy validation
    if (member.id === guild.ownerId) {
      return context.reply({ embeds: [error('I cannot change the nickname of the server owner.')], ephemeral: isInteraction });
    }
    if (!member.manageable) {
      return context.reply({ embeds: [error('I cannot change the nickname of this user. They may have a higher role than me.')], ephemeral: isInteraction });
    }
    if (member.roles.highest.position >= context.member.roles.highest.position && author.id !== guild.ownerId) {
      return context.reply({ embeds: [error('You cannot change the nickname of this member because they have an equal or higher role than you.')], ephemeral: isInteraction });
    }

    const oldNick = member.displayName;
    await member.setNickname(newNick, `Changed by moderator ${author.tag}`);

    const replyEmbed = success(
      newNick 
        ? `Successfully changed nickname of **${targetUser.tag}** to \`${newNick}\`.`
        : `Successfully reset nickname of **${targetUser.tag}**.`
    );
    await context.reply({ embeds: [replyEmbed] });

    // Log to log channel
    logger.logToGuild(
      guild, 
      'Nickname Changed', 
      `📝 **User:** ${targetUser} (${targetUser.tag})\n👤 **Old Name:** \`${oldNick}\`\n✨ **New Nickname:** \`${newNick || 'Reset'}\`\n👮 **Moderator:** ${author}`
    );

  } catch (err) {
    console.error('Error changing nickname:', err);
    await context.reply({ embeds: [error('Failed to change nickname.')], ephemeral: isInteraction }).catch(() => null);
  }
}
