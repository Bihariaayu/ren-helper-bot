const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { info } = require('../../utils/embedBuilder');

module.exports = {
  name: 'ticketpanel',
  description: 'Sends a support ticket creation panel. (Administrator Only)',
  slashData: new SlashCommandBuilder()
    .setName('ticketpanel')
    .setDescription('Sends support ticket creation panel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async executePrefix(message, args, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply({ content: '❌ You must be an Administrator to run this command.' });
    }
    await sendTicketPanel(message);
  },

  async executeSlash(interaction, client) {
    await sendTicketPanel(interaction);
  }
};

async function sendTicketPanel(context) {
  const panelEmbed = info(
    `📩 Need assistance or have a question?\n` +
    `Click the button below to open a private support ticket.\n` +
    `Our staff team will respond as soon as possible.`,
    `📩 Ren Cloud Support Tickets`
  );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_create')
      .setLabel('📩 Create Ticket')
      .setStyle(ButtonStyle.Primary)
  );

  if (context.isChatInputCommand && context.isChatInputCommand()) {
    await context.reply({ content: '✅ Ticket panel sent.', ephemeral: true });
    await context.channel.send({ embeds: [panelEmbed], components: [row] });
  } else {
    await context.reply({ embeds: [panelEmbed], components: [row] });
  }
}
