const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const PaymentConfig = require('../../database/models/PaymentConfig');
const { success, error, info } = require('../../utils/embedBuilder');

const allowedCoins = ['BTC', 'ETH', 'SOL', 'USDT', 'BNB', 'LTC', 'XRP', 'DOGE'];

module.exports = {
  name: 'setupcrypto',
  description: 'Configure Crypto wallet addresses. (Admin Only)',
  slashData: new SlashCommandBuilder()
    .setName('setupcrypto')
    .setDescription('Configure crypto wallet address for payments.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt => opt
      .setName('coin')
      .setDescription('Cryptocurrency symbol')
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
    .addStringOption(opt => opt.setName('address').setDescription('Your wallet address').setRequired(true)),

  async executePrefix(message, args, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply({ embeds: [error('You must be an Administrator to run this command.')] });
    }

    const coin = args[0]?.toUpperCase();
    const address = args[1];

    if (!coin || !allowedCoins.includes(coin) || !address) {
      return message.reply({ embeds: [error(`Invalid arguments. Usage: \`r?setupcrypto <coin> <address>\`\nSupported coins: \`${allowedCoins.join(', ')}\``)] });
    }

    await saveCryptoConfig(message, coin, address, false);
  },

  async executeSlash(interaction, client) {
    const coin = interaction.options.getString('coin').toUpperCase();
    const address = interaction.options.getString('address');

    await saveCryptoConfig(interaction, coin, address, true);
  }
};

async function saveCryptoConfig(context, coin, address, isInteraction) {
  try {
    const guildId = context.guildId || context.guild.id;

    // Load config
    let config = await PaymentConfig.findOne({ guildId });
    if (!config) {
      config = new PaymentConfig({ guildId });
    }

    if (!config.cryptoAddresses) {
      config.cryptoAddresses = new Map();
    }

    config.cryptoAddresses.set(coin, address.trim());
    await config.save();

    const embed = success(
      `✅ **Crypto Wallet Configured!**\n\n` +
      `• **Coin:** \`${coin}\`\n` +
      `• **Wallet Address:** \`${address.trim()}\`\n\n` +
      `Users can now run \`/cryptopay ${coin.toLowerCase()} [amount]\` to make payments.`
    );

    if (isInteraction) return context.reply({ embeds: [embed] });
    return context.reply({ embeds: [embed] });

  } catch (err) {
    console.error('Error saving crypto config:', err);
    if (isInteraction) return context.reply({ embeds: [error('Failed to configure crypto wallet.')], ephemeral: true }).catch(() => null);
    return context.reply({ embeds: [error('Failed to configure crypto wallet.')] }).catch(() => null);
  }
}
