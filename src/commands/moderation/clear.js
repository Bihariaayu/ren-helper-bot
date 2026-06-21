const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { success, error } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');

module.exports = {
  name: 'clear',
  aliases: ['purge'],
  description: 'Clears a specified amount of messages from the channel.',
  slashData: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Clears messages.')
    .addIntegerOption(opt => opt.setName('amount').setDescription('Number of messages to clear (1-100)').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async executePrefix(message, args, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return message.reply({ embeds: [error('You do not have permission to manage messages.')] });
    }

    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount < 1 || amount > 100) {
      return message.reply({ embeds: [error('Please provide a valid amount between 1 and 100. Usage: `r?clear <amount>`')] });
    }

    await runClear(message, amount, false);
  },

  async executeSlash(interaction, client) {
    const amount = interaction.options.getInteger('amount');
    
    if (amount < 1 || amount > 100) {
      return interaction.reply({ embeds: [error('Please provide an amount between 1 and 100.')], ephemeral: true });
    }

    await runClear(interaction, amount, true);
  }
};

async function runClear(context, amount, isInteraction) {
  const channel = context.channel;
  const guild = context.guild;
  const author = isInteraction ? context.user : context.author;

  try {
    // Delete target command message first if prefix
    if (!isInteraction) {
      await context.delete().catch(() => null);
    }

    const deleted = await channel.bulkDelete(amount, true);

    const replyEmbed = success(`Cleared **${deleted.size}** messages.`);
    const msg = isInteraction 
      ? await context.reply({ embeds: [replyEmbed], fetchReply: true })
      : await context.channel.send({ embeds: [replyEmbed] });

    // Auto delete success message after 5 seconds
    setTimeout(() => {
      msg.delete().catch(() => null);
    }, 5000);

    // Log to log channel
    logger.logToGuild(
      guild, 
      'Messages Purged', 
      `🧹 **Channel:** ${channel}\n👮 **Moderator:** ${author}\n💬 **Requested Amount:** \`${amount}\`\n🗑️ **Deleted Count:** \`${deleted.size}\``
    );

  } catch (err) {
    console.error('Error clearing messages:', err);
    await context.reply({ embeds: [error('Failed to clear messages. Messages older than 14 days cannot be bulk deleted.')], ephemeral: isInteraction }).catch(() => null);
  }
}
