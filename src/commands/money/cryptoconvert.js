const { SlashCommandBuilder } = require('discord.js');
const { createEmbed, success, error, info } = require('../../utils/embedBuilder');

const cryptoMap = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'LTC': 'litecoin',
  'SOL': 'solana',
  'USDT': 'tether',
  'BNB': 'binancecoin',
  'XRP': 'ripple',
  'DOGE': 'dogecoin'
};

module.exports = {
  name: 'cryptoconvert',
  description: 'Convert crypto to fiat and vice versa.',
  slashData: new SlashCommandBuilder()
    .setName('cryptoconvert')
    .setDescription('Convert crypto to fiat or crypto.')
    .addNumberOption(opt => opt.setName('amount').setDescription('Amount to convert').setRequired(true))
    .addStringOption(opt => opt.setName('from').setDescription('Symbol converting from (e.g., BTC, USD)').setRequired(true))
    .addStringOption(opt => opt.setName('to').setDescription('Symbol converting to (e.g., INR, ETH)').setRequired(true)),

  async executePrefix(message, args, client) {
    const amount = parseFloat(args[0]);
    const from = args[1]?.toUpperCase();
    const to = args[2]?.toUpperCase();

    if (isNaN(amount) || !from || !to) {
      return message.reply({ embeds: [error('Invalid arguments. Usage: `r?cryptoconvert <amount> <from> <to>`\nExample: `r?cryptoconvert 0.5 BTC USD`')] });
    }

    await performCryptoConversion(message, amount, from, to, false);
  },

  async executeSlash(interaction, client) {
    const amount = interaction.options.getNumber('amount');
    const from = interaction.options.getString('from').toUpperCase();
    const to = interaction.options.getString('to').toUpperCase();

    await performCryptoConversion(interaction, amount, from, to, true);
  }
};

async function performCryptoConversion(context, amount, from, to, isInteraction) {
  if (isInteraction) {
    await context.deferReply();
  } else {
    await context.channel.sendTyping();
  }

  const fromCryptoId = cryptoMap[from];
  const toCryptoId = cryptoMap[to];

  if (!fromCryptoId && !toCryptoId) {
    const errMsg = 'This is a crypto converter. Please use at least one supported crypto coin (BTC, ETH, LTC, SOL, USDT, BNB, XRP, DOGE).';
    if (isInteraction) return context.editReply({ embeds: [error(errMsg)] });
    return context.reply({ embeds: [error(errMsg)] });
  }

  try {
    let converted = 0;
    let rateDetails = '';

    // Scenario 1: Crypto to Crypto (e.g. BTC to ETH)
    if (fromCryptoId && toCryptoId) {
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${fromCryptoId},${toCryptoId}&vs_currencies=usd`);
      if (!res.ok) throw new Error('CoinGecko API error');
      const data = await res.json();

      const fromPrice = data[fromCryptoId]?.usd;
      const toPrice = data[toCryptoId]?.usd;
      if (!fromPrice || !toPrice) throw new Error('Price details missing');

      converted = amount * (fromPrice / toPrice);
      rateDetails = `1 ${from} = ${(fromPrice / toPrice).toFixed(6)} ${to}`;
    }
    // Scenario 2: Crypto to Fiat (e.g. BTC to USD)
    else if (fromCryptoId && !toCryptoId) {
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${fromCryptoId}&vs_currencies=${to.toLowerCase()}`);
      if (!res.ok) throw new Error('CoinGecko API error');
      const data = await res.json();

      const price = data[fromCryptoId]?.[to.toLowerCase()];
      if (!price) {
        throw new Error(`Price or target currency \`${to}\` not found.`);
      }

      converted = amount * price;
      rateDetails = `1 ${from} = ${price.toLocaleString()} ${to}`;
    }
    // Scenario 3: Fiat to Crypto (e.g. USD to BTC)
    else if (!fromCryptoId && toCryptoId) {
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${toCryptoId}&vs_currencies=${from.toLowerCase()}`);
      if (!res.ok) throw new Error('CoinGecko API error');
      const data = await res.json();

      const price = data[toCryptoId]?.[from.toLowerCase()];
      if (!price) {
        throw new Error(`Price or base currency \`${from}\` not found.`);
      }

      converted = amount / price;
      rateDetails = `1 ${from} = ${(1 / price).toFixed(8)} ${to}`;
    }

    const formattedConverted = fromCryptoId && !toCryptoId ? converted.toFixed(2) : converted.toFixed(6);

    const embed = success(
      `🪙 **Crypto Conversion Successful**\n\n` +
      `• **Original:** \`${amount.toLocaleString()} ${from}\`\n` +
      `• **Converted:** \`${parseFloat(formattedConverted).toLocaleString()} ${to}\`\n` +
      `• **Rate:** \`${rateDetails}\``,
      `🪙 Crypto Converter`
    );

    if (isInteraction) return context.editReply({ embeds: [embed] });
    return context.reply({ embeds: [embed] });

  } catch (err) {
    console.error('Crypto conversion error:', err);
    const errMessage = 'Failed to perform crypto conversion. Verify the currency symbols are correct and try again later.';
    if (isInteraction) return context.editReply({ embeds: [error(errMessage)] });
    return context.reply({ embeds: [error(errMessage)] });
  }
}
