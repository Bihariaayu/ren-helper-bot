const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const MemberInvite = require('../../database/models/MemberInvite');
const { info, error } = require('../../utils/embedBuilder');

module.exports = {
  name: 'leaderboard',
  aliases: ['topinvites'],
  description: 'Displays the server invite leaderboard.',
  slashData: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Displays the server invite leaderboard.')
    .addIntegerOption(opt => opt.setName('page').setDescription('Page number').setRequired(false)),

  async executePrefix(message, args, client) {
    const pageArg = parseInt(args[0]) || 1;
    await showLeaderboard(message, pageArg, false);
  },

  async executeSlash(interaction, client) {
    const pageVal = interaction.options.getInteger('page') || 1;
    await showLeaderboard(interaction, pageVal, true);
  }
};

async function showLeaderboard(context, initialPage, isInteraction) {
  const guild = context.guild;
  let page = Math.max(1, initialPage);
  const itemsPerPage = 10;

  try {
    // Aggregation pipeline to calculate net invites: total + bonus - left - fake
    const leaderboardData = await MemberInvite.aggregate([
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
      { $sort: { net: -1 } }
    ]);

    if (!leaderboardData || leaderboardData.length === 0) {
      const emptyEmbed = info('There are no invite stats recorded in this server yet.', '🥇 Invite Leaderboard');
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

        desc += `${rankEmoji} **#${rank}** <@${item.userId}> - **${item.net}** net\n` +
                `└ *(Joins: \`${item.total}\` | Left: \`${item.left}\` | Fake: \`${item.fake}\` | Bonus: \`${item.bonus}\`)*\n\n`;
      });

      return info(desc, `🥇 Invite Leaderboard (Page ${p}/${totalPages})`);
    };

    const getRow = (p) => {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('leaderboard_prev')
          .setLabel('◀️ Previous')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(p === 1),
        new ButtonBuilder()
          .setCustomId('leaderboard_next')
          .setLabel('Next ▶️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(p === totalPages)
      );
    };

    // If prefix command or user requested non-interactive slash response, just send embed
    const msg = isInteraction 
      ? await context.reply({ embeds: [getEmbed(page)], components: totalPages > 1 ? [getRow(page)] : [], fetchReply: true })
      : await context.reply({ embeds: [getEmbed(page)], components: totalPages > 1 ? [getRow(page)] : [] });

    if (totalPages <= 1) return;

    // Collector for button interactions
    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000 // 1 minute active window
    });

    collector.on('collect', async (click) => {
      // Check author/caller permission
      const callerId = isInteraction ? context.user.id : context.author.id;
      if (click.user.id !== callerId) {
        return click.reply({ embeds: [error('You cannot change pages on someone else\'s command.')], ephemeral: true });
      }

      if (click.customId === 'leaderboard_prev') {
        page = Math.max(1, page - 1);
      } else if (click.customId === 'leaderboard_next') {
        page = Math.min(totalPages, page + 1);
      }

      await click.update({ embeds: [getEmbed(page)], components: [getRow(page)] });
    });

    collector.on('end', () => {
      // Disable buttons upon expiration
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('prev').setLabel('◀️ Previous').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('next').setLabel('Next ▶️').setStyle(ButtonStyle.Secondary).setDisabled(true)
      );
      msg.edit({ components: [disabledRow] }).catch(() => null);
    });

  } catch (err) {
    console.error('Error in leaderboard command:', err);
    if (typeof context.reply === 'function') {
      await context.reply({ embeds: [error('Failed to load invite leaderboard.')], ephemeral: true }).catch(() => null);
    }
  }
}
