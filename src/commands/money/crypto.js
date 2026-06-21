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
  name: 'crypto',
  description: 'Display live crypto market information.',
  slashData: new SlashCommandBuilder()
    .setName('crypto')
    .setDescription('Get live crypto statistics.')
    .addStringOption(opt => opt
      .setName('coin')
      .setDescription('The crypto coin symbol (e.g. BTC, ETH)')
      .setRequired(true)
      .addChoices(
        { name: 'BTC (Bitcoin)', value: 'BTC' },
        { name: 'ETH (Ethereum)', value: 'ETH' },
        { name: 'LTC (Litecoin)', value: 'LTC' },
        { name: 'SOL (Solana)', value: 'SOL' },
        { name: 'USDT (Tether)', value: 'USDT' },
        { name: 'BNB (Binance Coin)', value: 'BNB' },
        { name: 'XRP (Ripple)', value: 'XRP' },
        { name: 'DOGE (Dogecoin)', value: 'DOGE' }
      )
    ),

  async executePrefix(message, args, client) {
    const symbol = args[0]?.toUpperCase();
    if (!symbol || !cryptoMap[symbol]) {
      return message.reply({ embeds: [error('Invalid coin. Supported coins: `BTC`, `ETH`, `LTC`, `SOL`, `USDT`, `BNB`, `XRP`, `DOGE`')] });
    }

    await getCryptoStats(message, symbol, false);
  },

  async executeSlash(interaction, client) {
    const symbol = interaction.options.getString('coin').toUpperCase();
    await getCryptoStats(interaction, symbol, true);
  }
};

async function getCryptoStats(context, symbol, isInteraction) {
  if (isInteraction) {
    await context.deferReply();
  } else {
    await context.channel.sendTyping();
  }

  const coinId = cryptoMap[symbol];

  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${coinId}`);
    if (!res.ok) throw new Error('CoinGecko API error');

    const data = await res.json();
    const coinData = data[0];
    if (!coinData) throw new Error('Coin data not found');

    const price = coinData.current_price;
    const change24h = coinData.price_change_percentage_24h;
    const cap = coinData.market_cap;
    const volume = coinData.total_volume;
    const rank = coinData.market_cap_rank;
    const logoUrl = coinData.image;

    const changeEmoji = change24h >= 0 ? '📈' : '📉';
    const changeText = `${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%`;

    const statsEmbed = info(
      `Live market statistics for **${coinData.name} (${symbol})**.`,
      `📊 ${coinData.name} Statistics`
    )
    .setThumbnail(logoUrl)
    .addFields([
      { name: '💰 Current Price', value: `\`$${price.toLocaleString()}\` USD`, inline: true },
      { name: `${changeEmoji} 24h Change`, value: `\`${changeText}\``, inline: true },
      { name: '🚀 Market Cap Rank', value: `\`#${rank}\``, inline: true },
      { name: '📉 Market Capitalization', value: `\`$${cap.toLocaleString()}\` USD`, inline: false },
      { name: '💵 24h Trading Volume', value: `\`$${volume.toLocaleString()}\` USD`, inline: false }
    ]);

    if (isInteraction) return context.editReply({ embeds: [statsEmbed] });
    return context.reply({ embeds: [statsEmbed] });

  } catch (err) {
    console.error('Crypto stats error:', err);
    const errMessage = `Failed to retrieve crypto stats for ${symbol}. Please try again later.`;
    if (isInteraction) return context.editReply({ embeds: [error(errMessage)] });
    return context.reply({ embeds: [error(errMessage)] });
  }
}
