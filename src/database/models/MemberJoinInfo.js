const mongoose = require('../localDb');

const MemberJoinInfoSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  inviterId: { type: String, default: null },
  inviteCode: { type: String, default: null },
  isFake: { type: Boolean, default: false },
  left: { type: Boolean, default: false },
  joinedAt: { type: Date, default: Date.now }
});

MemberJoinInfoSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('MemberJoinInfo', MemberJoinInfoSchema);
