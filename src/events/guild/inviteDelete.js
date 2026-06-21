const { inviteCacheMap } = require('../../utils/inviteCache');
const logger = require('../../utils/logger');

module.exports = {
  once: false,
  async execute(invite, client) {
    const guild = invite.guild;
    logger.info(`Invite deleted in ${guild.name}: ${invite.code}`);

    const cached = inviteCacheMap.get(guild.id);
    if (cached) {
      cached.invites.delete(invite.code);
    }
  }
};
