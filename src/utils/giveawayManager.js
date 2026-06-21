const Giveaway = require('../database/models/Giveaway');
const MemberInvite = require('../database/models/MemberInvite');
const { createEmbed, success, error, info } = require('./embedBuilder');
const logger = require('./logger');

let clientInstance = null;

const giveawayManager = {
  init: (client) => {
    clientInstance = client;
    // Check for ended giveaways every 30 seconds
    setInterval(() => giveawayManager.checkGiveaways(), 30000);
    logger.info('Giveaway Manager scheduler initialized.');
  },

  checkGiveaways: async () => {
    if (!clientInstance) return;
    try {
      const now = new Date();
      const pending = await Giveaway.find({ ended: false, endAt: { $lte: now } });
      for (const ga of pending) {
        await giveawayManager.endGiveaway(ga);
      }
    } catch (err) {
      logger.error('Error during automatic giveaway check:', err);
    }
  },

  endGiveaway: async (giveaway) => {
    try {
      giveaway.ended = true;
      await giveaway.save();

      const guild = clientInstance.guilds.cache.get(giveaway.guildId);
      if (!guild) return;

      const channel = await guild.channels.fetch(giveaway.channelId).catch(() => null);
      if (!channel) return;

      const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
      if (!message) return;

      const winners = await giveawayManager.pickWinners(giveaway, guild);
      giveaway.winners = winners;
      await giveaway.save();

      const editEmbed = createEmbed(message.embeds[0].data);
      
      let winnersText = '';
      if (winners.length === 0) {
        winnersText = '❌ No participants qualified / joined.';
        editEmbed.setDescription(
          `**Prize:** ${giveaway.prize}\n` +
          `**Winner Count:** ${giveaway.winnerCount}\n\n` +
          `⚠️ **Giveaway Ended:** No winners could be determined.`
        );
      } else {
        winnersText = winners.map(id => `<@${id}>`).join(', ');
        editEmbed.setDescription(
          `**Prize:** ${giveaway.prize}\n` +
          `**Winners:** ${winnersText}\n\n` +
          `🎉 **Giveaway Ended!**`
        );
      }
      
      await message.edit({ embeds: [editEmbed], components: [] });

      if (winners.length > 0) {
        await channel.send({
          content: `🎉 Congratulations ${winnersText}! You won **${giveaway.prize}**!`
        });
      } else {
        await channel.send({
          content: `⚠️ The giveaway for **${giveaway.prize}** ended with no winners.`
        });
      }

    } catch (err) {
      logger.error(`Error ending giveaway ${giveaway.messageId}:`, err);
    }
  },

  rerollGiveaway: async (giveaway, guild) => {
    try {
      if (giveaway.participants.length === 0) return [];
      const pool = await giveawayManager.buildWeightedPool(giveaway, guild);
      if (pool.length === 0) return [];

      const count = Math.min(giveaway.winnerCount, [...new Set(pool)].length);
      const winners = [];
      while (winners.length < count) {
        const pick = pool[Math.floor(Math.random() * pool.length)];
        if (!winners.includes(pick)) {
          winners.push(pick);
        }
      }

      giveaway.winners = winners;
      giveaway.ended = true;
      await giveaway.save();

      return winners;
    } catch (err) {
      logger.error(`Error rerolling giveaway ${giveaway.messageId}:`, err);
      return [];
    }
  },

  buildWeightedPool: async (giveaway, guild) => {
    const pool = [];
    for (const userId of giveaway.participants) {
      let weight = 1;
      const member = await guild.members.fetch(userId).catch(() => null);
      if (member && giveaway.bonusRoles && giveaway.bonusRoles.length > 0) {
        for (const br of giveaway.bonusRoles) {
          if (member.roles.cache.has(br.roleId)) {
            weight = Math.max(weight, br.multiplier);
          }
        }
      }
      for (let i = 0; i < weight; i++) {
        pool.push(userId);
      }
    }
    return pool;
  },

  pickWinners: async (giveaway, guild) => {
    const pool = await giveawayManager.buildWeightedPool(giveaway, guild);
    if (pool.length === 0) return [];

    const winners = [];
    const count = Math.min(giveaway.winnerCount, [...new Set(pool)].length);

    while (winners.length < count) {
      const pick = pool[Math.floor(Math.random() * pool.length)];
      if (!winners.includes(pick)) {
        winners.push(pick);
      }
    }
    return winners;
  },

  checkQualification: async (member, giveaway) => {
    // Check Role Requirements
    if (giveaway.roleRequirements && giveaway.roleRequirements.length > 0) {
      const hasRole = giveaway.roleRequirements.every(roleId => member.roles.cache.has(roleId));
      if (!hasRole) {
        return { qualified: false, reason: 'You do not have all required roles to join this giveaway.' };
      }
    }

    // Check Invite Requirements
    if (giveaway.inviteRequirements && giveaway.inviteRequirements > 0) {
      const inviteData = await MemberInvite.findOne({ guildId: member.guild.id, userId: member.id });
      const netInvites = inviteData ? (inviteData.joins - inviteData.left - inviteData.fakes + inviteData.bonus) : 0;
      if (netInvites < giveaway.inviteRequirements) {
        return { qualified: false, reason: `You need at least **${giveaway.inviteRequirements}** net invites. You currently have **${netInvites}**.` };
      }
    }

    return { qualified: true };
  }
};

module.exports = giveawayManager;
