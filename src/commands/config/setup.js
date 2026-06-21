const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const GuildConfig = require('../../database/models/GuildConfig');
const { success, error, info } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');

module.exports = {
  name: 'setup',
  description: 'Configure server settings for Ren Helper.',
  slashData: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure server settings for Ren Helper.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    
    // Subcommand: Channels
    .addSubcommand(sub => sub
      .setName('channels')
      .setDescription('Configure system channels.')
      .addChannelOption(opt => opt.setName('logs').setDescription('Channel for bot logs').addChannelTypes(ChannelType.GuildText))
      .addChannelOption(opt => opt.setName('invites').setDescription('Channel for invite join/leave tracking messages').addChannelTypes(ChannelType.GuildText))
      .addChannelOption(opt => opt.setName('welcome').setDescription('Channel for general welcome messages').addChannelTypes(ChannelType.GuildText))
      .addChannelOption(opt => opt.setName('boosts').setDescription('Channel for boost announcement messages').addChannelTypes(ChannelType.GuildText))
    )
    
    // Subcommand: Booster Role
    .addSubcommand(sub => sub
      .setName('boosterrole')
      .setDescription('Set the role given automatically to server boosters.')
      .addRoleOption(opt => opt.setName('role').setDescription('Booster role').setRequired(true))
    )
    
    // Subcommand: Embed Roles
    .addSubcommand(sub => sub
      .setName('embedrole')
      .setDescription('Manage roles allowed to build and send custom embeds.')
      .addStringOption(opt => opt.setName('action').setDescription('Add or remove role').setRequired(true).addChoices(
        { name: 'Add', value: 'add' },
        { name: 'Remove', value: 'remove' }
      ))
      .addRoleOption(opt => opt.setName('role').setDescription('Role to configure').setRequired(true))
    )
    
    // Subcommand: Prefix
    .addSubcommand(sub => sub
      .setName('prefix')
      .setDescription('Set custom command prefixes for this server.')
      .addStringOption(opt => opt.setName('invite').setDescription('New invite prefix (default: -i)').setRequired(false))
      .addStringOption(opt => opt.setName('utility').setDescription('New utility prefix (default: r?)').setRequired(false))
    ),

  async executePrefix(message, args, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply({ embeds: [error('You must be an Administrator to use this command.')] });
    }

    const sub = args[0]?.toLowerCase();
    if (!sub || sub === 'help') {
      const helpEmbed = info(
        `**Usage:**\n` +
        `• \`r?setup logchannel #channel\`\n` +
        `• \`r?setup invitechannel #channel\`\n` +
        `• \`r?setup welcomechannel #channel\`\n` +
        `• \`r?setup boostchannel #channel\`\n` +
        `• \`r?setup boosterrole @role\`\n` +
        `• \`r?setup embedrole add/remove @role\`\n` +
        `• \`r?setup inviteprefix <prefix>\`\n` +
        `• \`r?setup utilityprefix <prefix>\``,
        `⚙️ Ren Helper Setup Help`
      );
      return message.reply({ embeds: [helpEmbed] });
    }

    let configData = await GuildConfig.findOne({ guildId: message.guild.id });
    if (!configData) {
      configData = new GuildConfig({ guildId: message.guild.id });
    }

    // Handle Log Channel
    if (sub === 'logchannel') {
      const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]);
      if (!channel || channel.type !== ChannelType.GuildText) {
        return message.reply({ embeds: [error('Please mention a valid text channel.')] });
      }
      configData.logChannelId = channel.id;
      await configData.save();
      logger.logToGuild(message.guild, 'Settings Updated', `Log channel updated to ${channel} by ${message.author}`);
      return message.reply({ embeds: [success(`Log channel has been set to ${channel}.`)] });
    }

    // Handle Invite Channel
    if (sub === 'invitechannel') {
      const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]);
      if (!channel || channel.type !== ChannelType.GuildText) {
        return message.reply({ embeds: [error('Please mention a valid text channel.')] });
      }
      configData.inviteChannelId = channel.id;
      await configData.save();
      logger.logToGuild(message.guild, 'Settings Updated', `Invite tracking channel updated to ${channel} by ${message.author}`);
      return message.reply({ embeds: [success(`Invite tracking channel has been set to ${channel}.`)] });
    }

    // Handle Welcome Channel
    if (sub === 'welcomechannel') {
      const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]);
      if (!channel || channel.type !== ChannelType.GuildText) {
        return message.reply({ embeds: [error('Please mention a valid text channel.')] });
      }
      configData.welcomeChannelId = channel.id;
      await configData.save();
      logger.logToGuild(message.guild, 'Settings Updated', `Welcome channel updated to ${channel} by ${message.author}`);
      return message.reply({ embeds: [success(`Welcome channel has been set to ${channel}.`)] });
    }

    // Handle Boost Channel
    if (sub === 'boostchannel') {
      const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]);
      if (!channel || channel.type !== ChannelType.GuildText) {
        return message.reply({ embeds: [error('Please mention a valid text channel.')] });
      }
      configData.boostChannelId = channel.id;
      await configData.save();
      logger.logToGuild(message.guild, 'Settings Updated', `Boost channel updated to ${channel} by ${message.author}`);
      return message.reply({ embeds: [success(`Boost channel has been set to ${channel}.`)] });
    }

    // Handle Booster Role
    if (sub === 'boosterrole') {
      const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[1]);
      if (!role) {
        return message.reply({ embeds: [error('Please mention a valid role.')] });
      }
      configData.boosterRoleId = role.id;
      await configData.save();
      logger.logToGuild(message.guild, 'Settings Updated', `Booster role updated to ${role} by ${message.author}`);
      return message.reply({ embeds: [success(`Booster role has been set to ${role}.`)] });
    }

    // Handle Embed Role
    if (sub === 'embedrole') {
      const action = args[1]?.toLowerCase();
      const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[2]);
      if (action !== 'add' && action !== 'remove') {
        return message.reply({ embeds: [error('Please specify action `add` or `remove`. Usage: `-i setup embedrole add/remove @role`')] });
      }
      if (!role) {
        return message.reply({ embeds: [error('Please mention a valid role.')] });
      }

      if (action === 'add') {
        if (configData.embedRoles.includes(role.id)) {
          return message.reply({ embeds: [error('This role is already configured.')] });
        }
        configData.embedRoles.push(role.id);
        await configData.save();
        logger.logToGuild(message.guild, 'Settings Updated', `Added ${role} to embed roles by ${message.author}`);
        return message.reply({ embeds: [success(`Successfully added ${role} to embed roles.`)] });
      } else {
        if (!configData.embedRoles.includes(role.id)) {
          return message.reply({ embeds: [error('This role is not in the list.')] });
        }
        configData.embedRoles = configData.embedRoles.filter(id => id !== role.id);
        await configData.save();
        logger.logToGuild(message.guild, 'Settings Updated', `Removed ${role} from embed roles by ${message.author}`);
        return message.reply({ embeds: [success(`Successfully removed ${role} from embed roles.`)] });
      }
    }

    // Handle Invite Prefix
    if (sub === 'inviteprefix') {
      const newPrefix = args[1]?.trim();
      if (!newPrefix) {
        return message.reply({ embeds: [error('Please provide a new prefix. Usage: `r?setup inviteprefix <prefix>`')] });
      }
      configData.invitePrefix = newPrefix;
      await configData.save();
      logger.logToGuild(message.guild, 'Settings Updated', `Invite tracking prefix updated to \`${newPrefix}\` by ${message.author}`);
      return message.reply({ embeds: [success(`Invite tracking prefix has been set to \`${newPrefix}\`.`)] });
    }

    // Handle Utility Prefix
    if (sub === 'utilityprefix') {
      const newPrefix = args[1]?.trim();
      if (!newPrefix) {
        return message.reply({ embeds: [error('Please provide a new prefix. Usage: `r?setup utilityprefix <prefix>`')] });
      }
      configData.utilityPrefix = newPrefix;
      await configData.save();
      logger.logToGuild(message.guild, 'Settings Updated', `Utility & management prefix updated to \`${newPrefix}\` by ${message.author}`);
      return message.reply({ embeds: [success(`Utility & management prefix has been set to \`${newPrefix}\`.`)] });
    }

    return message.reply({ embeds: [error('Unknown subcommand. Use `r?setup help` for options.')] });
  },

  async executeSlash(interaction, client) {
    const sub = interaction.options.getSubcommand();
    let configData = await GuildConfig.findOne({ guildId: interaction.guild.id });
    if (!configData) {
      configData = new GuildConfig({ guildId: interaction.guild.id });
    }

    try {
      // 1. Channels Subcommand
      if (sub === 'channels') {
        const logs = interaction.options.getChannel('logs');
        const invites = interaction.options.getChannel('invites');
        const welcome = interaction.options.getChannel('welcome');
        const boosts = interaction.options.getChannel('boosts');

        let updated = false;
        let changeLog = [];

        if (logs) {
          configData.logChannelId = logs.id;
          changeLog.push(`Log channel: ${logs}`);
          updated = true;
        }
        if (invites) {
          configData.inviteChannelId = invites.id;
          changeLog.push(`Invite channel: ${invites}`);
          updated = true;
        }
        if (welcome) {
          configData.welcomeChannelId = welcome.id;
          changeLog.push(`Welcome channel: ${welcome}`);
          updated = true;
        }
        if (boosts) {
          configData.boostChannelId = boosts.id;
          changeLog.push(`Boost channel: ${boosts}`);
          updated = true;
        }

        if (!updated) {
          return interaction.reply({ embeds: [error('Please provide at least one channel option to configure.')], ephemeral: true });
        }

        await configData.save();
        logger.logToGuild(interaction.guild, 'Settings Updated', `Channels updated by ${interaction.user}:\n` + changeLog.join('\n'));
        return interaction.reply({ embeds: [success(`Successfully updated configured channels:\n${changeLog.join('\n')}`)] });
      }

      // 2. Booster Role Subcommand
      if (sub === 'boosterrole') {
        const role = interaction.options.getRole('role');
        configData.boosterRoleId = role.id;
        await configData.save();
        logger.logToGuild(interaction.guild, 'Settings Updated', `Booster role updated to ${role} by ${interaction.user}`);
        return interaction.reply({ embeds: [success(`Successfully configured booster role to ${role}.`)] });
      }

      // 3. Embed Role Subcommand
      if (sub === 'embedrole') {
        const action = interaction.options.getString('action');
        const role = interaction.options.getRole('role');

        if (action === 'add') {
          if (configData.embedRoles.includes(role.id)) {
            return interaction.reply({ embeds: [error(`Role ${role} is already in the authorized embed builder list.`)], ephemeral: true });
          }
          configData.embedRoles.push(role.id);
          await configData.save();
          logger.logToGuild(interaction.guild, 'Settings Updated', `Authorized embed builder role ${role} by ${interaction.user}`);
          return interaction.reply({ embeds: [success(`Added ${role} to authorized embed builder roles.`)] });
        } else {
          if (!configData.embedRoles.includes(role.id)) {
            return interaction.reply({ embeds: [error(`Role ${role} is not in the authorized list.`)], ephemeral: true });
          }
          configData.embedRoles = configData.embedRoles.filter(id => id !== role.id);
          await configData.save();
          logger.logToGuild(interaction.guild, 'Settings Updated', `Revoked embed builder role ${role} by ${interaction.user}`);
          return interaction.reply({ embeds: [success(`Removed ${role} from authorized embed builder roles.`)] });
        }
      }

      // 4. Prefix Subcommand
      if (sub === 'prefix') {
        const invite = interaction.options.getString('invite');
        const utility = interaction.options.getString('utility');

        let updated = false;
        let changeLog = [];

        if (invite) {
          configData.invitePrefix = invite;
          changeLog.push(`Invite Prefix: \`${invite}\``);
          updated = true;
        }
        if (utility) {
          configData.utilityPrefix = utility;
          changeLog.push(`Utility Prefix: \`${utility}\``);
          updated = true;
        }

        if (!updated) {
          return interaction.reply({ embeds: [error('Please provide at least one prefix option to configure.')], ephemeral: true });
        }

        await configData.save();
        logger.logToGuild(interaction.guild, 'Settings Updated', `Prefixes updated by ${interaction.user}:\n` + changeLog.join('\n'));
        return interaction.reply({ embeds: [success(`Successfully updated configured prefixes:\n${changeLog.join('\n')}`)] });
      }
    } catch (err) {
      console.error('Error during setup execution:', err);
      return interaction.reply({ embeds: [error('Failed to update configurations.')], ephemeral: true });
    }
  }
};
