const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const GuildConfig = require('../../database/models/GuildConfig');
const { success, error } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');

module.exports = {
  name: 'setinvitechannel',
  description: 'Sets the channel where invite join/leave logs will be sent.',
  slashData: new SlashCommandBuilder()
    .setName('setinvitechannel')
    .setDescription('Sets the channel for invite logs.')
    .addChannelOption(opt => opt.setName('channel').setDescription('The channel to send invite logs to').setRequired(true).addChannelTypes(ChannelType.GuildText))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async executePrefix(message, args, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply({ embeds: [error('You must be an Administrator to use this command.')] });
    }

    const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]);
    if (!channel || channel.type !== ChannelType.GuildText) {
      return message.reply({ embeds: [error('Please mention a valid text channel. Usage: `-i setinvitechannel #channel`')] });
    }

    await setInviteChannel(message, channel);
  },

  async executeSlash(interaction, client) {
    const channel = interaction.options.getChannel('channel');
    await setInviteChannel(interaction, channel);
  }
};

async function setInviteChannel(context, channel) {
  try {
    const guild = context.guild;
    const author = context.user || context.author;

    await GuildConfig.findOneAndUpdate(
      { guildId: guild.id },
      { $set: { inviteChannelId: channel.id } },
      { upsert: true }
    );

    const replyEmbed = success(`Invite tracking channel has been successfully set to ${channel}.`);
    
    if (context.deferred || context.replied) {
      await context.followUp({ embeds: [replyEmbed] });
    } else {
      await context.reply({ embeds: [replyEmbed] });
    }

    logger.logToGuild(guild, 'Settings Updated', `Invite tracking channel set to ${channel} by ${author}`);
  } catch (err) {
    console.error('Error setting invite channel:', err);
    if (typeof context.reply === 'function') {
      await context.reply({ embeds: [error('Failed to update invite tracking channel.')], ephemeral: true }).catch(() => null);
    }
  }
}
