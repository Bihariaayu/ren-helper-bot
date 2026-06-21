const { SlashCommandBuilder, time } = require('discord.js');
const BoosterStats = require('../../database/models/BoosterStats');
const { info, error } = require('../../utils/embedBuilder');

module.exports = {
  name: 'boosts',
  description: 'Shows server boost statistics for a user.',
  slashData: new SlashCommandBuilder()
    .setName('boosts')
    .setDescription('Shows server boost statistics for a user.')
    .addUserOption(opt => opt.setName('user').setDescription('The user to check').setRequired(false)),

  async executePrefix(message, args, client) {
    const target = message.mentions.users.first() || client.users.cache.get(args[0]) || message.author;
    await showBoosts(message, target);
  },

  async executeSlash(interaction, client) {
    const target = interaction.options.getUser('user') || interaction.user;
    await showBoosts(interaction, target);
  }
};

async function showBoosts(context, target) {
  try {
    const guild = context.guild;
    const member = await guild.members.fetch(target.id).catch(() => null);
    
    let stats = await BoosterStats.findOne({ guildId: guild.id, userId: target.id });
    if (!stats) {
      stats = { boostCount: 0, totalBoosts: 0, boostSince: null };
    }

    // Determine current boosting status from Discord member
    const isCurrentlyBoosting = member && member.premiumSince !== null;
    const boostSinceDate = isCurrentlyBoosting ? member.premiumSince : stats.boostSince;

    let boostSinceStr = '❌ Not Boosting';
    if (isCurrentlyBoosting && boostSinceDate) {
      boostSinceStr = `${time(boostSinceDate, 'f')} (${time(boostSinceDate, 'R')})`;
    } else if (boostSinceDate) {
      boostSinceStr = `Previously boosting, since: ${time(boostSinceDate, 'f')} (expired)`;
    }

    const embed = info(
      `Boost statistics for **${target.tag}** (${target}).`,
      `🚀 Server Boost Stats`
    )
    .addFields([
      { name: '⚡ Active Boosts', value: `\`${isCurrentlyBoosting ? (stats.boostCount || 1) : 0}\` boosts`, inline: true },
      { name: '🏆 Total Historical Boosts', value: `\`${stats.totalBoosts}\` boosts`, inline: true },
      { name: '📅 Boost Since', value: boostSinceStr, inline: false }
    ])
    .setThumbnail(target.displayAvatarURL({ dynamic: true }));

    await context.reply({ embeds: [embed] });
  } catch (err) {
    console.error('Error fetching boost stats:', err);
    await context.reply({ embeds: [error('Failed to load booster statistics.')], ephemeral: true }).catch(() => null);
  }
}
