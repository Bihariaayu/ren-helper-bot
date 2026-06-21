const mongoose = require('mongoose');

const TicketConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  panelEmbed: { type: Object, default: null },
  panelType: { type: String, default: 'button' }, // 'button' or 'dropdown'
  panelCategories: { type: [String], default: [] },
  categoryId: { type: String, default: null },
  logChannelId: { type: String, default: null },
  supportRoleIds: { type: [String], default: [] },
  adminRoleIds: { type: [String], default: [] },
  memberCanClose: { type: Boolean, default: true },
  consistentChannelName: { type: Boolean, default: true },
  roleMention: { type: Boolean, default: false },
  showOpenedStats: { type: Boolean, default: false },
  givePermissionsAuto: { type: Boolean, default: true },
  claimable: { type: Boolean, default: true },
  oneTicketPerUser: { type: Boolean, default: true },
  welcomeMessage: { type: String, default: null }
});

module.exports = mongoose.model('TicketConfig', TicketConfigSchema);
