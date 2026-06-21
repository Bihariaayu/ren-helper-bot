const GuildConfig = require('../database/models/GuildConfig');
const { createEmbed } = require('./embedBuilder');

const logger = {
  info: (msg) => console.log(`[INFO] ${new Date().toISOString()}: ${msg}`),
  warn: (msg) => console.warn(`[WARNING] ${new Date().toISOString()}: ${msg}`),
  error: (msg, err) => console.error(`[ERROR] ${new Date().toISOString()}: ${msg}`, err || ''),

  /**
   * Logs a message or embed to the designated log channel of a guild
   * @param {import('discord.js').Guild} guild - The Discord guild
   * @param {string} logType - The type of log event (e.g. "Invite Join", "Command Usage")
   * @param {import('discord.js').EmbedBuilder|string} content - Embed or text content to send
   */
  logToGuild: async (guild, logType, content) => {
    if (!guild) return;

    // Only keep: Payment Logs, Invite Logs, Boost Logs, Moderation Logs
    const allowedTypes = [
      'invite join', 'invite leave', 'invite reward granted', 'invite reward revoked', 'invites reset', 'user invite reset',
      'new server boost', 'server boost ended', 'booster role granted', 'booster role revoked',
      'member banned', 'member unbanned', 'member kicked', 'messages cleared', 'channel locked', 'channel unlocked',
      'role given', 'role removed', 'member timed out', 'member untimed out', 'warning issued', 'warnings cleared',
      'member muted', 'member unmuted', 'nickname changed',
      'payment submission', 'payment approved', 'payment rejected'
    ];

    if (!allowedTypes.includes(logType.toLowerCase())) return;

    try {
      const config = await GuildConfig.findOne({ guildId: guild.id });
      if (!config || !config.logChannelId) return;

      const logChannel = await guild.channels.fetch(config.logChannelId).catch(() => null);
      if (!logChannel) return;

      // Ensure bot can send messages in the log channel
      const permissions = logChannel.permissionsFor(guild.members.me);
      if (!permissions || !permissions.has(['SendMessages', 'EmbedLinks'])) {
        logger.warn(`Missing permissions to log to channel ${logChannel.id} in guild ${guild.name}`);
        return;
      }

      if (typeof content === 'string') {
        const isNegative = logType.toLowerCase().match(/(ban|kick|timeout|warn|mute|reject|leave|ended|revoked)/i);
        const logColor = isNegative ? 'red' : 'green';
        const embed = createEmbed({
          title: `📝 ${logType}`,
          description: content,
          color: logColor,
          timestamp: true
        });
        await logChannel.send({ embeds: [embed] });
      } else {
        // If it's already an embed
        await logChannel.send({ embeds: [content] });
      }
    } catch (err) {
      logger.error(`Error sending log in guild ${guild.id}:`, err);
    }
  }
};

module.exports = logger;
