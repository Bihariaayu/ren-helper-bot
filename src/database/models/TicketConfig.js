const mongoose = require('mongoose');

const TicketConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  panelEmbed: { type: Object, default: null },
  panelType: { type: String, default: 'button' }, // 'button' or 'dropdown'
  panelCategories: {
    type: [{
      name: { type: String, required: true },
      emoji: { type: String, default: null },
      roleId: { type: String, default: null },
      categoryId: { type: String, default: null } // Target parent category where tickets of this type are created
    }],
    default: []
  },
  categoryId: { type: String, default: null }, // Global default category
  logChannelId: { type: String, default: null },
  supportRoleIds: { type: [String], default: [] }, // Global default support roles
  adminRoleIds: { type: [String], default: [] },
  memberCanClose: { type: Boolean, default: true },
  consistentChannelName: { type: Boolean, default: true },
  roleMention: { type: Boolean, default: false },
  showOpenedStats: { type: Boolean, default: false },
  givePermissionsAuto: { type: Boolean, default: true },
  claimable: { type: Boolean, default: true },
  oneTicketPerUser: { type: Boolean, default: true },
  welcomeMessage: { type: String, default: null },
  claimedCategoryId: { type: String, default: null } // Category where claimed tickets are moved
});

module.exports = mongoose.model('TicketConfig', TicketConfigSchema);
