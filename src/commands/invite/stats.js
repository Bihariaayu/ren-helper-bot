const { SlashCommandBuilder } = require('discord.js');
const MemberInvite = require('../../database/models/MemberInvite');
const { info, error } = require('../../utils/embedBuilder');

module.exports = {
  name: 'stats',
  description: 'Shows the overall server invite and member statistics.',
  slashData: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Shows the overall server statistics.'),

  async executePrefix(message, args, client) {
    await showServerStats(message);
  },

  async executeSlash(interaction, client) {
    await showServerStats(interaction);
  }
};

async function showServerStats(context) {
  const guild = context.guild;

  try {
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
    const netInvites = stats.total + stats.bonus - stats.left - stats.fake;
    
    // Fetch members to get precise bots/users counts
    const members = await guild.members.fetch({ force: true }).catch(() => guild.members.cache);
    const totalMembers = guild.memberCount;
    const botCount = members.filter(m => m.user.bot).size;
    const humanCount = totalMembers - botCount;

    const statsEmbed = info(
      `Here is the invite and member statistics summary for **${guild.name}**.`,
      `📊 Server Stats`
    )
    .addFields([
      { name: '👥 Server Members', value: `• **Total Members:** \`${totalMembers}\`\n• **Humans:** \`${humanCount}\`\n• **Bots:** \`${botCount}\``, inline: false },
      { name: '📥 Server Invites Summary', value: `• **Net Active Invites:** \`${netInvites}\`\n• **Total Joins:** \`${stats.total}\`\n• **Left Joins:** \`${stats.left}\`\n• **Fake Joins:** \`${stats.fake}\`\n• **Rejoined Invites:** \`${stats.rejoined}\`\n• **Bonus Invites:** \`${stats.bonus}\``, inline: false }
    ])
    .setThumbnail(guild.iconURL({ dynamic: true }));

    if (context.deferred || context.replied) {
      await context.followUp({ embeds: [statsEmbed] });
    } else if (typeof context.reply === 'function') {
      await context.reply({ embeds: [statsEmbed] });
    }
  } catch (err) {
    console.error('Error fetching server stats:', err);
    if (typeof context.reply === 'function') {
      await context.reply({ embeds: [error('Failed to load server statistics.')], ephemeral: true }).catch(() => null);
    }
  }
}
