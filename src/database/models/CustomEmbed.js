const mongoose = require('mongoose');

const CustomEmbedSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  embedId: { type: String, required: true },
  data: { type: Object, required: true },
  creatorId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

CustomEmbedSchema.index({ guildId: 1, embedId: 1 }, { unique: true });

module.exports = mongoose.model('CustomEmbed', CustomEmbedSchema);
