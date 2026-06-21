const { SlashCommandBuilder, time } = require('discord.js');
const MemberJoinInfo = require('../../database/models/MemberJoinInfo');
const { info, error } = require('../../utils/embedBuilder');

module.exports = {
  name: 'inviter',
  description: 'Shows who invited a member to the server.',
  slashData: new SlashCommandBuilder()
    .setName('inviter')
    .setDescription('Shows who invited a member.')
    .addUserOption(opt => opt.setName('user').setDescription('The user to check').setRequired(false)),

  async executePrefix(message, args, client) {
    const target = message.mentions.users.first() || client.users.cache.get(args[0]) || message.author;
    await showInviter(message, target);
  },

  async executeSlash(interaction, client) {
    const target = interaction.options.getUser('user') || interaction.user;
    await showInviter(interaction, target);
  }
};

async function showInviter(context, target) {
  try {
    const guild = context.guild;
    const joinInfo = await MemberJoinInfo.findOne({ guildId: guild.id, userId: target.id });

    if (!joinInfo) {
      return context.reply({ embeds: [error(`No join data found for **${target.tag}**. They may have joined before I was added.`)] });
    }

    let inviterStr = 'Unknown / OAuth';
    if (joinInfo.inviterId) {
      if (joinInfo.inviterId === 'VANITY_URL') {
        inviterStr = `Vanity URL (\`${joinInfo.inviteCode}\`)`;
      } else {
        inviterStr = `<@${joinInfo.inviterId}> (ID: \`${joinInfo.inviterId}\`)`;
      }
    }

    const inviterEmbed = info(
      `Join information details for **${target.tag}**.`,
      `🔍 Inviter Details`
    )
    .addFields([
      { name: '👤 Member', value: `${target} (\`${target.id}\`)`, inline: true },
      { name: '📥 Invited By', value: inviterStr, inline: true },
      { name: '🔑 Invite Code', value: joinInfo.inviteCode ? `\`${joinInfo.inviteCode}\`` : 'N/A', inline: true },
      { name: '📅 Join Date', value: `${time(joinInfo.joinedAt, 'f')} (${time(joinInfo.joinedAt, 'R')})`, inline: false },
      { name: '⚠️ Account Flagged Fake?', value: joinInfo.isFake ? 'Yes' : 'No', inline: true },
      { name: '🥀 Currently Left?', value: joinInfo.left ? 'Yes' : 'No', inline: true }
    ])
    .setThumbnail(target.displayAvatarURL({ dynamic: true }));

    if (context.deferred || context.replied) {
      await context.followUp({ embeds: [inviterEmbed] });
    } else if (typeof context.reply === 'function') {
      await context.reply({ embeds: [inviterEmbed] });
    }
  } catch (err) {
    console.error('Error fetching inviter info:', err);
    if (typeof context.reply === 'function') {
      await context.reply({ embeds: [error('Failed to retrieve inviter information.')], ephemeral: true }).catch(() => null);
    }
  }
}
