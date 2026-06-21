const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const PaymentConfig = require('../../database/models/PaymentConfig');
const { createEmbed, success, error, info } = require('../../utils/embedBuilder');

module.exports = {
  name: 'paypal',
  description: 'Generate payment requests using PayPal.',
  slashData: new SlashCommandBuilder()
    .setName('paypal')
    .setDescription('Generate a PayPal.me QR payment request.')
    .addNumberOption(opt => opt.setName('amount').setDescription('Amount requested (e.g. 10)').setRequired(false)),

  async executePrefix(message, args, client) {
    const amountArg = args[0];
    const amount = amountArg ? parseFloat(amountArg) : null;

    if (amountArg && isNaN(amount)) {
      return message.reply({ embeds: [error('Invalid amount. Usage: `r?paypal [amount]`')] });
    }

    await generatePaypalRequest(message, amount, false);
  },

  async executeSlash(interaction, client) {
    const amount = interaction.options.getNumber('amount');
    await generatePaypalRequest(interaction, amount, true);
  }
};

async function generatePaypalRequest(context, amount, isInteraction) {
  try {
    const guildId = context.guildId || context.guild.id;
    const config = await PaymentConfig.findOne({ guildId });

    if (!config || !config.paypalUsername) {
      const errMsg = 'The PayPal payment system is not configured for this server. Ask an Admin to run `/setuppaypal`.';
      if (isInteraction) return context.reply({ embeds: [error(errMsg)], ephemeral: true });
      return context.reply({ embeds: [error(errMsg)] });
    }

    const paymentId = 'PM-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Format PayPal.me Link
    const amountSuffix = amount ? `/${amount}` : '';
    const paypalLink = `https://www.paypal.me/${config.paypalUsername}${amountSuffix}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(paypalLink)}`;

    const payEmbed = info(
      `Scan the QR Code below to pay via PayPal, or click the link to open PayPal.me.\n\n` +
      `🔗 **Pay Online:** [PayPal.me Link](${paypalLink})`,
      `☁️ Ren Cloud PayPal Payment`
    )
    .setImage(qrUrl)
    .addFields([
      { name: '👤 Username', value: `\`@${config.paypalUsername}\``, inline: true },
      { name: '🧾 Payment ID', value: `\`${paymentId}\``, inline: true },
      { name: '💰 Amount Requested', value: amount ? `\`$${amount.toLocaleString()}\` USD` : '`Flexible Amount`', inline: true }
    ]);

    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`pay_proof_upload:${paymentId}:PayPal:${amount || 'none'}`)
        .setLabel('📸 Upload Payment Proof')
        .setStyle(ButtonStyle.Success)
    );

    if (isInteraction) {
      await context.reply({ embeds: [payEmbed], components: [actionRow] });
    } else {
      await context.reply({ embeds: [payEmbed], components: [actionRow] });
    }

  } catch (err) {
    console.error('Error generating PayPal request:', err);
    if (isInteraction) return context.reply({ embeds: [error('Failed to generate PayPal payment request.')], ephemeral: true }).catch(() => null);
    return context.reply({ embeds: [error('Failed to generate PayPal payment request.')] }).catch(() => null);
  }
}
