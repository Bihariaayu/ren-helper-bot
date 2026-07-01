const mongoose = require('../localDb');

const GiveawaySchema = new mongoose.Schema({
  messageId: { type: String, required: true, unique: true },
  channelId: { type: String, required: true },
  guildId: { type: String, required: true },
  prize: { type: String, required: true },
  winnerCount: { type: Number, required: true },
  endAt: { type: Date, required: true },
  participants: { type: [String], default: [] }, // Array of user IDs
  roleRequirements: { type: [String], default: [] }, // Role IDs allowed to enter
  inviteRequirements: { type: Number, default: 0 }, // Net invites needed to enter
  bonusRoles: [
    {
      roleId: { type: String },
      multiplier: { type: Number, default: 1 }
    }
  ],
  ended: { type: Boolean, default: false },
  winners: { type: [String], default: [] }
});

module.exports = mongoose.model('Giveaway', GiveawaySchema);
