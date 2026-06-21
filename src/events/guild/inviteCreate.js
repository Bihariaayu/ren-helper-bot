const { inviteCacheMap } = require('../../utils/inviteCache');
const logger = require('../../utils/logger');

module.exports = {
  once: false,
  async execute(invite, client) {
    const guild = invite.guild;
    logger.info(`Invite created in ${guild.name}: ${invite.code}`);

    const cached = inviteCacheMap.get(guild.id);
    if (cached) {
      cached.invites.set(invite.code, invite.uses || 0);
    }
  }
};
