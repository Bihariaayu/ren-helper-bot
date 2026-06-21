const Giveaway = require('../../database/models/Giveaway');

module.exports = {
  once: false,
  async execute(reaction, user, client) {
    if (user.bot) return;

    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (err) {
        return;
      }
    }

    if (reaction.message.partial) {
      try {
        await reaction.message.fetch();
      } catch (err) {
        return;
      }
    }

    if (reaction.emoji.name !== '🎉') return;

    const giveaway = await Giveaway.findOne({ messageId: reaction.message.id, ended: false });
    if (!giveaway) return;

    if (giveaway.participants.includes(user.id)) {
      giveaway.participants = giveaway.participants.filter(id => id !== user.id);
      await giveaway.save();
      
      await user.send({
        content: `ℹ️ You have left the giveaway for **${giveaway.prize}** in **${reaction.message.guild.name}** because you removed your reaction.`
      }).catch(() => null);
    }
  }
};
