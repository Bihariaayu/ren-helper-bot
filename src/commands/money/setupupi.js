const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const PaymentConfig = require('../../database/models/PaymentConfig');
const { success, error, info } = require('../../utils/embedBuilder');

module.exports = {
  name: 'setupupi',
  description: 'Configure UPI payment details. (Admin Only)',
  slashData: new SlashCommandBuilder()
    .setName('setupupi')
    .setDescription('Configure UPI ID for payment requests.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt => opt.setName('upi-id').setDescription('The UPI address (e.g. rencloud@paytm)').setRequired(true))
    .addStringOption(opt => opt.setName('merchant-name').setDescription('The business/merchant display name').setRequired(false)),

  async executePrefix(message, args, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply({ embeds: [error('You must be an Administrator to run this command.')] });
    }

    const upiId = args[0];
    const merchantName = args.slice(1).join(' ');

    if (!upiId) {
      return message.reply({ embeds: [error('Please specify a valid UPI ID. Usage: `r?setupupi <upi-id> [merchant-name]`')] });
    }

    await saveUpiConfig(message, upiId, merchantName || 'Ren Cloud Merchant', false);
  },

  async executeSlash(interaction, client) {
    const upiId = interaction.options.getString('upi-id');
    const merchantName = interaction.options.getString('merchant-name') || 'Ren Cloud Merchant';

    await saveUpiConfig(interaction, upiId, merchantName, true);
  }
};

async function saveUpiConfig(context, upiId, merchantName, isInteraction) {
  try {
    const guildId = context.guildId || context.guild.id;

    // Basic validation of UPI address format (must contain @)
    if (!upiId.includes('@')) {
      const errMsg = 'Invalid UPI ID format. A valid UPI ID must contain `@` (e.g., `rencloud@paytm`).';
      if (isInteraction) return context.reply({ embeds: [error(errMsg)], ephemeral: true });
      return context.reply({ embeds: [error(errMsg)] });
    }

    await PaymentConfig.findOneAndUpdate(
      { guildId },
      { $set: { upiId, merchantName } },
      { upsert: true }
    );

    const embed = success(
      `✅ **UPI Configuration Saved!**\n\n` +
      `• **UPI ID:** \`${upiId}\`\n` +
      `• **Merchant Display Name:** \`${merchantName}\`\n\n` +
      `Users can now run \`/upi\` to request payments.`
    );

    if (isInteraction) return context.reply({ embeds: [embed] });
    return context.reply({ embeds: [embed] });

  } catch (err) {
    console.error('Error saving UPI configuration:', err);
    if (isInteraction) return context.reply({ embeds: [error('Failed to configure UPI details.')], ephemeral: true }).catch(() => null);
    return context.reply({ embeds: [error('Failed to configure UPI details.')] }).catch(() => null);
  }
}
