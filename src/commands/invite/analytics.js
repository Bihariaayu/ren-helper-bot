const { SlashCommandBuilder } = require('discord.js');
const MemberInvite = require('../../database/models/MemberInvite');
const { info, error } = require('../../utils/embedBuilder');

module.exports = {
  name: 'analytics',
  description: 'Displays the server invite and boost analytics dashboard.',
  slashData: new SlashCommandBuilder()
    .setName('analytics')
    .setDescription('Displays the server analytics dashboard.'),

  async executePrefix(message, args, client) {
    await showAnalytics(message);
  },

  async executeSlash(interaction, client) {
    await showAnalytics(interaction);
  }
};

async function showAnalytics(context) {
  const guild = context.guild;

  try {
    // 1. Fetch sums of invites
    const sumStats = await MemberInvite.aggregate([
      { $match: { guildId: guild.id } },
      {
        $group: {
          _id: null,
          total: { $sum: '$total' },
          fake: { $sum: '$fake' },
          left: { $sum: '$left' },
          rejoined: { $sum: '$rejoined' },
          bonus: { $sum: '$bonus' }
        }
      }
    ]);

    const stats = sumStats[0] || { total: 0, fake: 0, left: 0, rejoined: 0, bonus: 0 };
    const net = stats.total + stats.bonus - stats.left - stats.fake;

    // 2. Fetch top inviter
    const topInviterRecord = await MemberInvite.aggregate([
      { $match: { guildId: guild.id } },
      {
        $addFields: {
          net: {
            $subtract: [
              { $add: ['$total', '$bonus'] },
              { $add: ['$left', '$fake'] }
            ]
          }
        }
      },
      { $sort: { net: -1 } },
      { $limit: 1 }
    ]);

    let topInviterStr = '❌ None';
    if (topInviterRecord && topInviterRecord.length > 0) {
      const top = topInviterRecord[0];
      topInviterStr = `<@${top.userId}> with **${top.net}** net invites (Joins: \`${top.total}\` | Left: \`${top.left}\`)`;
    }

    // 3. Active Boosters count
    // Fetch members to get accurate boosters
    const members = await guild.members.fetch({ force: true }).catch(() => guild.members.cache);
    const activeBoosters = members.filter(m => m.premiumSince !== null).size;
    const boostCount = guild.premiumSubscriptionCount || 0;

    // Calculate rates
    const leftRate = stats.total > 0 ? ((stats.left / stats.total) * 100).toFixed(1) : 0;
    const fakeRate = stats.total > 0 ? ((stats.fake / stats.total) * 100).toFixed(1) : 0;
    
    // Create text progress bars to wow the user (premium UI)
    const makeBar = (percentage) => {
      const filledBlocks = Math.min(10, Math.round(percentage / 10));
      const emptyBlocks = 10 - filledBlocks;
      return '🟢'.repeat(filledBlocks) + '🔴'.repeat(emptyBlocks) + ` \`${percentage}%\``;
    };

    const analyticsEmbed = info(
      `Detailed invite and booster analytics for **${guild.name}**.`,
      `📈 Server Analytics Dashboard`
    )
    .addFields([
      { name: '📥 Invites Overview', value: `📈 **Total Joins:** \`${stats.total}\`\n✨ **Net Invites:** \`${net}\` (Active invites in server)\n🎁 **Bonus Invites:** \`${stats.bonus}\`\n🔄 **Rejoined Invites:** \`${stats.rejoined}\``, inline: false },
      { name: '🥀 Retention Analytics', value: `📉 **Left Rate:** ${makeBar(leftRate)} (${stats.left} left)\n🤖 **Fake Rate:** ${makeBar(fakeRate)} (${stats.fake} fake)`, inline: false },
      { name: '👑 Server Leaders', value: `🏆 **Top Inviter:** ${topInviterStr}`, inline: false },
      { name: '🚀 Server Boosts', value: `💪 **Active Boosters:** \`${activeBoosters}\` members\n⚡ **Total Boosts:** \`${boostCount}\` boosts\n💎 **Server Level:** Level \`${guild.premiumTier.replace('TIER_', '') || '0'}\``, inline: false }
    ])
    .setThumbnail(guild.iconURL({ dynamic: true }))
    .setTimestamp();

    if (context.deferred || context.replied) {
      await context.followUp({ embeds: [analyticsEmbed] });
    } else if (typeof context.reply === 'function') {
      await context.reply({ embeds: [analyticsEmbed] });
    }
  } catch (err) {
    console.error('Error fetching analytics:', err);
    if (typeof context.reply === 'function') {
      await context.reply({ embeds: [error('Failed to load server analytics.')], ephemeral: true }).catch(() => null);
    }
  }
}
