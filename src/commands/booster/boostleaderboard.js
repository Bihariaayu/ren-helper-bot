const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, time } = require('discord.js');
const BoosterStats = require('../../database/models/BoosterStats');
const { info, error } = require('../../utils/embedBuilder');

module.exports = {
  name: 'boostleaderboard',
  description: 'Displays the server booster ranking leaderboard.',
  slashData: new SlashCommandBuilder()
    .setName('boostleaderboard')
    .setDescription('Displays the server booster ranking leaderboard.')
    .addIntegerOption(opt => opt.setName('page').setDescription('Page number').setRequired(false)),

  async executePrefix(message, args, client) {
    const pageArg = parseInt(args[0]) || 1;
    await showBoostLeaderboard(message, pageArg, false);
  },

  async executeSlash(interaction, client) {
    const pageVal = interaction.options.getInteger('page') || 1;
    await showBoostLeaderboard(interaction, pageVal, true);
  }
};

async function showBoostLeaderboard(context, initialPage, isInteraction) {
  const guild = context.guild;
  let page = Math.max(1, initialPage);
  const itemsPerPage = 10;

  try {
    // Sort by current active boost count, then total historical boosts
    const leaderboardData = await BoosterStats.find({ guildId: guild.id })
      .sort({ boostCount: -1, totalBoosts: -1 });

    if (!leaderboardData || leaderboardData.length === 0) {
      const emptyEmbed = info('There are no boosters recorded in this server yet.', '🥇 Booster Rankings');
      return isInteraction ? context.reply({ embeds: [emptyEmbed] }) : context.reply({ embeds: [emptyEmbed] });
    }

    const totalPages = Math.ceil(leaderboardData.length / itemsPerPage);
    page = Math.min(page, totalPages);

    const getEmbed = (p) => {
      const start = (p - 1) * itemsPerPage;
      const end = start + itemsPerPage;
      const pageData = leaderboardData.slice(start, end);

      let desc = '';
      pageData.forEach((item, index) => {
        const rank = start + index + 1;
        let rankEmoji = '⚫';
        if (rank === 1) rankEmoji = '🥇';
        else if (rank === 2) rankEmoji = '🥈';
        else if (rank === 3) rankEmoji = '🥉';

        const boostSinceStr = item.boostSince ? `since ${time(item.boostSince, 'd')}` : 'not active';

        desc += `${rankEmoji} **#${rank}** <@${item.userId}> - **${item.boostCount}** active\n` +
                `└ *(Total Boosts: \`${item.totalBoosts}\` | Boost Since: ${boostSinceStr})*\n\n`;
      });

      return info(desc, `🥇 Booster Rankings (Page ${p}/${totalPages})`);
    };

    const getRow = (p) => {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('boost_leaderboard_prev')
          .setLabel('◀️ Previous')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(p === 1),
        new ButtonBuilder()
          .setCustomId('boost_leaderboard_next')
          .setLabel('Next ▶️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(p === totalPages)
      );
    };

    const msg = isInteraction 
      ? await context.reply({ embeds: [getEmbed(page)], components: totalPages > 1 ? [getRow(page)] : [], fetchReply: true })
      : await context.reply({ embeds: [getEmbed(page)], components: totalPages > 1 ? [getRow(page)] : [] });

    if (totalPages <= 1) return;

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000
    });

    collector.on('collect', async (click) => {
      const callerId = isInteraction ? context.user.id : context.author.id;
      if (click.user.id !== callerId) {
        return click.reply({ embeds: [error('You cannot change pages on someone else\'s command.')], ephemeral: true });
      }

      if (click.customId === 'boost_leaderboard_prev') {
        page = Math.max(1, page - 1);
      } else if (click.customId === 'boost_leaderboard_next') {
        page = Math.min(totalPages, page + 1);
      }

      await click.update({ embeds: [getEmbed(page)], components: [getRow(page)] });
    });

    collector.on('end', () => {
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('prev').setLabel('◀️ Previous').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('next').setLabel('Next ▶️').setStyle(ButtonStyle.Secondary).setDisabled(true)
      );
      msg.edit({ components: [disabledRow] }).catch(() => null);
    });

  } catch (err) {
    console.error('Error in boostleaderboard command:', err);
    if (typeof context.reply === 'function') {
      await context.reply({ embeds: [error('Failed to load booster ranking leaderboard.')], ephemeral: true }).catch(() => null);
    }
  }
}
