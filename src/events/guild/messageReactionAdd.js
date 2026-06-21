const Giveaway = require('../../database/models/Giveaway');
const giveawayManager = require('../../utils/giveawayManager');
const logger = require('../../utils/logger');

module.exports = {
  once: false,
  async execute(reaction, user, client) {
    if (user.bot) return;

    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (err) {
        logger.error('Failed to fetch partial reaction:', err);
        return;
      }
    }

    if (reaction.message.partial) {
      try {
        await reaction.message.fetch();
      } catch (err) {
        logger.error('Failed to fetch partial message:', err);
        return;
      }
    }

    if (reaction.emoji.name !== '🎉') return;

    const giveaway = await Giveaway.findOne({ messageId: reaction.message.id, ended: false });
    if (!giveaway) return;

    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    const qual = await giveawayManager.checkQualification(member, giveaway);
    if (!qual.qualified) {
      await reaction.users.remove(user.id).catch(() => null);
      await user.send({
        content: `❌ You did not qualify to join the giveaway for **${giveaway.prize}** in **${guild.name}**.\nReason: ${qual.reason}`
      }).catch(() => null);
      return;
    }

    if (!giveaway.participants.includes(user.id)) {
      giveaway.participants.push(user.id);
      await giveaway.save();
      
      await user.send({
        content: `🎉 You have successfully joined the giveaway for **${giveaway.prize}** in **${guild.name}**!`
      }).catch(() => null);
    }
  }
};
