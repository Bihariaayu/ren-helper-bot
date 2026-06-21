const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const PaymentConfig = require('../../database/models/PaymentConfig');
const { createEmbed, success, error, info } = require('../../utils/embedBuilder');

module.exports = {
  name: 'upi',
  description: 'Generate payment request using UPI.',
  slashData: new SlashCommandBuilder()
    .setName('upi')
    .setDescription('Generate a UPI payment QR request.')
    .addNumberOption(opt => opt.setName('amount').setDescription('Amount in INR (e.g. 149)').setRequired(false))
    .addStringOption(opt => opt.setName('notes').setDescription('Additional payment description').setRequired(false)),

  async executePrefix(message, args, client) {
    const amountArg = args[0];
    const amount = amountArg ? parseFloat(amountArg) : null;
    const notes = args.slice(1).join(' ') || 'None';

    if (amountArg && isNaN(amount)) {
      return message.reply({ embeds: [error('Invalid amount. Usage: `r?upi [amount] [notes]`')] });
    }

    await generateUpiRequest(message, amount, notes, false);
  },

  async executeSlash(interaction, client) {
    const amount = interaction.options.getNumber('amount');
    const notes = interaction.options.getString('notes') || 'None';

    await generateUpiRequest(interaction, amount, notes, true);
  }
};

async function generateUpiRequest(context, amount, notes, isInteraction) {
  try {
    const guildId = context.guildId || context.guild.id;
    const config = await PaymentConfig.findOne({ guildId });

    if (!config || !config.upiId) {
      const errMsg = 'The UPI payment system is not configured for this server. Ask an Admin to run `/setupupi`.';
      if (isInteraction) return context.reply({ embeds: [error(errMsg)], ephemeral: true });
      return context.reply({ embeds: [error(errMsg)] });
    }

    // Generate unique payment reference ID
    const paymentId = 'PM-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const merchantName = config.merchantName || 'Ren Cloud Merchant';
    
    // Format upi link
    const formattedAmount = amount ? amount.toFixed(2) : '';
    const upiLink = `upi://pay?pa=${config.upiId}&pn=${encodeURIComponent(merchantName)}&am=${formattedAmount}&tn=${paymentId}&cu=INR`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiLink)}`;

    const payEmbed = info(
      `Scan the QR Code with any UPI app (GPay, PhonePe, Paytm) to make the payment.\n\n` +
      `⚠️ **Important:** Please keep the transfer note/transaction description as **\`${paymentId}\`** to ensure your payment matches.\n\n` +
      `📱 **Direct UPI Link:**\n\`${upiLink}\``,
      `☁️ Ren Cloud UPI Payment`
    )
    .setImage(qrUrl)
    .addFields([
      { name: '👤 Merchant Name', value: `\`${merchantName}\``, inline: true },
      { name: '💳 UPI ID', value: `\`${config.upiId}\``, inline: true },
      { name: '🧾 Payment ID (Note)', value: `\`${paymentId}\``, inline: true },
      { name: '💰 Amount Requested', value: amount ? `\`₹${amount.toLocaleString('en-IN')}\` INR` : '`Flexible Amount`', inline: true },
      { name: '📝 Additional Notes', value: `\`${notes}\``, inline: false }
    ]);

    // Button to upload proof
    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`pay_proof_upload:${paymentId}:UPI:${amount || 'none'}`)
        .setLabel('📸 Upload Payment Proof')
        .setStyle(ButtonStyle.Success)
    );

    if (isInteraction) {
      await context.reply({ embeds: [payEmbed], components: [actionRow] });
    } else {
      await context.reply({ embeds: [payEmbed], components: [actionRow] });
    }

  } catch (err) {
    console.error('Error generating UPI request:', err);
    if (isInteraction) return context.reply({ embeds: [error('Failed to generate UPI payment request.')], ephemeral: true }).catch(() => null);
    return context.reply({ embeds: [error('Failed to generate UPI payment request.')] }).catch(() => null);
  }
}
