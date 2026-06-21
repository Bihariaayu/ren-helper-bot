const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const GuildConfig = require('../../database/models/GuildConfig');
const { success, error, info } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');

module.exports = {
  name: 'boosterrole',
  aliases: ['setboosterrole', 'removeboosterrole'],
  description: 'Manage the automatic role granted to server boosters.',
  slashData: new SlashCommandBuilder()
    .setName('boosterrole')
    .setDescription('Manage booster role settings.')
    .addSubcommand(sub => sub
      .setName('view')
      .setDescription('View the currently configured booster role.')
    )
    .addSubcommand(sub => sub
      .setName('set')
      .setDescription('Configure the automatic booster role.')
      .addRoleOption(opt => opt.setName('role').setDescription('Role to grant boosters').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('Disable the automatic booster role feature.')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async executePrefix(message, args, client) {
    const cmdTrigger = message.content.slice(require('../../config').defaultPrefix.length).trim().split(/ +/)[0].toLowerCase();

    // 1. SET BOOSTER ROLE
    if (cmdTrigger === 'setboosterrole') {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply({ embeds: [error('You must be an Administrator to use this command.')] });
      }
      const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[0]);
      if (!role) {
        return message.reply({ embeds: [error('Please mention a valid role. Usage: `-i setboosterrole @role`')] });
      }
      await setBoosterRole(message, role);
      return;
    }

    // 2. REMOVE BOOSTER ROLE
    if (cmdTrigger === 'removeboosterrole') {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply({ embeds: [error('You must be an Administrator to use this command.')] });
      }
      await removeBoosterRole(message);
      return;
    }

    // 3. VIEW BOOSTER ROLE (default)
    await viewBoosterRole(message);
  },

  async executeSlash(interaction, client) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'view') {
      await viewBoosterRole(interaction);
    } else if (sub === 'set') {
      const role = interaction.options.getRole('role');
      await setBoosterRole(interaction, role);
    } else if (sub === 'remove') {
      await removeBoosterRole(interaction);
    }
  }
};

async function viewBoosterRole(context) {
  try {
    const guild = context.guild;
    const configData = await GuildConfig.findOne({ guildId: guild.id });
    
    const roleId = configData?.boosterRoleId;
    if (!roleId) {
      return context.reply({ embeds: [info('No booster role configured. Boosters will not receive any automated roles.', '🚀 Booster Role Configuration')] });
    }

    await context.reply({ embeds: [info(`Booster role is currently set to: <@&${roleId}>. Boosters will receive this role automatically.`, '🚀 Booster Role Configuration')] });
  } catch (err) {
    console.error('Error viewing booster role:', err);
    await context.reply({ embeds: [error('Failed to retrieve booster role configuration.')], ephemeral: true }).catch(() => null);
  }
}

async function setBoosterRole(context, role) {
  try {
    const guild = context.guild;
    const author = context.user || context.author;

    await GuildConfig.findOneAndUpdate(
      { guildId: guild.id },
      { $set: { boosterRoleId: role.id } },
      { upsert: true }
    );

    await context.reply({ embeds: [success(`Successfully configured booster role to ${role}.`)] });
    logger.logToGuild(guild, 'Settings Updated', `Booster role updated to ${role} by ${author}`);
  } catch (err) {
    console.error('Error setting booster role:', err);
    await context.reply({ embeds: [error('Failed to set booster role.')], ephemeral: true }).catch(() => null);
  }
}

async function removeBoosterRole(context) {
  try {
    const guild = context.guild;
    const author = context.user || context.author;

    await GuildConfig.findOneAndUpdate(
      { guildId: guild.id },
      { $set: { boosterRoleId: null } },
      { upsert: true }
    );

    await context.reply({ embeds: [success('Automatic booster role feature has been disabled.')] });
    logger.logToGuild(guild, 'Settings Updated', `Booster role feature disabled by ${author}`);
  } catch (err) {
    console.error('Error removing booster role:', err);
    await context.reply({ embeds: [error('Failed to remove booster role.')], ephemeral: true }).catch(() => null);
  }
}
