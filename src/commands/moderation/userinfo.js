const { SlashCommandBuilder, time } = require('discord.js');
const { info } = require('../../utils/embedBuilder');

module.exports = {
  name: 'userinfo',
  aliases: ['whois'],
  description: 'Displays detailed information about a server member.',
  slashData: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Displays detailed information about a member.')
    .addUserOption(opt => opt.setName('user').setDescription('The user to check').setRequired(false)),

  async executePrefix(message, args, client) {
    const target = message.mentions.users.first() || client.users.cache.get(args[0]) || message.author;
    await showUserInfo(message, target);
  },

  async executeSlash(interaction, client) {
    const target = interaction.options.getUser('user') || interaction.user;
    await showUserInfo(interaction, target);
  }
};

async function showUserInfo(context, target) {
  const guild = context.guild;
  
  try {
    const member = await guild.members.fetch(target.id).catch(() => null);
    
    let rolesStr = 'None';
    let joinDateStr = 'Not in server';
    let highestRole = 'None';
    let statusStr = target.bot ? '🤖 Bot' : '👤 User';

    if (member) {
      const roles = member.roles.cache.filter(r => r.id !== guild.id);
      rolesStr = roles.size > 0 ? roles.map(r => r.toString()).join(', ').substring(0, 1000) : 'None';
      joinDateStr = `${time(member.joinedAt, 'f')} (${time(member.joinedAt, 'R')})`;
      highestRole = member.roles.highest.toString();
    }

    const embed = info(
      `User profile and server membership details for **${target.tag}**.`,
      `👤 User Profile Details`
    )
    .addFields([
      { name: '👤 Username', value: `${target} (\`${target.tag}\`)`, inline: true },
      { name: '🆔 User ID', value: `\`${target.id}\``, inline: true },
      { name: '🚦 Account Type', value: statusStr, inline: true },
      { name: '📅 Created At', value: `${time(target.createdAt, 'f')} (${time(target.createdAt, 'R')})`, inline: false },
      { name: '📥 Joined Server', value: joinDateStr, inline: false },
      { name: '👑 Highest Role', value: highestRole, inline: true },
      { name: '🏷️ Server Roles', value: rolesStr, inline: false }
    ])
    .setThumbnail(target.displayAvatarURL({ dynamic: true }))
    .setTimestamp();

    await context.reply({ embeds: [embed] });
  } catch (err) {
    console.error('Error fetching user info:', err);
    await context.reply({ embeds: [error('Failed to load user information.')] }).catch(() => null);
  }
}
