const { SlashCommandBuilder } = require('discord.js');
const { info } = require('../../utils/embedBuilder');
const config = require('../../config');

module.exports = {
  name: 'help',
  description: 'Displays a list of all available commands and their descriptions.',
  slashData: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Displays a list of all available commands.'),

  async executePrefix(message, args, client) {
    await sendHelp(message);
  },

  async executeSlash(interaction, client) {
    await sendHelp(interaction);
  }
};

async function sendHelp(context) {
  const invitePrefix = config.invitePrefix;
  const utilityPrefix = config.utilityPrefix;

  const helpEmbed = info(
    `Welcome to the **Ren Helper** user guide.\n\n` +
    `📌 **Prefix Guide**\n` +
    `📊 Invite System & Boosts → \`${invitePrefix}\`\n` +
    `⚙️ Utility & Management → \`${utilityPrefix}\`\n` +
    `💎 Modern Commands → \`/\` (Slash Commands)`,
    `☁️ Ren Helper - Command Help`
  )
  .addFields([
    {
      name: '🛡️ Moderation System',
      value: `• \`ban\` / \`unban\` / \`kick\` - Manage bans & kicks.\n` +
             `• \`timeout\` / \`untimeout\` - Temporary member lockouts.\n` +
             `• \`mute\` / \`unmute\` - Mute members using Muted role.\n` +
             `• \`warn\` / \`warnings\` - Issue warnings and manage cases.\n` +
             `• \`clear\` - Purge messages from channel.\n` +
             `• \`lock\` / \`unlock\` - Lockdown channel send permissions.\n` +
             `• \`giverole\` / \`removerole\` - Manage roles on members.\n` +
             `• \`nickname\` - Set or reset member nicknames.\n` +
             `• \`userinfo\` - Display profile data.`,
      inline: false
    },
    {
      name: '⚙️ Configuration & Setup',
      value: `• \`config\` - View current server settings.\n` +
             `• \`setup <subcommand>\` - Configure system channels & roles.`,
      inline: false
    },
    {
      name: '📥 Invite Tracking & Rewards',
      value: `• \`invites [@user]\` - Check user invite counts.\n` +
             `• \`inviter [@user]\` - Show who invited a member.\n` +
             `• \`leaderboard\` / \`topinvites\` - View top inviters.\n` +
             `• \`stats\` - View overall member/invite stats.\n` +
             `• \`analytics\` - View retention graph analytics.\n` +
             `• \`rewards\` / \`addreward\` / \`removereward\` - Manage invite milestone roles.\n` +
             `• \`setinvitechannel\` / \`removeinvitechannel\` - Set join/leave tracking channel.\n` +
             `• \`resetinvites <@user/all>\` - Reset invite data.`,
      inline: false
    },
    {
      name: '🤖 Auto Response System',
      value: `• \`ar create\` / \`edit\` / \`delete\` / \`list\` / \`view\` - Manage custom trigger words.`,
      inline: false
    },
    {
      name: '🎨 Interactive Embed Builder',
      value: `• \`embed create\` - Launches the button & modal embed designer.\n` +
             `• \`embed send <id> #chan\` - Sends a saved embed to a channel.`,
      inline: false
    },
    {
      name: '🚀 Server Booster Tracking',
      value: `• \`boosts [@user]\` - View user boost details.\n` +
             `• \`boostleaderboard\` - View server booster rankings.\n` +
             `• \`boosterrole\` / \`setboosterrole\` / \`removeboosterrole\` - Manage automated booster role.\n` +
             `• \`setboostchannel\` - Set channel for boost notification alerts.`,
      inline: false
    },
    {
      name: '📢 Owner Only Commands',
      value: `• \`dmall <message/embed:id>\` - Send direct broadcast to all server members.\n` +
             `• \`setstatus <status> <type> <name>\` - Change bot presence/status.`,
      inline: false
    }
  ])
  .setThumbnail(context.guild.iconURL({ dynamic: true }))
  .setTimestamp();

  await context.reply({ embeds: [helpEmbed] });
}
