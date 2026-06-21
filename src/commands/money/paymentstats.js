const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Payment = require('../../database/models/Payment');
const { createEmbed, success, error, info } = require('../../utils/embedBuilder');

module.exports = {
  name: 'paymentstats',
  description: 'View payment system analytics and statistics.',
  slashData: new SlashCommandBuilder()
    .setName('paymentstats')
    .setDescription('Display payment statistics.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async executePrefix(message, args, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return message.reply({ embeds: [error('You must have Manage Server permission to view payment statistics.')] });
    }
    await displayPaymentStats(message);
  },

  async executeSlash(interaction, client) {
    await displayPaymentStats(interaction);
  }
};

async function displayPaymentStats(context) {
  try {
    const guildId = context.guildId || context.guild.id;

    // Get count metrics
    const totalPayments = await Payment.countDocuments({ guildId });
    const pendingCount = await Payment.countDocuments({ guildId, status: 'pending' });
    const approvedCount = await Payment.countDocuments({ guildId, status: 'approved' });
    const rejectedCount = await Payment.countDocuments({ guildId, status: 'rejected' });

    // Calculate revenue per payment method
    const approvedPayments = await Payment.find({ guildId, status: 'approved' });
    
    const revenueMap = {};
    const methodCounts = {};

    approvedPayments.forEach(p => {
      // Keep counts of payment methods used
      methodCounts[p.method] = (methodCounts[p.method] || 0) + 1;

      // Extract numeric amount
      const cleanAmountStr = p.amount.replace(/[^0-9.]/g, '');
      const amt = parseFloat(cleanAmountStr) || 0;

      revenueMap[p.method] = (revenueMap[p.method] || 0) + amt;
    });

    let revenueText = '';
    const methods = Object.keys(revenueMap);
    if (methods.length === 0) {
      revenueText = '❌ No revenue recorded yet.';
    } else {
      methods.forEach(method => {
        let currencySymbol = '$';
        if (method === 'UPI') currencySymbol = '₹';
        else if (['BTC', 'ETH', 'SOL', 'LTC', 'XRP', 'DOGE', 'USDT', 'BNB'].includes(method)) currencySymbol = '';

        const formattedRev = revenueMap[method].toLocaleString(undefined, {
          minimumFractionDigits: currencySymbol ? 2 : 6,
          maximumFractionDigits: currencySymbol ? 2 : 6
        });

        revenueText += `• **${method}:** \`${currencySymbol}${formattedRev}\` (${methodCounts[method]} approved)\n`;
      });
    }

    const statsEmbed = info(
      `Financial analytics overview for **${context.guild.name}**.`,
      `📊 Payment System Statistics`
    )
    .addFields([
      { name: '🧾 Total Submissions', value: `\`${totalPayments}\` payments`, inline: true },
      { name: '🟡 Pending Verification', value: `\`${pendingCount}\` reviews`, inline: true },
      { name: '🟢 Approved Payments', value: `\`${approvedCount}\` verified`, inline: true },
      { name: '🔴 Rejected Submissions', value: `\`${rejectedCount}\` rejected`, inline: true },
      { name: '💰 Total Revenue Breakdown (Approved Only)', value: revenueText, inline: false }
    ]);

    return context.reply({ embeds: [statsEmbed] });

  } catch (err) {
    console.error('Error loading payment stats:', err);
    return context.reply({ embeds: [error('Failed to load payment statistics.')] });
  }
}
