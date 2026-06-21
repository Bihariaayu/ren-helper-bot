const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const GuildConfig = require('../../database/models/GuildConfig');
const { success, error, info } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');

module.exports = {
  name: 'rewards',
  aliases: ['addreward', 'removereward'],
  description: 'Manage invite reward roles for invite milestones.',
  slashData: new SlashCommandBuilder()
    .setName('rewards')
    .setDescription('Manage invite reward roles.')
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('Lists all configured invite milestone rewards.')
    )
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('Adds a new invite milestone reward role.')
      .addIntegerOption(opt => opt.setName('invites').setDescription('Number of invites required').setRequired(true))
      .addRoleOption(opt => opt.setName('role').setDescription('Role to reward').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('Removes an invite milestone reward role.')
      .addIntegerOption(opt => opt.setName('invites').setDescription('Invites milestone to remove').setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async executePrefix(message, args, client) {
    const prefix = client.commands.get('rewards').name; // or check command trigger
    const cmdTrigger = message.content.slice(require('../../config').defaultPrefix.length).trim().split(/ +/)[0].toLowerCase();

    // 1. ADD REWARD
    if (cmdTrigger === 'addreward') {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply({ embeds: [error('You must be an Administrator to use this command.')] });
      }
      const invites = parseInt(args[0]);
      const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[1]);
      if (isNaN(invites) || invites <= 0 || !role) {
        return message.reply({ embeds: [error('Invalid arguments. Usage: `-i addreward <invites> @role`')] });
      }
      await addReward(message, invites, role);
      return;
    }

    // 2. REMOVE REWARD
    if (cmdTrigger === 'removereward') {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply({ embeds: [error('You must be an Administrator to use this command.')] });
      }
      const invites = parseInt(args[0]);
      if (isNaN(invites) || invites <= 0) {
        return message.reply({ embeds: [error('Invalid arguments. Usage: `-i removereward <invites>`')] });
      }
      await removeReward(message, invites);
      return;
    }

    // 3. LIST REWARDS (default rewards command)
    await listRewards(message);
  },

  async executeSlash(interaction, client) {
    const sub = interaction.options.getSubcommand();
    
    if (sub === 'list') {
      await listRewards(interaction);
    } else if (sub === 'add') {
      const invites = interaction.options.getInteger('invites');
      const role = interaction.options.getRole('role');
      await addReward(interaction, invites, role);
    } else if (sub === 'remove') {
      const invites = interaction.options.getInteger('invites');
      await removeReward(interaction, invites);
    }
  }
};

async function listRewards(context) {
  try {
    const guild = context.guild;
    const configData = await GuildConfig.findOne({ guildId: guild.id });
    
    if (!configData || !configData.inviteRewards || configData.inviteRewards.length === 0) {
      return context.reply({ embeds: [info('No invite reward roles configured in this server.', '🎁 Invite Reward Roles')] });
    }

    const sorted = configData.inviteRewards.sort((a, b) => a.invitesNeeded - b.invitesNeeded);
    let desc = 'When a member reaches a milestone, they automatically receive the associated role.\n\n';
    sorted.forEach(r => {
      desc += `• **${r.invitesNeeded} Invites:** <@&${r.roleId}> (ID: \`${r.roleId}\`)\n`;
    });

    const listEmbed = info(desc, '🎁 Invite Reward Roles');
    await context.reply({ embeds: [listEmbed] });
  } catch (err) {
    console.error('Error listing rewards:', err);
    await context.reply({ embeds: [error('Failed to retrieve invite rewards.')], ephemeral: true }).catch(() => null);
  }
}

async function addReward(context, invites, role) {
  try {
    const guild = context.guild;
    const author = context.user || context.author;

    let configData = await GuildConfig.findOne({ guildId: guild.id });
    if (!configData) {
      configData = new GuildConfig({ guildId: guild.id });
    }

    // Check if role is already rewarded or milestone already exists
    const existingMilestone = configData.inviteRewards.find(r => r.invitesNeeded === invites);
    if (existingMilestone) {
      existingMilestone.roleId = role.id;
    } else {
      configData.inviteRewards.push({ invitesNeeded: invites, roleId: role.id });
    }

    await configData.save();
    
    const replyEmbed = success(`Configured reward role ${role} for reaching **${invites}** invites.`);
    await context.reply({ embeds: [replyEmbed] });

    logger.logToGuild(guild, 'Settings Updated', `Invite reward added: **${invites}** invites -> ${role} by ${author}`);
  } catch (err) {
    console.error('Error adding reward:', err);
    await context.reply({ embeds: [error('Failed to configure invite reward role.')], ephemeral: true }).catch(() => null);
  }
}

async function removeReward(context, invites) {
  try {
    const guild = context.guild;
    const author = context.user || context.author;

    let configData = await GuildConfig.findOne({ guildId: guild.id });
    if (!configData || !configData.inviteRewards || configData.inviteRewards.length === 0) {
      return context.reply({ embeds: [error('No invite rewards configured to remove.')] });
    }

    const exists = configData.inviteRewards.some(r => r.invitesNeeded === invites);
    if (!exists) {
      return context.reply({ embeds: [error(`No reward milestone exists for **${invites}** invites.`)] });
    }

    configData.inviteRewards = configData.inviteRewards.filter(r => r.invitesNeeded !== invites);
    await configData.save();

    const replyEmbed = success(`Removed invite reward milestone for **${invites}** invites.`);
    await context.reply({ embeds: [replyEmbed] });

    logger.logToGuild(guild, 'Settings Updated', `Invite reward removed: milestone **${invites}** invites by ${author}`);
  } catch (err) {
    console.error('Error removing reward:', err);
    await context.reply({ embeds: [error('Failed to remove invite reward role.')], ephemeral: true }).catch(() => null);
  }
}
