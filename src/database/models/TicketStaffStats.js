const mongoose = require('mongoose');

const TicketStaffStatsSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  claimedCount: { type: Number, default: 0 },
  closedCount: { type: Number, default: 0 }
});

TicketStaffStatsSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('TicketStaffStats', TicketStaffStatsSchema);
