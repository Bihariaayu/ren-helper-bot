const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const PaymentConfig = require('../../database/models/PaymentConfig');
const { createEmbed, error } = require('../../utils/embedBuilder');

module.exports = {
  name: 'upi',
  description: 'Generate payment request using UPI.',
  slashData: new SlashCommandBuilder()
    .setName('upi')
    .setDescription('Generate a UPI payment QR request.')
    .addNumberOption(opt => opt.setName('amount').setDescription('Amount in INR (e.g. 149)').setRequired(false))
    .addStringOption(opt => opt.setName('notes').setDescription('Additional payment description').setRequired(false))
    .addUserOption(opt => opt.setName('user').setDescription('Generate QR for a specific user (optional)').setRequired(false)),

  async executePrefix(message, args, client) {
    // Parse: r?upi [amount] [@user] [notes...]
    // or:    r?upi [@user] [amount] [notes...]
    let amount = null;
    let targetUser = message.mentions.users.first() || null;

    // Filter out the mention from args
    const cleanArgs = args.filter(a => !a.startsWith('<@'));

    const amountArg = cleanArgs[0];
    if (amountArg) {
      const parsed = parseFloat(amountArg);
      if (!isNaN(parsed) && parsed > 0) {
        amount = parsed;
      }
    }
    const notes = cleanArgs.slice(1).join(' ') || 'None';

    await generateUpiRequest(message, amount, notes, false, message.author, targetUser);
  },

  async executeSlash(interaction, client) {
    const amount = interaction.options.getNumber('amount');
    const notes = interaction.options.getString('notes') || 'None';
    const targetUser = interaction.options.getUser('user') || null;

    await generateUpiRequest(interaction, amount, notes, true, interaction.user, targetUser);
  }
};

async function generateUpiRequest(context, amount, notes, isInteraction, requester, targetUser) {
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

    // Red & Green QR — use red foreground on white background for visibility
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&color=E74C3C&bgcolor=ffffff&data=${encodeURIComponent(upiLink)}`;

    const forUser = targetUser || requester;
    const targetLine = targetUser
      ? `\n> 🎯 **Generated for:** ${targetUser} (\`${targetUser.username}\`)\n> 🧑‍💼 **Requested by:** ${requester} (\`${requester.username}\`)`
      : '';

    const payEmbed = createEmbed({
      color: 'red',
      title: '💸 Ren Money — UPI Payment',
      description: `Scan the QR code or copy the UPI ID below to complete payment.${targetLine}`,
      image: qrUrl,
      fields: [
        { name: '💳 UPI Address', value: `\`${config.upiId}\``, inline: true },
        { name: '💰 Requested Amount', value: amount ? `\`₹${amount.toLocaleString('en-IN')}\`` : '`Flexible Amount`', inline: true },
        { name: '🧾 Payment ID', value: `\`${paymentId}\``, inline: true },
        {
          name: '⚡ Payment Instructions',
          value: `1. Scan the QR using any UPI App (**GPay, PhonePe, Paytm, BHIM**).\n` +
                 `2. Verify the UPI ID and amount match.\n` +
                 `3. Complete the transaction and take a **screenshot**.\n` +
                 `4. Click **📸 Confirm Payment** below to submit proof.`,
          inline: false
        }
      ],
      footer: 'Ren Money - Secure Payment Solutions',
      timestamp: true
    });

    // Encode target user info into the button customId
    const targetId = targetUser ? targetUser.id : 'none';
    const targetName = targetUser ? encodeURIComponent(targetUser.username) : 'none';
    const requesterId = requester.id;

    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`pay_proof_upload:${paymentId}:UPI:${amount || 'none'}:${targetId}:${requesterId}`)
        .setLabel('📸 Confirm Payment')
        .setStyle(ButtonStyle.Danger)
    );

    await context.reply({ embeds: [payEmbed], components: [actionRow] });

  } catch (err) {
    console.error('Error generating UPI request:', err);
    if (isInteraction) return context.reply({ embeds: [error('Failed to generate UPI payment request.')], ephemeral: true }).catch(() => null);
    return context.reply({ embeds: [error('Failed to generate UPI payment request.')] }).catch(() => null);
  }
}
