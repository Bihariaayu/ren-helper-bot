const logger = require('./logger');

const inviteCache = new Map();

/**
 * Caches all invites for a single guild
 * @param {import('discord.js').Guild} guild 
 */
async function cacheGuildInvites(guild) {
  try {
    const me = guild.members.me;
    if (!me || !me.permissions.has('ManageGuild')) {
      logger.warn(`Missing 'ManageGuild' permission to cache invites in guild ${guild.name} (${guild.id})`);
      return;
    }

    const invites = await guild.invites.fetch().catch(() => null);
    const guildCache = {
      invites: new Map(),
      vanityUses: 0
    };

    if (invites) {
      for (const invite of invites.values()) {
        guildCache.invites.set(invite.code, invite.uses);
      }
    }

    if (guild.vanityURLCode) {
      // Discord.js v14 stores vanityURLUses on guild, but it may require fetching
      const fetchedGuild = await guild.fetch().catch(() => guild);
      guildCache.vanityUses = fetchedGuild.vanityURLUses || 0;
    }

    inviteCache.set(guild.id, guildCache);
  } catch (err) {
    logger.error(`Error caching invites for guild ${guild.id}`, err);
  }
}

/**
 * Finds the invite that was used for a new member join and updates the cache
 * @param {import('discord.js').Guild} guild 
 * @returns {Promise<object|null>} The invite used (or vanity URL mock object), or null
 */
async function findUsedInvite(guild) {
  try {
    const me = guild.members.me;
    if (!me || !me.permissions.has('ManageGuild')) return null;

    const currentInvites = await guild.invites.fetch().catch(() => null);
    const cached = inviteCache.get(guild.id);

    if (!cached) {
      // No cache existed, perform initial cache and return null
      await cacheGuildInvites(guild);
      return null;
    }

    let usedInvite = null;

    if (currentInvites) {
      for (const invite of currentInvites.values()) {
        const cachedUses = cached.invites.get(invite.code) || 0;
        if (invite.uses > cachedUses) {
          usedInvite = {
            code: invite.code,
            uses: invite.uses,
            inviter: invite.inviter ? { id: invite.inviter.id, tag: invite.inviter.tag } : null
          };
          break;
        }
      }
    }

    // If no normal invite matched, check if Vanity URL uses increased
    if (!usedInvite && guild.vanityURLCode) {
      const fetchedGuild = await guild.fetch().catch(() => guild);
      const currentVanityUses = fetchedGuild.vanityURLUses || 0;
      if (currentVanityUses > cached.vanityUses) {
        usedInvite = {
          code: guild.vanityURLCode,
          uses: currentVanityUses,
          inviter: { id: 'VANITY_URL', tag: 'Vanity URL' }
        };
      }
    }

    // Refresh cache with new values
    const newInvites = new Map();
    if (currentInvites) {
      for (const invite of currentInvites.values()) {
        newInvites.set(invite.code, invite.uses);
      }
    }
    
    let newVanityUses = 0;
    if (guild.vanityURLCode) {
      const fetchedGuild = await guild.fetch().catch(() => guild);
      newVanityUses = fetchedGuild.vanityURLUses || 0;
    }

    inviteCache.set(guild.id, {
      invites: newInvites,
      vanityUses: newVanityUses
    });

    return usedInvite;
  } catch (err) {
    logger.error(`Error finding used invite for guild ${guild.id}`, err);
    return null;
  }
}

/**
 * Initializes the invite cache for all guilds the client is currently in
 * @param {import('discord.js').Client} client 
 */
async function initializeCache(client) {
  logger.info('Initializing invite cache for all guilds...');
  for (const guild of client.guilds.cache.values()) {
    await cacheGuildInvites(guild);
  }
  logger.info('Invite cache initialization completed.');
}

module.exports = {
  cacheGuildInvites,
  findUsedInvite,
  initializeCache,
  inviteCacheMap: inviteCache
};
