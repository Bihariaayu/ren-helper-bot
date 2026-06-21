const GuildConfig = require('../../database/models/GuildConfig');
const BoosterStats = require('../../database/models/BoosterStats');
const logger = require('../../utils/logger');

module.exports = {
  once: false,
  async execute(oldMember, newMember, client) {
    const guild = newMember.guild;

    // Detect Server Boost Changes
    const oldBoost = oldMember.premiumSince;
    const newBoost = newMember.premiumSince;

    try {
      // 1. Started Boosting
      if (!oldBoost && newBoost) {
        logger.info(`${newMember.user.tag} started boosting guild ${guild.name}`);

        // Update database booster stats
        await BoosterStats.findOneAndUpdate(
          { guildId: guild.id, userId: newMember.id },
          { 
            $set: { boostSince: newBoost }
          },
          { upsert: true, new: true }
        );

        // Assign booster role automatically if configured
        const configData = await GuildConfig.findOne({ guildId: guild.id });
        if (configData && configData.boosterRoleId) {
          const boosterRole = guild.roles.cache.get(configData.boosterRoleId);
          if (boosterRole) {
            await newMember.roles.add(boosterRole).catch(err => {
              logger.warn(`Failed to add booster role ${boosterRole.name} to ${newMember.user.tag}: ${err.message}`);
            });
          }
        }

        // Log the event to log channel
        await logger.logToGuild(
          guild, 
          'Server Boost Started', 
          `🚀 ${newMember} (${newMember.user.tag}) has started boosting the server!`
        );
      }

      // 2. Stopped Boosting
      if (oldBoost && !newBoost) {
        logger.info(`${newMember.user.tag} stopped boosting guild ${guild.name}`);

        // Update database booster stats
        await BoosterStats.findOneAndUpdate(
          { guildId: guild.id, userId: newMember.id },
          { 
            $set: { boostSince: null, boostCount: 0 } 
          },
          { upsert: true }
        );

        // Remove booster role automatically if configured
        const configData = await GuildConfig.findOne({ guildId: guild.id });
        if (configData && configData.boosterRoleId) {
          const boosterRole = guild.roles.cache.get(configData.boosterRoleId);
          if (boosterRole) {
            await newMember.roles.remove(boosterRole).catch(err => {
              logger.warn(`Failed to remove booster role ${boosterRole.name} from ${newMember.user.tag}: ${err.message}`);
            });
          }
        }

        // Log the event to log channel
        await logger.logToGuild(
          guild, 
          'Server Boost Stopped', 
          `📉 ${newMember} (${newMember.user.tag}) has stopped boosting the server.`
        );
      }
    } catch (err) {
      logger.error(`Error in guildMemberUpdate handler for ${newMember.user.tag}`, err);
    }
  }
};
