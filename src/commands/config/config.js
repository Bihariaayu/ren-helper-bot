const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const GuildConfig = require('../../database/models/GuildConfig');
const { info, error } = require('../../utils/embedBuilder');

module.exports = {
  name: 'config',
  description: 'Displays the current server configurations.',
  slashData: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Displays the current server configurations.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async executePrefix(message, args, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply({ embeds: [error('You must be an Administrator to use this command.')] });
    }
    await showConfig(message, message.guild);
  },

  async executeSlash(interaction, client) {
    await showConfig(interaction, interaction.guild);
  }
};

async function showConfig(context, guild) {
  try {
    let configData = await GuildConfig.findOne({ guildId: guild.id });
    if (!configData) {
      configData = await GuildConfig.create({ guildId: guild.id });
    }

    const logChan = configData.logChannelId ? `<#${configData.logChannelId}>` : '❌ Not Configured';
    const invChan = configData.inviteChannelId ? `<#${configData.inviteChannelId}>` : '❌ Not Configured';
    const welcomeChan = configData.welcomeChannelId ? `<#${configData.welcomeChannelId}>` : '❌ Not Configured';
    const boostChan = configData.boostChannelId ? `<#${configData.boostChannelId}>` : '❌ Not Configured';
    const boosterRole = configData.boosterRoleId ? `<@&${configData.boosterRoleId}>` : '❌ Not Configured';
    
    let embedRolesStr = '❌ Administrators Only';
    if (configData.embedRoles && configData.embedRoles.length > 0) {
      embedRolesStr = configData.embedRoles.map(id => `<@&${id}>`).join(', ');
    }

    let rewardsStr = '❌ No invite rewards configured.';
    if (configData.inviteRewards && configData.inviteRewards.length > 0) {
      rewardsStr = configData.inviteRewards
        .sort((a, b) => a.invitesNeeded - b.invitesNeeded)
        .map(r => `• **${r.invitesNeeded} Invites:** <@&${r.roleId}>`)
        .join('\n');
    }

    const invitePref = configData.invitePrefix || '-i';
    const utilityPref = configData.utilityPrefix || 'r?';

    const configEmbed = info(
      `Here is the current configuration for **${guild.name}**. Use \`/setup\` or prefix commands to modify these settings.`,
      `⚙️ Server Configuration`
    ).addFields([
      { name: '📂 System Channels', value: `**Logs:** ${logChan}\n**Invite Tracking:** ${invChan}\n**Welcome messages:** ${welcomeChan}\n**Boost messages:** ${boostChan}`, inline: false },
      { name: '🚀 Server Booster Settings', value: `**Auto Booster Role:** ${boosterRole}`, inline: true },
      { name: '🎨 Embed Builder Roles', value: embedRolesStr, inline: true },
      { name: '📌 Command Prefixes', value: `**📊 Invite System:** \`${invitePref}\`\n**⚙️ Utility & Mgmt:** \`${utilityPref}\``, inline: false },
      { name: '🎁 Invite Rewards', value: rewardsStr, inline: false }
    ]);

    if (context.deferred || context.replied) {
      await context.followUp({ embeds: [configEmbed] });
    } else if (typeof context.reply === 'function') {
      await context.reply({ embeds: [configEmbed] });
    }
  } catch (err) {
    console.error('Error fetching config:', err);
    if (typeof context.reply === 'function') {
      await context.reply({ embeds: [error('Failed to load server configurations.')], ephemeral: true }).catch(() => null);
    }
  }
}
