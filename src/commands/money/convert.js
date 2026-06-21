const { SlashCommandBuilder } = require('discord.js');
const { createEmbed, success, error, info } = require('../../utils/embedBuilder');

module.exports = {
  name: 'convert',
  description: 'Real-time fiat currency converter.',
  slashData: new SlashCommandBuilder()
    .setName('convert')
    .setDescription('Convert fiat currencies.')
    .addNumberOption(opt => opt.setName('amount').setDescription('Amount to convert').setRequired(true))
    .addStringOption(opt => opt.setName('from').setDescription('Currency converting from (e.g., USD)').setRequired(true))
    .addStringOption(opt => opt.setName('to').setDescription('Currency converting to (e.g., INR)').setRequired(true)),

  async executePrefix(message, args, client) {
    const amount = parseFloat(args[0]);
    const from = args[1]?.toUpperCase();
    const to = args[2]?.toUpperCase();

    if (isNaN(amount) || !from || !to) {
      return message.reply({ embeds: [error('Invalid arguments. Usage: `r?convert <amount> <from> <to>`\nExample: `r?convert 100 USD INR`')] });
    }

    await performConversion(message, amount, from, to, false);
  },

  async executeSlash(interaction, client) {
    const amount = interaction.options.getNumber('amount');
    const from = interaction.options.getString('from').toUpperCase();
    const to = interaction.options.getString('to').toUpperCase();

    await performConversion(interaction, amount, from, to, true);
  }
};

async function performConversion(context, amount, from, to, isInteraction) {
  if (isInteraction) {
    await context.deferReply();
  } else {
    await context.channel.sendTyping();
  }

  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${from}`);
    if (!res.ok) {
      const errMessage = 'Failed to fetch exchange rates. Make sure the currency code is correct.';
      if (isInteraction) return context.editReply({ embeds: [error(errMessage)] });
      return context.reply({ embeds: [error(errMessage)] });
    }

    const data = await res.json();
    if (data.result === 'error' || !data.rates) {
      const errMessage = `Error performing conversion. Make sure both currency codes are valid.`;
      if (isInteraction) return context.editReply({ embeds: [error(errMessage)] });
      return context.reply({ embeds: [error(errMessage)] });
    }

    const rate = data.rates[to];
    if (!rate) {
      const errMessage = `Target currency \`${to}\` is not supported.`;
      if (isInteraction) return context.editReply({ embeds: [error(errMessage)] });
      return context.reply({ embeds: [error(errMessage)] });
    }

    const converted = (amount * rate).toFixed(2);
    const embed = success(
      `💱 **Fiat Conversion Successful**\n\n` +
      `• **Original Amount:** \`${amount.toLocaleString()} ${from}\`\n` +
      `• **Converted Amount:** \`${parseFloat(converted).toLocaleString()} ${to}\`\n` +
      `• **Exchange Rate:** \`1 ${from} = ${rate.toFixed(4)} ${to}\``,
      `💱 Currency Converter`
    );

    if (isInteraction) return context.editReply({ embeds: [embed] });
    return context.reply({ embeds: [embed] });

  } catch (err) {
    console.error('Fiat conversion error:', err);
    const errMessage = 'An unexpected error occurred while performing conversion.';
    if (isInteraction) return context.editReply({ embeds: [error(errMessage)] });
    return context.reply({ embeds: [error(errMessage)] });
  }
}
