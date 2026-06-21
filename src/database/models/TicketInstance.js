const mongoose = require('mongoose');

const TicketInstanceSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  userId: { type: String, required: true },
  caseId: { type: String, required: true },
  status: { type: String, default: 'open' }, // 'open', 'closed'
  claimedBy: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  closedAt: { type: Date, default: null },
  claimedAt: { type: Date, default: null },
  closedBy: { type: String, default: null },
  closeReason: { type: String, default: null },
  durationSeconds: { type: Number, default: 0 },
  transcriptUrl: { type: String, default: null },
  rating: { type: Number, default: null } // Satisfaction score (1-5)
});

TicketInstanceSchema.index({ guildId: 1, channelId: 1 });
TicketInstanceSchema.index({ guildId: 1, userId: 1 });

module.exports = mongoose.model('TicketInstance', TicketInstanceSchema);
