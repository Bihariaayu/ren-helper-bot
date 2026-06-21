const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const GuildConfig = require('../../database/models/GuildConfig');
const { success, error } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');

module.exports = {
  name: 'setboostchannel',
  aliases: ['removeboostchannel'],
  description: 'Manage the channel where server boost notifications are sent.',
  slashData: new SlashCommandBuilder()
    .setName('setboostchannel')
    .setDescription('Set the boost announcement channel.')
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel for boost messages').setRequired(true).addChannelTypes(ChannelType.GuildText))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async executePrefix(message, args, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply({ embeds: [error('You must be an Administrator to use this command.')] });
    }

    const cmdTrigger = message.content.slice(require('../../config').defaultPrefix.length).trim().split(/ +/)[0].toLowerCase();

    if (cmdTrigger === 'removeboostchannel') {
      await removeBoostChannel(message);
      return;
    }

    const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]);
    if (!channel || channel.type !== ChannelType.GuildText) {
      return message.reply({ embeds: [error('Please mention a valid text channel. Usage: `-i setboostchannel #channel`')] });
    }

    await setBoostChannel(message, channel);
  },

  async executeSlash(interaction, client) {
    const channel = interaction.options.getChannel('channel');
    await setBoostChannel(interaction, channel);
  }
};

async function setBoostChannel(context, channel) {
  try {
    const guild = context.guild;
    const author = context.user || context.author;

    await GuildConfig.findOneAndUpdate(
      { guildId: guild.id },
      { $set: { boostChannelId: channel.id } },
      { upsert: true }
    );

    await context.reply({ embeds: [success(`Boost notifications channel has been set to ${channel}.`)] });
    logger.logToGuild(guild, 'Settings Updated', `Boost notifications channel set to ${channel} by ${author}`);
  } catch (err) {
    console.error('Error setting boost channel:', err);
    await context.reply({ embeds: [error('Failed to set boost channel.')], ephemeral: true }).catch(() => null);
  }
}

async function removeBoostChannel(context) {
  try {
    const guild = context.guild;
    const author = context.user || context.author;

    await GuildConfig.findOneAndUpdate(
      { guildId: guild.id },
      { $set: { boostChannelId: null } },
      { upsert: true }
    );

    await context.reply({ embeds: [success('Boost notifications channel configuration has been removed.')] });
    logger.logToGuild(guild, 'Settings Updated', `Boost notifications channel removed by ${author}`);
  } catch (err) {
    console.error('Error removing boost channel:', err);
    await context.reply({ embeds: [error('Failed to remove boost channel.')], ephemeral: true }).catch(() => null);
  }
}
