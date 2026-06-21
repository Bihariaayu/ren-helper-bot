const { SlashCommandBuilder } = require('discord.js');
const { info } = require('../../utils/embedBuilder');

module.exports = {
  name: 'website',
  description: 'Displays the link to the official Ren Cloud website.',
  slashData: new SlashCommandBuilder()
    .setName('website')
    .setDescription('Displays Ren Cloud website link.'),

  async executePrefix(message, args, client) {
    await message.reply({ embeds: [info('🌐 Visit the official website: [Ren Cloud](https://rencloud.org) (placeholder link)\nHosting and Cloud solutions built for everyone.', '🌐 Ren Cloud Website')] });
  },

  async executeSlash(interaction, client) {
    await interaction.reply({ embeds: [info('🌐 Visit the official website: [Ren Cloud](https://rencloud.org) (placeholder link)\nHosting and Cloud solutions built for everyone.', '🌐 Ren Cloud Website')] });
  }
};
