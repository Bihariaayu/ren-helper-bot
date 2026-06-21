const { MessageType } = require('discord.js');
const config = require('../../config');
const AutoResponse = require('../../database/models/AutoResponse');
const GuildConfig = require('../../database/models/GuildConfig');
const BoosterStats = require('../../database/models/BoosterStats');
const logger = require('../../utils/logger');
const { createEmbed, error } = require('../../utils/embedBuilder');

const arCooldowns = new Map();

// System message types for server boosting
const boostTypes = [
  MessageType.GuildBoost,
  MessageType.GuildBoostTier1,
  MessageType.GuildBoostTier2,
  MessageType.GuildBoostTier3
];

module.exports = {
  once: false,
  async execute(message, client) {
    if (!message.guild) return;

    // Check for Server Boost System Message
    if (boostTypes.includes(message.type)) {
      await handleBoostMessage(message);
      return;
    }

    // Ignore bots
    if (message.author.bot) return;

    // Check for Prefix Command
    let invitePrefix = config.invitePrefix;
    let utilityPrefix = config.utilityPrefix;

    const guildConf = await GuildConfig.findOne({ guildId: message.guild.id }).catch(() => null);
    if (guildConf) {
      if (guildConf.invitePrefix) invitePrefix = guildConf.invitePrefix;
      if (guildConf.utilityPrefix) utilityPrefix = guildConf.utilityPrefix;
    }

    let prefix = null;
    if (message.content.startsWith(invitePrefix)) {
      prefix = invitePrefix;
    } else if (message.content.startsWith(utilityPrefix)) {
      prefix = utilityPrefix;
    }

    if (prefix) {
      const args = message.content.slice(prefix.length).trim().split(/ +/);
      const commandName = args.shift().toLowerCase();

      const command = client.commands.get(commandName);
      if (command) {
        // Enforce prefix rules: invite/booster commands use -i, others use r?
        const isInviteCmd = command.category === 'invite' || command.category === 'booster';
        if (prefix === invitePrefix && !isInviteCmd) return;
        if (prefix === utilityPrefix && isInviteCmd) return;

        // Log command usage to guild log channel
        logger.logToGuild(
          message.guild, 
          'Command Usage', 
          `👤 **User:** ${message.author} (${message.author.tag})\n💬 **Command:** \`${message.content}\`\n📍 **Channel:** ${message.channel}`
        );

        try {
          await command.executePrefix(message, args, client);
        } catch (err) {
          logger.error(`Error executing prefix command ${commandName}`, err);
          message.reply({ embeds: [error('An unexpected error occurred while executing this command.')] }).catch(() => null);
        }
        return;
      }
    }

    // Process Auto-Responses
    await handleAutoResponses(message);
  }
};

/**
 * Handles server boost notifications and updates database stats
 * @param {import('discord.js').Message} message 
 */
async function handleBoostMessage(message) {
  const guild = message.guild;
  const booster = message.author;
  if (!booster) return;

  try {
    logger.info(`Received boost system message from ${booster.tag} in ${guild.name}`);

    // Update booster stats in database
    const boostStats = await BoosterStats.findOneAndUpdate(
      { guildId: guild.id, userId: booster.id },
      { 
        $inc: { boostCount: 1, totalBoosts: 1 },
        $setOnInsert: { boostSince: new Date() }
      },
      { upsert: true, new: true }
    );

    // Fetch guild config to find the boost channel
    const configData = await GuildConfig.findOne({ guildId: guild.id });
    if (configData && configData.boostChannelId) {
      const boostChannel = await guild.channels.fetch(configData.boostChannelId).catch(() => null);
      if (boostChannel) {
        const permissions = boostChannel.permissionsFor(guild.members.me);
        if (permissions && permissions.has(['SendMessages', 'EmbedLinks'])) {
          
          // Get server tier level
          let serverLevel = '0';
          if (guild.premiumTier === 'TIER_1') serverLevel = '1';
          else if (guild.premiumTier === 'TIER_2') serverLevel = '2';
          else if (guild.premiumTier === 'TIER_3') serverLevel = '3';

          const boostEmbed = createEmbed({
            title: '🚀 New Server Boost',
            description: `Thank you ${booster} for boosting **${guild.name}**!\nYou help support and grow our community.`,
            color: 'green', // Ren Cloud Green
            fields: [
              { name: 'Boost Count', value: `\`${guild.premiumSubscriptionCount || 1}\` boosts`, inline: true },
              { name: 'Server Level', value: `Level \`${serverLevel}\``, inline: true }
            ],
            thumbnail: booster.displayAvatarURL({ dynamic: true }),
            timestamp: true
          });

          await boostChannel.send({ embeds: [boostEmbed] });
        }
      }
    }

    // Log the boost event
    await logger.logToGuild(
      guild, 
      'Server Boost Notification', 
      `🚀 ${booster} (${booster.tag}) boosted the server! (Total active boosts: \`${boostStats.boostCount}\`)`
    );
  } catch (err) {
    logger.error('Error handling boost system message', err);
  }
}

/**
 * Checks message content against Auto-Response triggers
 * @param {import('discord.js').Message} message 
 */
async function handleAutoResponses(message) {
  try {
    const autoResponses = await AutoResponse.find({ guildId: message.guild.id });
    if (!autoResponses || autoResponses.length === 0) return;

    for (const ar of autoResponses) {
      let isMatch = false;
      const content = ar.isCaseInsensitive ? message.content.toLowerCase() : message.content;
      const trigger = ar.isCaseInsensitive ? ar.trigger.toLowerCase() : ar.trigger;

      // Channel restriction check
      if (ar.allowedChannels && ar.allowedChannels.length > 0) {
        if (!ar.allowedChannels.includes(message.channel.id)) continue;
      }

      // Match evaluation
      if (ar.isRegex) {
        try {
          const regexFlags = ar.isCaseInsensitive ? 'i' : '';
          const regex = new RegExp(ar.trigger, regexFlags);
          isMatch = regex.test(message.content);
        } catch (e) {
          continue;
        }
      } else {
        isMatch = (content.trim() === trigger.trim());
      }

      if (isMatch) {
        // Cooldown check
        const cooldownKey = `${message.guild.id}:${message.author.id}:${ar._id}`;
        const now = Date.now();
        if (arCooldowns.has(cooldownKey)) {
          const expirationTime = arCooldowns.get(cooldownKey) + (ar.cooldown * 1000);
          if (now < expirationTime) return;
        }

        // Apply cooldown
        if (ar.cooldown > 0) {
          arCooldowns.set(cooldownKey, now);
          setTimeout(() => arCooldowns.delete(cooldownKey), ar.cooldown * 1000);
        }

        // Send response
        if (ar.isEmbed && ar.embedData) {
          const responseEmbed = createEmbed(ar.embedData);
          await message.channel.send({ embeds: [responseEmbed] });
        } else {
          await message.channel.send(ar.response);
        }

        // Log auto response trigger
        logger.logToGuild(
          message.guild,
          'Auto Response Triggered',
          `👤 **User:** ${message.author} (${message.author.tag})\n📍 **Channel:** ${message.channel}\n🔑 **Trigger:** \`${ar.trigger}\``
        );
        break;
      }
    }
  } catch (err) {
    logger.error('Error handling auto-response', err);
  }
}
