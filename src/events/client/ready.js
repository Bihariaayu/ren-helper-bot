const logger = require('../../utils/logger');
const { initializeCache } = require('../../utils/inviteCache');

module.exports = {
  once: true,
  async execute(client) {
    logger.info(`Bot logged in as ${client.user.tag} (${client.user.id})`);

    // Initialize invite cache
    await initializeCache(client);

    // Register slash commands
    await client.registerSlashCommands();

    // Set default presence
    const { ActivityType } = require('discord.js');
    client.user.setPresence({
      activities: [{ name: 'Managing Ren Cloud', type: ActivityType.Watching }],
      status: 'online'
    });

    logger.info('Ren Helper is now fully operational and listening.');
  }
};
