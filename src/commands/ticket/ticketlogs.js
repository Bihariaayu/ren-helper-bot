const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const TicketConfig = require('../../database/models/TicketConfig');
const { success, error, info } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');

module.exports = {
  name: 'ticketlogs',
  aliases: ['setticketlogs'],
  description: 'Manage the dedicated ticket log channel.',
  slashData: new SlashCommandBuilder()
    .setName('ticketlogs')
    .setDescription('Manage the dedicated ticket log channel.')
    .addSubcommand(sub => sub
      .setName('view')
      .setDescription('View the current ticket logs channel.')
    )
    .addSubcommand(sub => sub
      .setName('set')
      .setDescription('Set the channel where ticket transcripts are sent.')
      .addChannelOption(opt => opt.setName('channel').setDescription('Log channel').setRequired(true).addChannelTypes(ChannelType.GuildText))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async executePrefix(message, args, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply({ embeds: [error('You must be an Administrator to use this command.')] });
    }

    const cmdTrigger = message.content.slice(require('../../config').utilityPrefix.length).trim().split(/ +/)[0].toLowerCase();

    if (cmdTrigger === 'setticketlogs') {
      const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]);
      if (!channel || channel.type !== ChannelType.GuildText) {
        return message.reply({ embeds: [error('Please mention a valid text channel. Usage: `r?setticketlogs #channel`')] });
      }
      await setTicketLogs(message, channel);
      return;
    }

    // Default: view current
    await viewTicketLogs(message);
  },

  async executeSlash(interaction, client) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'view') {
      await viewTicketLogs(interaction);
    } else if (sub === 'set') {
      const channel = interaction.options.getChannel('channel');
      await setTicketLogs(interaction, channel);
    }
  }
};

async function viewTicketLogs(context) {
  try {
    const configData = await TicketConfig.findOne({ guildId: context.guild.id });
    const logChanId = configData?.logChannelId;

    if (!logChanId) {
      return context.reply({ embeds: [info('No dedicated ticket log channel configured.', '🎫 Ticket Logs Configuration')] });
    }

    await context.reply({ embeds: [info(`Dedicated ticket logs are currently sent to <#${logChanId}>.`, '🎫 Ticket Logs Configuration')] });
  } catch (err) {
    console.error('Error viewing ticket logs config:', err);
    await context.reply({ embeds: [error('Failed to retrieve ticket logs config.')] }).catch(() => null);
  }
}

async function setTicketLogs(context, channel) {
  try {
    const guild = context.guild;
    const author = context.user || context.author;

    await TicketConfig.findOneAndUpdate(
      { guildId: guild.id },
      { $set: { logChannelId: channel.id } },
      { upsert: true }
    );

    await context.reply({ embeds: [success(`Ticket logs channel has been successfully set to ${channel}.`)] });
    logger.logToGuild(guild, 'Ticket Config Updated', `Ticket log channel set to ${channel} by ${author}`);
  } catch (err) {
    console.error('Error setting ticket logs:', err);
    await context.reply({ embeds: [error('Failed to set ticket logs channel.')] }).catch(() => null);
  }
}
