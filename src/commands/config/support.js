const { SlashCommandBuilder } = require('discord.js');
const { info } = require('../../utils/embedBuilder');

module.exports = {
  name: 'support',
  description: 'Displays the link to the official Ren Cloud support server.',
  slashData: new SlashCommandBuilder()
    .setName('support')
    .setDescription('Displays support link.'),

  async executePrefix(message, args, client) {
    await message.reply({ embeds: [info('💬 Need assistance? Join our support channel: [Ren Cloud Support Server](https://discord.gg/rencloud) (placeholder link)\nOur team is available 24/7.', '💬 Ren Cloud Support')] });
  },

  async executeSlash(interaction, client) {
    await interaction.reply({ embeds: [info('💬 Need assistance? Join our support channel: [Ren Cloud Support Server](https://discord.gg/rencloud) (placeholder link)\nOur team is available 24/7.', '💬 Ren Cloud Support')] });
  }
};
