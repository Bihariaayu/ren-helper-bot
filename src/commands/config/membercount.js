const { SlashCommandBuilder } = require('discord.js');
const { info } = require('../../utils/embedBuilder');

module.exports = {
  name: 'membercount',
  description: 'Displays the total number of members, humans, and bots in the server.',
  slashData: new SlashCommandBuilder()
    .setName('membercount')
    .setDescription('Displays member counts.'),

  async executePrefix(message, args, client) {
    await sendMemberCount(message);
  },

  async executeSlash(interaction, client) {
    await sendMemberCount(interaction);
  }
};

async function sendMemberCount(context) {
  const guild = context.guild;
  const members = await guild.members.fetch({ force: true }).catch(() => guild.members.cache);
  
  const total = guild.memberCount;
  const bots = members.filter(m => m.user.bot).size;
  const humans = total - bots;

  const embed = info(
    `👥 **Total Members:** \`${total}\`\n` +
    `👤 **Humans:** \`${humans}\`\n` +
    `🤖 **Bots:** \`${bots}\``,
    `👥 Server Member Count`
  );

  await context.reply({ embeds: [embed] });
}
