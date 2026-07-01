const mongoose = require('../localDb');

const GuildConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  logChannelId: { type: String, default: null },
  inviteChannelId: { type: String, default: null },
  welcomeChannelId: { type: String, default: null },
  autoResponseChannelIds: { type: [String], default: [] },
  embedRoles: { type: [String], default: [] },
  boosterRoleId: { type: String, default: null },
  boostChannelId: { type: String, default: null },
  invitePrefix: { type: String, default: '-i' },
  utilityPrefix: { type: String, default: 'r?' },
  inviteRewards: [
    {
      invitesNeeded: { type: Number, required: true },
      roleId: { type: String, required: true }
    }
  ]
});

module.exports = mongoose.model('GuildConfig', GuildConfigSchema);
