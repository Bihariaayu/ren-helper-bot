const { time } = require('discord.js');
const MemberJoinInfo = require('../../database/models/MemberJoinInfo');
const MemberInvite = require('../../database/models/MemberInvite');
const GuildConfig = require('../../database/models/GuildConfig');
const { findUsedInvite } = require('../../utils/inviteCache');
const { createEmbed } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');

module.exports = {
  once: false,
  async execute(member, client) {
    const guild = member.guild;
    const now = Date.now();

    // Determine if fake (account created within last 24 hours)
    const isFake = (now - member.user.createdTimestamp) < (24 * 60 * 60 * 1000);

    // Track used invite
    const usedInvite = await findUsedInvite(guild);
    let inviterId = null;
    let inviteCode = null;
    let inviterUser = null;

    if (usedInvite) {
      inviteCode = usedInvite.code;
      if (usedInvite.inviter && usedInvite.inviter.id !== 'VANITY_URL') {
        inviterId = usedInvite.inviter.id;
        inviterUser = await client.users.fetch(inviterId).catch(() => null);
      } else if (usedInvite.inviter && usedInvite.inviter.id === 'VANITY_URL') {
        inviterId = 'VANITY_URL';
      }
    }

    try {
      // Check for previous join record (rejoin detection)
      const existingJoin = await MemberJoinInfo.findOne({ guildId: guild.id, userId: member.id });
      let isRejoin = false;

      if (existingJoin) {
        isRejoin = true;
        
        // If they had left, update the old inviter's stats
        if (existingJoin.left && existingJoin.inviterId) {
          await MemberInvite.findOneAndUpdate(
            { guildId: guild.id, userId: existingJoin.inviterId },
            { $inc: { left: -1, rejoined: 1 } },
            { upsert: true }
          );
        }

        // Overwrite join info with new details
        existingJoin.inviterId = inviterId;
        existingJoin.inviteCode = inviteCode;
        existingJoin.isFake = isFake;
        existingJoin.left = false;
        existingJoin.joinedAt = new Date();
        await existingJoin.save();
      } else {
        // Create new join record
        await MemberJoinInfo.create({
          guildId: guild.id,
          userId: member.id,
          inviterId,
          inviteCode,
          isFake,
          left: false
        });
      }

      // If there is a valid inviter, update their stats
      let inviterStats = null;
      if (inviterId && inviterId !== 'VANITY_URL') {
        inviterStats = await MemberInvite.findOneAndUpdate(
          { guildId: guild.id, userId: inviterId },
          { $inc: { total: 1, fake: isFake ? 1 : 0 } },
          { new: true, upsert: true }
        );

        // Update reward roles for the inviter
        await updateInviteRewards(guild, inviterId);
      }

      // Log join event to the server's log channel
      let logDesc = `👤 **User:** ${member} (${member.user.tag})\n🆔 **ID:** ${member.id}\n📅 **Created:** ${time(member.user.createdAt, 'R')}`;
      if (isFake) logDesc += '\n⚠️ **Warning:** Account age is less than 24 hours!';
      
      if (inviterId === 'VANITY_URL') {
        logDesc += `\n🔗 **Joined via:** Vanity URL (\`${inviteCode}\`)`;
      } else if (inviterUser) {
        const netInvites = inviterStats ? (inviterStats.total + inviterStats.bonus - inviterStats.left - inviterStats.fake) : 0;
        logDesc += `\n📥 **Invited by:** ${inviterUser} (${inviterUser.tag}) (Net Invites: \`${netInvites}\`)\n🔑 **Invite Code:** \`${inviteCode}\``;
      } else {
        logDesc += `\n🔗 **Joined via:** Unknown / OAuth`;
      }
      
      await logger.logToGuild(
        guild, 
        isRejoin ? 'Member Rejoined' : 'Member Joined', 
        logDesc
      );

      // Send Welcome / Invite Join notification in the designated invite channel
      const configData = await GuildConfig.findOne({ guildId: guild.id });
      if (configData && configData.inviteChannelId) {
        const inviteChannel = await guild.channels.fetch(configData.inviteChannelId).catch(() => null);
        if (inviteChannel) {
          const permissions = inviteChannel.permissionsFor(guild.members.me);
          if (permissions && permissions.has(['SendMessages', 'EmbedLinks'])) {
            let inviterText = 'Unknown / OAuth';
            let totalText = 'N/A';

            if (inviterId === 'VANITY_URL') {
              inviterText = `Vanity URL (\`${inviteCode}\`)`;
            } else if (inviterUser) {
              inviterText = `${inviterUser.tag} (${inviterUser})`;
              const net = inviterStats ? (inviterStats.total + inviterStats.bonus - inviterStats.left - inviterStats.fake) : 0;
              totalText = `${net}`;
            }

            const welcomeEmbed = createEmbed({
              title: '👤 User Joined',
              description: `Welcome ${member} to **${guild.name}**!`,
              color: 'green',
              fields: [
                { name: 'Username', value: `${member.user.tag}`, inline: true },
                { name: 'Invited By', value: inviterText, inline: true },
                { name: 'Total Invites', value: totalText, inline: true },
                { name: 'Account Created', value: `${time(member.user.createdAt, 'f')} (${time(member.user.createdAt, 'R')})`, inline: false },
                { name: 'Invite Code', value: inviteCode ? `\`${inviteCode}\`` : 'None', inline: true }
              ],
              thumbnail: member.user.displayAvatarURL({ dynamic: true }),
              timestamp: true
            });

            await inviteChannel.send({ embeds: [welcomeEmbed] });
          }
        }
      }
    } catch (err) {
      logger.error(`Error in guildMemberAdd handler for ${member.user.tag}`, err);
    }
  }
};

/**
 * Evaluates and updates milestone invite rewards for a user
 * @param {import('discord.js').Guild} guild 
 * @param {string} userId - The inviter's user ID
 */
async function updateInviteRewards(guild, userId) {
  try {
    const configData = await GuildConfig.findOne({ guildId: guild.id });
    if (!configData || !configData.inviteRewards || configData.inviteRewards.length === 0) return;

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return;

    const stats = await MemberInvite.findOne({ guildId: guild.id, userId });
    const netInvites = stats ? (stats.total + stats.bonus - stats.left - stats.fake) : 0;

    // Check each configured reward
    for (const reward of configData.inviteRewards) {
      const role = guild.roles.cache.get(reward.roleId);
      if (!role) continue;

      const hasRole = member.roles.cache.has(role.id);

      if (netInvites >= reward.invitesNeeded) {
        if (!hasRole) {
          await member.roles.add(role).catch(err => {
            logger.warn(`Failed to add reward role ${role.name} to ${member.user.tag}: ${err.message}`);
          });
          logger.logToGuild(guild, 'Invite Reward Granted', `Granted reward role ${role} to ${member} for reaching \`${reward.invitesNeeded}\` invites.`);
        }
      } else {
        if (hasRole) {
          await member.roles.remove(role).catch(err => {
            logger.warn(`Failed to remove reward role ${role.name} from ${member.user.tag}: ${err.message}`);
          });
          logger.logToGuild(guild, 'Invite Reward Revoked', `Removed reward role ${role} from ${member} as invite count dropped below \`${reward.invitesNeeded}\` (Current: \`${netInvites}\`).`);
        }
      }
    }
  } catch (err) {
    logger.error(`Error updating invite rewards for user ${userId} in guild ${guild.id}`, err);
  }
}

// Export reward function to be accessible from command code as well
module.exports.updateInviteRewards = updateInviteRewards;
