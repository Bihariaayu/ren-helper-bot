const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const PaymentConfig = require('../../database/models/PaymentConfig');
const { success, error, info } = require('../../utils/embedBuilder');

module.exports = {
  name: 'setuppaypal',
  description: 'Configure PayPal payment details. (Admin Only)',
  slashData: new SlashCommandBuilder()
    .setName('setuppaypal')
    .setDescription('Configure PayPal username for payment requests.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt => opt.setName('username').setDescription('Your PayPal.me username (e.g. RenCloud)').setRequired(true)),

  async executePrefix(message, args, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply({ embeds: [error('You must be an Administrator to run this command.')] });
    }

    const username = args[0];
    if (!username) {
      return message.reply({ embeds: [error('Please specify a valid PayPal username. Usage: `r?setuppaypal <username>`')] });
    }

    await savePaypalConfig(message, username, false);
  },

  async executeSlash(interaction, client) {
    const username = interaction.options.getString('username');
    await savePaypalConfig(interaction, username, true);
  }
};

async function savePaypalConfig(context, username, isInteraction) {
  try {
    const guildId = context.guildId || context.guild.id;

    // Filter out full URLs if submitted by mistake
    const cleanUsername = username.replace(/https?:\/\/(www\.)?paypal\.me\//i, '').replace(/[^a-zA-Z0-9_-]/g, '');

    await PaymentConfig.findOneAndUpdate(
      { guildId },
      { $set: { paypalUsername: cleanUsername } },
      { upsert: true }
    );

    const embed = success(
      `✅ **PayPal Configuration Saved!**\n\n` +
      `• **PayPal Username:** \`${cleanUsername}\`\n` +
      `• **PayPal.me Link:** \`https://www.paypal.me/${cleanUsername}\`\n\n` +
      `Users can now run \`/paypal\` to request payments.`
    );

    if (isInteraction) return context.reply({ embeds: [embed] });
    return context.reply({ embeds: [embed] });

  } catch (err) {
    console.error('Error saving PayPal configuration:', err);
    if (isInteraction) return context.reply({ embeds: [error('Failed to configure PayPal details.')], ephemeral: true }).catch(() => null);
    return context.reply({ embeds: [error('Failed to configure PayPal details.')] }).catch(() => null);
  }
}
