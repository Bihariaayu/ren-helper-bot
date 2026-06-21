const mongoose = require('mongoose');

const TicketReviewSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  ticketId: { type: String, required: true },
  rating: { type: Number, required: true }, // 1-5
  comment: { type: String, default: null },
  timestamp: { type: Date, default: Date.now }
});

TicketReviewSchema.index({ guildId: 1, userId: 1 });

module.exports = mongoose.model('TicketReview', TicketReviewSchema);
