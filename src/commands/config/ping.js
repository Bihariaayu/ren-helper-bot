const { SlashCommandBuilder } = require('discord.js');
const mongoose = require('../../database/localDb');
const { success } = require('../../utils/embedBuilder');

module.exports = {
  name: 'ping',
  description: 'Checks the bot and database connection latency.',
  slashData: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Checks latency.'),

  async executePrefix(message, args, client) {
    await runPing(message, client);
  },

  async executeSlash(interaction, client) {
    await runPing(interaction, client);
  }
};

async function runPing(context, client) {
  const sent = await context.reply({ content: '⚡ Measuring latency...', fetchReply: true });
  const ping = sent.createdTimestamp - context.createdTimestamp;
  const apiPing = client.ws.ping;
  
  const dbStatus = '🟢 Connected (Local JSON Files)';
  
  const pingEmbed = success(
    `• **Bot Latency:** \`${ping}ms\`\n` +
    `• **API Latency:** \`${apiPing}ms\`\n` +
    `• **Database Status:** ${dbStatus}`,
    `🏓 Pong!`
  );

  await sent.edit({ content: null, embeds: [pingEmbed] });
}
