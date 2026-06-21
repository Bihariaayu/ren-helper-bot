const mongoose = require('mongoose');

const WarningSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  warnId: { type: String, required: true },
  moderatorId: { type: String, required: true },
  reason: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

WarningSchema.index({ guildId: 1, userId: 1 });

module.exports = mongoose.model('Warning', WarningSchema);
