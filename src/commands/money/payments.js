const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Payment = require('../../database/models/Payment');
const { createEmbed, success, error, info } = require('../../utils/embedBuilder');

module.exports = {
  name: 'payments',
  aliases: ['paymenthistory', 'paymentinfo'],
  description: 'View payment history or search by Payment ID.',
  slashData: new SlashCommandBuilder()
    .setName('payments')
    .setDescription('Manage or view payments history.')
    .addSubcommand(sub => sub
      .setName('history')
      .setDescription('View payment submission history.')
      .addUserOption(opt => opt.setName('user').setDescription('User to check history for (Admin Only)').setRequired(false))
    )
    .addSubcommand(sub => sub
      .setName('info')
      .setDescription('Look up a specific payment by Payment ID.')
      .addStringOption(opt => opt.setName('payment-id').setDescription('The unique Payment ID (e.g. PM-XXXXXX)').setRequired(true))
    ),

  async executePrefix(message, args, client) {
    const isInfo = message.content.toLowerCase().includes('paymentinfo');

    if (isInfo) {
      const paymentId = args[0]?.toUpperCase();
      if (!paymentId) return message.reply({ embeds: [error('Usage: `r?paymentinfo <paymentid>`')] });
      await getPaymentInfo(message, paymentId);
    } else {
      // paymenthistory or payments
      const targetUser = message.mentions.users.first() || message.author;
      if (targetUser.id !== message.author.id && !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply({ embeds: [error('You do not have permission to view other users\' payment history.')] });
      }
      await getPaymentHistory(message, targetUser);
    }
  },

  async executeSlash(interaction, client) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'history') {
      const optionUser = interaction.options.getUser('user');
      const targetUser = optionUser || interaction.user;

      if (optionUser && optionUser.id !== interaction.user.id && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ embeds: [error('You must be an Administrator to view other users\' payment history.')], ephemeral: true });
      }
      await getPaymentHistory(interaction, targetUser);
    } 
    else if (sub === 'info') {
      const paymentId = interaction.options.getString('payment-id').toUpperCase();
      await getPaymentInfo(interaction, paymentId);
    }
  }
};

async function getPaymentHistory(context, user) {
  try {
    const guildId = context.guildId || context.guild.id;
    const payments = await Payment.find({ guildId, userId: user.id }).sort({ timestamp: -1 }).limit(10);

    if (payments.length === 0) {
      const embed = info(`No payment submissions found for **${user.tag}** in this server.`, '💳 Payment History');
      return context.reply({ embeds: [embed] });
    }

    let desc = `Recent payment submissions for **${user}**:\n\n`;
    payments.forEach((p, idx) => {
      const statusEmoji = p.status === 'approved' ? '🟢' : p.status === 'rejected' ? '🔴' : '🟡';
      desc += `${idx + 1}. **\`${p.paymentId}\`** - ${p.amount} (${p.method})\n` +
              `   └ Status: ${statusEmoji} \`${p.status.toUpperCase()}\` | Date: <t:${Math.floor(p.timestamp.getTime() / 1000)}:d>\n`;
    });

    const embed = info(desc, '💳 Payment History');
    return context.reply({ embeds: [embed] });
  } catch (err) {
    console.error('Error fetching history:', err);
    return context.reply({ embeds: [error('Failed to retrieve payment history.')] });
  }
}

async function getPaymentInfo(context, paymentId) {
  try {
    const guildId = context.guildId || context.guild.id;
    const payment = await Payment.findOne({ guildId, paymentId });

    if (!payment) {
      return context.reply({ embeds: [error(`No payment submission found with ID: \`${paymentId}\`.`)] });
    }

    // Permission check: only creator or admin can view
    const requesterId = context.user?.id || context.author?.id;
    const isAdmin = (context.member?.permissions?.has(PermissionFlagsBits.Administrator) || context.member?.permissions?.has(PermissionFlagsBits.ManageGuild));
    if (payment.userId !== requesterId && !isAdmin) {
      return context.reply({ embeds: [error('You do not have permission to view this payment information.')] });
    }

    const statusEmoji = payment.status === 'approved' ? '🟢' : payment.status === 'rejected' ? '🔴' : '🟡';
    const embed = info(
      `Detailed verification metadata for Payment ID: \`${paymentId}\`.`,
      `💳 Payment Details`
    )
    .setImage(payment.screenshotUrl)
    .addFields([
      { name: '👤 Customer', value: `<@${payment.userId}> (\`${payment.username}\`)`, inline: true },
      { name: '💰 Amount', value: `\`${payment.amount}\``, inline: true },
      { name: '💳 Method', value: `\`${payment.method}\``, inline: true },
      { name: '🟢 Status', value: `${statusEmoji} \`${payment.status.toUpperCase()}\``, inline: true },
      { name: '🕒 Date Submitted', value: `<t:${Math.floor(payment.timestamp.getTime() / 1000)}:f>`, inline: true },
      { name: '🛡️ Verified By', value: payment.verifiedBy ? `\`${payment.verifiedBy}\`` : '`Pending Review`', inline: true }
    ]);

    if (payment.notes) {
      embed.addFields([{ name: '📝 Customer Notes', value: `\`${payment.notes}\``, inline: false }]);
    }
    if (payment.transactionId) {
      embed.addFields([{ name: '🧾 Tx ID / Ref ID', value: `\`${payment.transactionId}\``, inline: true }]);
    }
    if (payment.rejectionReason) {
      embed.addFields([{ name: '❌ Rejection Reason', value: `\`${payment.rejectionReason}\``, inline: false }]);
    }

    return context.reply({ embeds: [embed] });
  } catch (err) {
    console.error('Error fetching payment info:', err);
    return context.reply({ embeds: [error('Failed to retrieve payment details.')] });
  }
}
