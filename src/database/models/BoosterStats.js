const mongoose = require('mongoose');

const BoosterStatsSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  boostCount: { type: Number, default: 0 },
  totalBoosts: { type: Number, default: 0 },
  boostSince: { type: Date, default: null }
});

BoosterStatsSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('BoosterStats', BoosterStatsSchema);
