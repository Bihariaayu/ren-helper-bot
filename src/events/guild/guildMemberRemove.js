const { time } = require('discord.js');
const MemberJoinInfo = require('../../database/models/MemberJoinInfo');
const MemberInvite = require('../../database/models/MemberInvite');
const GuildConfig = require('../../database/models/GuildConfig');
const { createEmbed } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');
// Dynamic import of updateInviteRewards function
const { updateInviteRewards } = require('./guildMemberAdd');

module.exports = {
  once: false,
  async execute(member, client) {
    const guild = member.guild;

    try {
      // Find who invited the leaving member
      const joinInfo = await MemberJoinInfo.findOne({ guildId: guild.id, userId: member.id });
      let inviterId = null;
      let inviteCode = null;
      let inviterUser = null;
      let inviterStats = null;

      if (joinInfo) {
        // Mark as left
        joinInfo.left = true;
        await joinInfo.save();

        inviterId = joinInfo.inviterId;
        inviteCode = joinInfo.inviteCode;

        if (inviterId && inviterId !== 'VANITY_URL') {
          // Increment the left counter for the inviter
          inviterStats = await MemberInvite.findOneAndUpdate(
            { guildId: guild.id, userId: inviterId },
            { $inc: { left: 1 } },
            { new: true, upsert: true }
          );

          inviterUser = await client.users.fetch(inviterId).catch(() => null);

          // Update the inviter's reward roles (since their invite count changed)
          await updateInviteRewards(guild, inviterId);
        }
      }

      // Log leave to the server's log channel
      let logDesc = `👤 **User:** ${member} (${member.user.tag})\n🆔 **ID:** ${member.id}`;
      if (inviterId === 'VANITY_URL') {
        logDesc += `\n🔗 **Joined via:** Vanity URL (\`${inviteCode}\`)`;
      } else if (inviterUser) {
        const netInvites = inviterStats ? (inviterStats.total + inviterStats.bonus - inviterStats.left - inviterStats.fake) : 0;
        logDesc += `\n📥 **Invited by:** ${inviterUser} (${inviterUser.tag}) (Net Invites: \`${netInvites}\`)`;
      } else {
        logDesc += `\n🔗 **Joined via:** Unknown / OAuth`;
      }

      await logger.logToGuild(guild, 'Member Left', logDesc);

      // Send User Left message to the invite channel
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

            const leaveEmbed = createEmbed({
              title: '👤 User Left',
              description: `${member.user.tag} (${member}) has left the server.`,
              color: 'red',
              fields: [
                { name: 'Invited By', value: inviterText, inline: true },
                { name: 'Updated Invite Count', value: totalText, inline: true }
              ],
              thumbnail: member.user.displayAvatarURL({ dynamic: true }),
              timestamp: true
            });

            await inviteChannel.send({ embeds: [leaveEmbed] });
          }
        }
      }
    } catch (err) {
      logger.error(`Error in guildMemberRemove handler for ${member.user.tag}`, err);
    }
  }
};
