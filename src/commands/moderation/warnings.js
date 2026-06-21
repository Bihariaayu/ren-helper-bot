const { SlashCommandBuilder, PermissionFlagsBits, time } = require('discord.js');
const Warning = require('../../database/models/Warning');
const { info, success, error } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');

module.exports = {
  name: 'warnings',
  description: 'Views or clears warnings for a user.',
  slashData: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('Manage user warnings.')
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('Lists all warnings for a member.')
      .addUserOption(opt => opt.setName('user').setDescription('The user to view warnings for').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('clear')
      .setDescription('Clears all warnings for a member.')
      .addUserOption(opt => opt.setName('user').setDescription('The user to clear warnings for').setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async executePrefix(message, args, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return message.reply({ embeds: [error('You do not have permission to view warnings.')] });
    }

    const sub = args[0]?.toLowerCase();
    
    if (sub === 'clear') {
      const targetUser = message.mentions.users.first() || client.users.cache.get(args[1]);
      if (!targetUser) {
        return message.reply({ embeds: [error('Please mention a valid user. Usage: `r?warnings clear @user`')] });
      }
      await clearWarnings(message, targetUser, false);
      return;
    }

    // Default: list warnings for mentioned user (or args[0])
    const targetUser = message.mentions.users.first() || client.users.cache.get(args[0]) || message.author;
    await listWarnings(message, targetUser, false);
  },

  async executeSlash(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser('user');

    if (sub === 'list') {
      await listWarnings(interaction, targetUser, true);
    } else if (sub === 'clear') {
      await clearWarnings(interaction, targetUser, true);
    }
  }
};

async function listWarnings(context, targetUser, isInteraction) {
  const guild = context.guild;

  try {
    const warns = await Warning.find({ guildId: guild.id, userId: targetUser.id }).sort({ timestamp: -1 });

    if (!warns || warns.length === 0) {
      return context.reply({ embeds: [info(`**${targetUser.tag}** has no active warnings in this server.`, '📁 Warnings List')] });
    }

    let desc = `Warnings records for **${targetUser.tag}** (${targetUser}). Total: **${warns.length}**\n\n`;
    warns.forEach((w, index) => {
      desc += `📁 **Case ID:** \`${w.warnId}\` | Moderator: <@${w.moderatorId}>\n` +
              `└ **Reason:** ${w.reason}\n` +
              `└ **Date:** ${time(w.timestamp, 'f')} (${time(w.timestamp, 'R')})\n\n`;
    });

    const embed = info(desc, `📁 Warnings List`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }));

    await context.reply({ embeds: [embed] });
  } catch (err) {
    console.error('Error fetching warnings:', err);
    await context.reply({ embeds: [error('Failed to load warnings.')], ephemeral: isInteraction }).catch(() => null);
  }
}

async function clearWarnings(context, targetUser, isInteraction) {
  const guild = context.guild;
  const author = isInteraction ? context.user : context.author;

  try {
    const res = await Warning.deleteMany({ guildId: guild.id, userId: targetUser.id });

    if (res.deletedCount === 0) {
      return context.reply({ embeds: [error(`**${targetUser.tag}** has no warnings to clear.`)], ephemeral: isInteraction });
    }

    const replyEmbed = success(`Successfully cleared **${res.deletedCount}** warning(s) for **${targetUser.tag}**.`);
    await context.reply({ embeds: [replyEmbed] });

    // Log to log channel
    logger.logToGuild(
      guild, 
      'Warnings Cleared', 
      `🧹 Warnings for user ${targetUser} (${targetUser.tag}) have been cleared by ${author} (Cleared: \`${res.deletedCount}\`).`
    );

  } catch (err) {
    console.error('Error clearing warnings:', err);
    await context.reply({ embeds: [error('Failed to clear warnings.')], ephemeral: isInteraction }).catch(() => null);
  }
}
