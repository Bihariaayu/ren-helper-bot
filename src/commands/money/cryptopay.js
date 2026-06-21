const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const PaymentConfig = require('../../database/models/PaymentConfig');
const { createEmbed, success, error, info } = require('../../utils/embedBuilder');

const cryptoMap = {
  'BTC': { id: 'bitcoin', name: 'Bitcoin', logo: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png' },
  'ETH': { id: 'ethereum', name: 'Ethereum', logo: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png' },
  'SOL': { id: 'solana', name: 'Solana', logo: 'https://assets.coingecko.com/coins/images/4128/large/solana.png' },
  'USDT': { id: 'tether', name: 'Tether', logo: 'https://assets.coingecko.com/coins/images/325/large/Tether.png' },
  'BNB': { id: 'binancecoin', name: 'BNB', logo: 'https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png' },
  'LTC': { id: 'litecoin', name: 'Litecoin', logo: 'https://assets.coingecko.com/coins/images/2/large/litecoin.png' },
  'XRP': { id: 'ripple', name: 'Ripple', logo: 'https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png' },
  'DOGE': { id: 'dogecoin', name: 'Dogecoin', logo: 'https://assets.coingecko.com/coins/images/325/large/dogecoin.png' }
};

module.exports = {
  name: 'cryptopay',
  description: 'Generate crypto payment requests.',
  slashData: new SlashCommandBuilder()
    .setName('cryptopay')
    .setDescription('Generate a Crypto QR payment request.')
    .addStringOption(opt => opt
      .setName('coin')
      .setDescription('Crypto coin to pay with')
      .setRequired(true)
      .addChoices(
        { name: 'BTC (Bitcoin)', value: 'BTC' },
        { name: 'ETH (Ethereum)', value: 'ETH' },
        { name: 'SOL (Solana)', value: 'SOL' },
        { name: 'USDT (Tether)', value: 'USDT' },
        { name: 'BNB (BNB)', value: 'BNB' },
        { name: 'LTC (Litecoin)', value: 'LTC' },
        { name: 'XRP (Ripple)', value: 'XRP' },
        { name: 'DOGE (Dogecoin)', value: 'DOGE' }
      )
    )
    .addNumberOption(opt => opt.setName('amount').setDescription('Crypto amount requested').setRequired(true)),

  async executePrefix(message, args, client) {
    const symbol = args[0]?.toUpperCase();
    const amount = parseFloat(args[1]);

    if (!symbol || !cryptoMap[symbol] || isNaN(amount) || amount <= 0) {
      return message.reply({ embeds: [error('Invalid arguments. Usage: `r?cryptopay <coin> <amount>`\nExample: `r?cryptopay BTC 0.005`')] });
    }

    await generateCryptoRequest(message, symbol, amount, false);
  },

  async executeSlash(interaction, client) {
    const symbol = interaction.options.getString('coin').toUpperCase();
    const amount = interaction.options.getNumber('amount');

    await generateCryptoRequest(interaction, symbol, amount, true);
  }
};

async function generateCryptoRequest(context, symbol, amount, isInteraction) {
  try {
    const guildId = context.guildId || context.guild.id;
    const config = await PaymentConfig.findOne({ guildId });
    const coinData = cryptoMap[symbol];

    const address = config?.cryptoAddresses?.get(symbol);
    if (!config || !address) {
      const errMsg = `The wallet address for **${symbol}** is not configured. Ask an Admin to run \`/setupcrypto\`.`;
      if (isInteraction) return context.reply({ embeds: [error(errMsg)], ephemeral: true });
      return context.reply({ embeds: [error(errMsg)] });
    }

    if (isInteraction) {
      await context.deferReply();
    } else {
      await context.channel.sendTyping();
    }

    // Fetch coin price to perform USD conversion
    let usdValueText = 'Calculating...';
    try {
      const priceRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinData.id}&vs_currencies=usd`);
      if (priceRes.ok) {
        const priceData = await priceRes.json();
        const coinPrice = priceData[coinData.id]?.usd;
        if (coinPrice) {
          const totalUsd = amount * coinPrice;
          usdValueText = `~$${totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
        }
      }
    } catch (e) {
      console.warn('CoinGecko price fetch failed for cryptopay:', e.message);
      usdValueText = 'Service unavailable';
    }

    const paymentId = 'PM-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Generate QR Code URL of the wallet address
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(address)}`;

    const payEmbed = info(
      `Send the exact crypto amount to the address below.\n\n` +
      `📦 **Wallet Address:**\n\`${address}\``,
      `☁️ Ren Cloud ${coinData.name} Payment`
    )
    .setImage(qrUrl)
    .setThumbnail(coinData.logo)
    .addFields([
      { name: '🪙 Cryptocurrency', value: `\`${coinData.name} (${symbol})\``, inline: true },
      { name: '🧾 Payment ID', value: `\`${paymentId}\``, inline: true },
      { name: '💰 Amount requested', value: `\`${amount} ${symbol}\``, inline: true },
      { name: '💵 USD Value (Est.)', value: `\`${usdValueText}\``, inline: true }
    ]);

    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`pay_proof_upload:${paymentId}:${symbol}:${amount}`)
        .setLabel('📸 Upload Payment Proof')
        .setStyle(ButtonStyle.Success)
    );

    if (isInteraction) {
      await context.editReply({ embeds: [payEmbed], components: [actionRow] });
    } else {
      await context.reply({ embeds: [payEmbed], components: [actionRow] });
    }

  } catch (err) {
    console.error('Error generating crypto request:', err);
    const errEmbed = error('Failed to generate crypto payment request.');
    if (isInteraction) return context.editReply({ embeds: [errEmbed] }).catch(() => null);
    return context.reply({ embeds: [errEmbed] }).catch(() => null);
  }
}
