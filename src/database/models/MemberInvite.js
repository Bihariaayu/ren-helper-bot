const mongoose = require('../localDb');

const MemberInviteSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  total: { type: Number, default: 0 },
  fake: { type: Number, default: 0 },
  left: { type: Number, default: 0 },
  rejoined: { type: Number, default: 0 },
  bonus: { type: Number, default: 0 }
});

MemberInviteSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('MemberInvite', MemberInviteSchema);
