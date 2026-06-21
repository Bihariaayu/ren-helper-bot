const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const PaymentConfig = require('../../database/models/PaymentConfig');
const GuildConfig = require('../../database/models/GuildConfig');
const { success, error, info } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');

module.exports = {
  name: 'setpaymentchannel',
  aliases: ['paymentchannel', 'removepaymentchannel'],
  description: 'Manage the payment confirmation log channel.',
  slashData: new SlashCommandBuilder()
    .setName('paymentchannel')
    .setDescription('Manage the payment verification logs channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub
      .setName('set')
      .setDescription('Configure the payment logs channel.')
      .addChannelOption(opt => opt.setName('channel').setDescription('Channel for payment confirmations').setRequired(true).addChannelTypes(ChannelType.GuildText))
    )
    .addSubcommand(sub => sub.setName('view').setDescription('View the currently configured payment channel.'))
    .addSubcommand(sub => sub.setName('remove').setDescription('Remove the payment logs channel.')),

  async executePrefix(message, args, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply({ embeds: [error('You must be an Administrator to run this command.')] });
    }

    let prefix = 'r?';
    const guildConf = await GuildConfig.findOne({ guildId: message.guild.id }).catch(() => null);
    if (guildConf && guildConf.utilityPrefix) {
      prefix = guildConf.utilityPrefix;
    }

    const trigger = message.content.slice(prefix.length).trim().split(/\s+/)[0].toLowerCase();
    
    if (trigger === 'setpaymentchannel') {
      const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]);
      if (!channel || channel.type !== ChannelType.GuildText) {
        return message.reply({ embeds: [error('Please mention a valid text channel. Usage: `r?setpaymentchannel #channel`')] });
      }
      await setChannel(message, channel, false);
    } 
    else if (trigger === 'paymentchannel') {
      await viewChannel(message, false);
    } 
    else if (trigger === 'removepaymentchannel') {
      await removeChannel(message, false);
    }
  },

  async executeSlash(interaction, client) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'set') {
      const channel = interaction.options.getChannel('channel');
      await setChannel(interaction, channel, true);
    } 
    else if (sub === 'view') {
      await viewChannel(interaction, true);
    } 
    else if (sub === 'remove') {
      await removeChannel(interaction, true);
    }
  }
};

async function setChannel(context, channel, isInteraction) {
  try {
    const guildId = context.guildId || context.guild.id;
    await PaymentConfig.findOneAndUpdate(
      { guildId },
      { $set: { paymentChannelId: channel.id } },
      { upsert: true }
    );

    const embed = success(`Payment log channel has been successfully set to ${channel}. All customer submissions will route here for review.`);
    if (isInteraction) await context.reply({ embeds: [embed] });
    else await context.reply({ embeds: [embed] });
  } catch (err) {
    console.error(err);
    const embed = error('Failed to save payment channel configuration.');
    if (isInteraction) await context.reply({ embeds: [embed], ephemeral: true });
    else await context.reply({ embeds: [embed] });
  }
}

async function viewChannel(context, isInteraction) {
  try {
    const guildId = context.guildId || context.guild.id;
    const config = await PaymentConfig.findOne({ guildId });
    
    if (!config || !config.paymentChannelId) {
      const embed = info('No payment log channel has been configured yet. Submissions cannot be logged.', '💳 Payment Log Channel');
      if (isInteraction) return context.reply({ embeds: [embed] });
      return context.reply({ embeds: [embed] });
    }

    const embed = info(`The currently configured payment logs channel is <#${config.paymentChannelId}> (\`${config.paymentChannelId}\`).`, '💳 Payment Log Channel');
    if (isInteraction) return context.reply({ embeds: [embed] });
    return context.reply({ embeds: [embed] });
  } catch (err) {
    console.error(err);
    if (isInteraction) return context.reply({ embeds: [error('Failed to load settings.')], ephemeral: true });
    return context.reply({ embeds: [error('Failed to load settings.')] });
  }
}

async function removeChannel(context, isInteraction) {
  try {
    const guildId = context.guildId || context.guild.id;
    await PaymentConfig.findOneAndUpdate(
      { guildId },
      { $set: { paymentChannelId: null } }
    );

    const embed = success('Payment log channel configuration has been deleted.');
    if (isInteraction) await context.reply({ embeds: [embed] });
    else await context.reply({ embeds: [embed] });
  } catch (err) {
    console.error(err);
    if (isInteraction) return context.reply({ embeds: [error('Failed to remove settings.')], ephemeral: true });
    return context.reply({ embeds: [error('Failed to remove settings.')] });
  }
}
