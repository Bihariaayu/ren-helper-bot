const { SlashCommandBuilder } = require('discord.js');
const MemberInvite = require('../../database/models/MemberInvite');
const { info, error } = require('../../utils/embedBuilder');

module.exports = {
  name: 'invites',
  description: 'Shows the invite statistics for yourself or a specified user.',
  slashData: new SlashCommandBuilder()
    .setName('invites')
    .setDescription('Shows the invite statistics for a user.')
    .addUserOption(opt => opt.setName('user').setDescription('The user to check stats for').setRequired(false)),

  async executePrefix(message, args, client) {
    const target = message.mentions.users.first() || client.users.cache.get(args[0]) || message.author;
    await showInvites(message, target);
  },

  async executeSlash(interaction, client) {
    const target = interaction.options.getUser('user') || interaction.user;
    await showInvites(interaction, target);
  }
};

async function showInvites(context, target) {
  try {
    const guild = context.guild;
    let stats = await MemberInvite.findOne({ guildId: guild.id, userId: target.id });

    if (!stats) {
      stats = { total: 0, fake: 0, left: 0, rejoined: 0, bonus: 0 };
    }

    const netInvites = stats.total + stats.bonus - stats.left - stats.fake;

    const statsEmbed = info(
      `Here are the invite statistics for **${target.tag}** (${target}).`,
      `📥 Invite Stats`
    )
    .addFields([
      { name: '✨ Net Invites', value: `\`${netInvites}\``, inline: false },
      { name: '📥 Total Joins', value: `\`${stats.total}\``, inline: true },
      { name: '🎁 Bonus Invites', value: `\`${stats.bonus}\``, inline: true },
      { name: '🥀 Left Joins', value: `\`${stats.left}\``, inline: true },
      { name: '🤖 Fake Joins', value: `\`${stats.fake}\``, inline: true },
      { name: '🔄 Rejoined', value: `\`${stats.rejoined}\``, inline: true }
    ])
    .setThumbnail(target.displayAvatarURL({ dynamic: true }));

    if (context.deferred || context.replied) {
      await context.followUp({ embeds: [statsEmbed] });
    } else if (typeof context.reply === 'function') {
      await context.reply({ embeds: [statsEmbed] });
    }
  } catch (err) {
    console.error('Error fetching user invites:', err);
    if (typeof context.reply === 'function') {
      await context.reply({ embeds: [error('Failed to retrieve invite statistics.')], ephemeral: true }).catch(() => null);
    }
  }
}
