const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const PaymentConfig = require('../../database/models/PaymentConfig');
const { createEmbed, error } = require('../../utils/embedBuilder');

module.exports = {
  name: 'paypal',
  description: 'Generate payment requests using PayPal.',
  slashData: new SlashCommandBuilder()
    .setName('paypal')
    .setDescription('Generate a PayPal.me QR payment request.')
    .addNumberOption(opt => opt.setName('amount').setDescription('Amount requested (e.g. 10)').setRequired(false))
    .addUserOption(opt => opt.setName('user').setDescription('Generate QR for a specific user (optional)').setRequired(false)),

  async executePrefix(message, args, client) {
    let amount = null;
    const targetUser = message.mentions.users.first() || null;
    const cleanArgs = args.filter(a => !a.startsWith('<@'));

    const amountArg = cleanArgs[0];
    if (amountArg) {
      const parsed = parseFloat(amountArg);
      if (!isNaN(parsed) && parsed > 0) amount = parsed;
    }

    await generatePaypalRequest(message, amount, false, message.author, targetUser);
  },

  async executeSlash(interaction, client) {
    const amount = interaction.options.getNumber('amount');
    const targetUser = interaction.options.getUser('user') || null;
    await generatePaypalRequest(interaction, amount, true, interaction.user, targetUser);
  }
};

async function generatePaypalRequest(context, amount, isInteraction, requester, targetUser) {
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
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&color=E74C3C&bgcolor=ffffff&data=${encodeURIComponent(paypalLink)}`;

    const targetLine = targetUser
      ? `\n> 🎯 **Generated for:** ${targetUser} (\`${targetUser.username}\`)\n> 🧑‍💼 **Requested by:** ${requester} (\`${requester.username}\`)`
      : '';

    const payEmbed = createEmbed({
      color: 'red',
      title: '💸 Ren Money — PayPal Payment',
      description: `Scan the QR code or use the PayPal.me link below to complete payment.${targetLine}`,
      image: qrUrl,
      fields: [
        { name: '👤 PayPal Username', value: `\`@${config.paypalUsername}\``, inline: true },
        { name: '💰 Requested Amount', value: amount ? `\`$${amount.toLocaleString()}\` USD` : '`Flexible Amount`', inline: true },
        { name: '🧾 Payment ID', value: `\`${paymentId}\``, inline: true },
        {
          name: '⚡ Payment Instructions',
          value: `1. Scan the QR or click → [PayPal.me Link](${paypalLink})\n` +
                 `2. Enter the amount and complete the transaction.\n` +
                 `3. Take a **screenshot** of the confirmation.\n` +
                 `4. Click **📸 Confirm Payment** below to submit.`,
          inline: false
        }
      ],
      footer: 'Ren Money - Secure Payment Solutions',
      timestamp: true
    });

    const targetId = targetUser ? targetUser.id : 'none';
    const requesterId = requester.id;

    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`pay_proof_upload:${paymentId}:PayPal:${amount || 'none'}:${targetId}:${requesterId}`)
        .setLabel('📸 Confirm Payment')
        .setStyle(ButtonStyle.Danger)
    );

    await context.reply({ embeds: [payEmbed], components: [actionRow] });

  } catch (err) {
    console.error('Error generating PayPal request:', err);
    if (isInteraction) return context.reply({ embeds: [error('Failed to generate PayPal payment request.')], ephemeral: true }).catch(() => null);
    return context.reply({ embeds: [error('Failed to generate PayPal payment request.')] }).catch(() => null);
  }
}
