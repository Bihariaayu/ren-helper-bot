const mongoose = require('../localDb');

const AutoResponseSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  trigger: { type: String, required: true },
  response: { type: String, required: true },
  isEmbed: { type: Boolean, default: false },
  embedData: { type: Object, default: null },
  isRegex: { type: Boolean, default: false },
  isCaseInsensitive: { type: Boolean, default: true },
  cooldown: { type: Number, default: 0 },
  allowedChannels: { type: [String], default: [] }
});

AutoResponseSchema.index({ guildId: 1, trigger: 1 }, { unique: true });

module.exports = mongoose.model('AutoResponse', AutoResponseSchema);
