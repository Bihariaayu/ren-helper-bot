const { SlashCommandBuilder, time } = require('discord.js');
const { info } = require('../../utils/embedBuilder');

module.exports = {
  name: 'serverinfo',
  description: 'Displays basic information about the server.',
  slashData: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Displays server info.'),

  async executePrefix(message, args, client) {
    await sendServerInfo(message);
  },

  async executeSlash(interaction, client) {
    await sendServerInfo(interaction);
  }
};

async function sendServerInfo(context) {
  const guild = context.guild;
  
  const embed = info(
    `Detailed information about **${guild.name}**.`,
    `ℹ️ Server Information`
  )
  .addFields([
    { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
    { name: '📅 Created At', value: `${time(guild.createdAt, 'f')} (${time(guild.createdAt, 'R')})`, inline: true },
    { name: '👥 Member Count', value: `\`${guild.memberCount}\` members`, inline: true },
    { name: '🚀 Boost Count', value: `\`${guild.premiumSubscriptionCount || 0}\` boosts (Level \`${guild.premiumTier.replace('TIER_', '') || '0'}\`)`, inline: true },
    { name: '🔮 Features', value: guild.features.length > 0 ? guild.features.map(f => `\`${f}\``).join(', ').substring(0, 1000) : 'None', inline: false }
  ])
  .setThumbnail(guild.iconURL({ dynamic: true }))
  .setTimestamp();

  await context.reply({ embeds: [embed] });
}
