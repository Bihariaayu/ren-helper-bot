const { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ChannelType 
} = require('discord.js');
const Giveaway = require('../../database/models/Giveaway');
const giveawayManager = require('../../utils/giveawayManager');
const { createEmbed, success, error, info } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');

// Helper to parse duration (e.g. 10m, 2h, 1d)
function parseDuration(str) {
  const match = str.match(/^(\d+)([smhd])$/i);
  if (!match) return null;
  const val = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 's': return val * 1000;
    case 'm': return val * 60000;
    case 'h': return val * 3600000;
    case 'd': return val * 86400000;
    default: return null;
  }
}

module.exports = {
  name: 'giveaway',
  description: 'Complete giveaway manager system.',
  slashData: new SlashCommandBuilder()
    .setName('ga')
    .setDescription('Giveaway manager.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub => sub
      .setName('start')
      .setDescription('Starts a new giveaway.')
      .addStringOption(opt => opt.setName('prize').setDescription('Prize of the giveaway').setRequired(true))
      .addStringOption(opt => opt.setName('duration').setDescription('Duration (e.g., 10m, 1h, 1d)').setRequired(true))
      .addIntegerOption(opt => opt.setName('winners').setDescription('Number of winners').setRequired(true))
      .addRoleOption(opt => opt.setName('role-requirement').setDescription('Required role to participate').setRequired(false))
      .addIntegerOption(opt => opt.setName('invite-requirement').setDescription('Net invites required to participate').setRequired(false))
      .addRoleOption(opt => opt.setName('bonus-role').setDescription('Role that gets bonus entries').setRequired(false))
      .addIntegerOption(opt => opt.setName('bonus-multiplier').setDescription('Multiplier for bonus role (e.g., 2 for double weight)').setRequired(false))
    )
    .addSubcommand(sub => sub
      .setName('end')
      .setDescription('Ends an active giveaway.')
      .addStringOption(opt => opt.setName('message-id').setDescription('ID of the giveaway message').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('reroll')
      .setDescription('Rerolls a finished giveaway.')
      .addStringOption(opt => opt.setName('message-id').setDescription('ID of the giveaway message').setRequired(true))
    ),

  async executePrefix(message, args, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return message.reply({ embeds: [error('You must have Manage Server permission to manage giveaways.')] });
    }

    const sub = args[0]?.toLowerCase();
    if (!sub || sub === 'help') {
      const helpEmbed = info(
        `**Giveaway Prefix Commands:**\n` +
        `• \`r?giveaway start <duration> <winners> <prize>\` - Starts a giveaway\n` +
        `• \`r?giveaway end <messageId>\` - Force-ends a giveaway\n` +
        `• \`r?giveaway reroll <messageId>\` - Rerolls giveaway winners\n` +
        `• \`r?giveaway delete <messageId>\` - Deletes a giveaway`,
        `🎉 Giveaway Help`
      );
      return message.reply({ embeds: [helpEmbed] });
    }

    if (sub === 'start') {
      // Direct parsing: r?giveaway start 10m 1 prize details
      const durationStr = args[1];
      const winnersCount = parseInt(args[2]);
      const prize = args.slice(3).join(' ');

      if (!durationStr || isNaN(winnersCount) || !prize) {
        return message.reply({ embeds: [error('Invalid parameters. Usage: `r?giveaway start <duration> <winners> <prize>`\nExample: `r?giveaway start 1h 1 Nitro Boost`')] });
      }

      const ms = parseDuration(durationStr);
      if (!ms) return message.reply({ embeds: [error('Invalid duration format. Use `10m`, `1h`, `1d`, etc.')] });

      const endAt = new Date(Date.now() + ms);
      await startGiveawayMessage(message, message.channel, prize, winnersCount, endAt, null, 0, null, 1, false);
      return;
    }

    if (sub === 'end') {
      const msgId = args[1];
      if (!msgId) return message.reply({ embeds: [error('Please specify the giveaway message ID.')] });
      await runEnd(message, msgId, false);
      return;
    }

    if (sub === 'reroll') {
      const msgId = args[1];
      if (!msgId) return message.reply({ embeds: [error('Please specify the giveaway message ID.')] });
      await runReroll(message, msgId, false);
      return;
    }

    if (sub === 'delete') {
      const msgId = args[1];
      if (!msgId) return message.reply({ embeds: [error('Please specify the giveaway message ID.')] });
      await runDelete(message, msgId, false);
      return;
    }

    return message.reply({ embeds: [error('Unknown subcommand. Type `r?giveaway help` for instructions.')] });
  },

  async executeSlash(interaction, client) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'start') {
      const prize = interaction.options.getString('prize');
      const durationStr = interaction.options.getString('duration');
      const winners = interaction.options.getInteger('winners');
      const roleReq = interaction.options.getRole('role-requirement');
      const inviteReq = interaction.options.getInteger('invite-requirement') || 0;
      const bonusRole = interaction.options.getRole('bonus-role');
      const bonusMult = interaction.options.getInteger('bonus-multiplier') || 1;

      const ms = parseDuration(durationStr);
      if (!ms) return interaction.reply({ embeds: [error('Invalid duration format. Use `10m`, `1h`, `1d`, etc.')], ephemeral: true });

      const endAt = new Date(Date.now() + ms);
      await startGiveawayMessage(
        interaction,
        interaction.channel,
        prize,
        winners,
        endAt,
        roleReq?.id || null,
        inviteReq,
        bonusRole?.id || null,
        bonusMult,
        true
      );
    } 
    else if (sub === 'end') {
      const msgId = interaction.options.getString('message-id');
      await runEnd(interaction, msgId, true);
    } 
    else if (sub === 'reroll') {
      const msgId = interaction.options.getString('message-id');
      await runReroll(interaction, msgId, true);
    }
  }
};

async function startGiveawayMessage(context, channel, prize, winnersCount, endAt, roleReqId, inviteReq, bonusRoleId, bonusMult, isInteraction) {
  try {
    const timeHtml = `<t:${Math.floor(endAt.getTime() / 1000)}:R>`;
    const host = context.user || context.author;

    let requirementsStr = 'None';
    const reqs = [];
    if (roleReqId) reqs.push(`Role: <@&${roleReqId}>`);
    if (inviteReq > 0) reqs.push(`Invites: **${inviteReq}** net`);
    if (reqs.length > 0) requirementsStr = reqs.join(', ');

    let bonusStr = 'None';
    if (bonusRoleId) bonusStr = `<@&${bonusRoleId}> (**${bonusMult}x** entries)`;

    const gaEmbed = info(
      `React with 🎉 or click the button below to enter!\n\n` +
      `• **Prize:** ${prize}\n` +
      `• **Winners:** ${winnersCount}\n` +
      `• **Time Remaining:** ${timeHtml}\n` +
      `• **Host:** ${host}\n` +
      `• **Requirements:** ${requirementsStr}\n` +
      `• **Bonus Entries:** ${bonusStr}`,
      `🎉 Active Giveaway`
    );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ga_join').setLabel('🎉 Join').setStyle(ButtonStyle.Success)
    );

    let msg;
    if (isInteraction) {
      await context.reply({ content: '✅ Giveaway started!', ephemeral: true });
      msg = await channel.send({ embeds: [gaEmbed], components: [row] });
    } else {
      msg = await context.reply({ embeds: [gaEmbed], components: [row] });
    }

    // Add reaction
    await msg.react('🎉').catch(() => null);

    const bonusRoles = [];
    if (bonusRoleId) bonusRoles.push({ roleId: bonusRoleId, multiplier: bonusMult });

    // Store in DB
    const giveaway = await Giveaway.create({
      messageId: msg.id,
      channelId: channel.id,
      guildId: context.guildId || context.guild.id,
      prize,
      winnerCount: winnersCount,
      endAt,
      participants: [],
      roleRequirements: roleReqId ? [roleReqId] : [],
      inviteRequirements: inviteReq,
      bonusRoles,
      ended: false
    });

    // Schedule end
    const remaining = endAt.getTime() - Date.now();
    if (remaining > 0) {
      setTimeout(() => giveawayManager.endGiveaway(giveaway), remaining);
    }

  } catch (err) {
    console.error('Error starting giveaway:', err);
    if (isInteraction) {
      await context.reply({ embeds: [error('Failed to start giveaway.')], ephemeral: true }).catch(() => null);
    } else {
      await context.reply({ embeds: [error('Failed to start giveaway.')] }).catch(() => null);
    }
  }
}

async function runEnd(context, messageId, isInteraction) {
  try {
    const giveaway = await Giveaway.findOne({ messageId, ended: false });
    if (!giveaway) {
      return context.reply({ embeds: [error('Active giveaway not found with that message ID.')], ephemeral: isInteraction });
    }
    
    if (isInteraction) await context.reply({ content: '⌛ Ending giveaway...', ephemeral: true });
    await giveawayManager.endGiveaway(giveaway);
  } catch (err) {
    console.error(err);
    await context.reply({ embeds: [error('Failed to end giveaway.')], ephemeral: isInteraction }).catch(() => null);
  }
}

async function runReroll(context, messageId, isInteraction) {
  try {
    const giveaway = await Giveaway.findOne({ messageId });
    if (!giveaway) {
      return context.reply({ embeds: [error('Giveaway not found with that message ID.')], ephemeral: isInteraction });
    }

    if (!giveaway.ended) {
      return context.reply({ embeds: [error('Giveaway has not ended yet. End it first before rerolling.')], ephemeral: isInteraction });
    }

    if (isInteraction) await context.reply({ content: '⌛ Rerolling giveaway...', ephemeral: true });

    const winners = await giveawayManager.rerollGiveaway(giveaway, context.guild);
    const channel = await context.guild.channels.fetch(giveaway.channelId).catch(() => null);
    if (!channel) return;

    if (winners.length === 0) {
      await channel.send({ content: `⚠️ Reroll for **${giveaway.prize}** failed. No qualified participants found.` });
    } else {
      const winnersText = winners.map(id => `<@${id}>`).join(', ');
      await channel.send({ content: `🎉 **Rerolled Winner(s):** ${winnersText}! You won **${giveaway.prize}**!` });
    }
  } catch (err) {
    console.error(err);
    await context.reply({ embeds: [error('Failed to reroll giveaway.')], ephemeral: isInteraction }).catch(() => null);
  }
}

async function runDelete(message, messageId, isInteraction) {
  try {
    const res = await Giveaway.findOneAndDelete({ messageId });
    if (!res) return message.reply({ embeds: [error('Giveaway not found.')] });

    const targetMsg = await message.channel.messages.fetch(messageId).catch(() => null);
    if (targetMsg) await targetMsg.delete().catch(() => null);

    await message.reply({ embeds: [success('Giveaway configuration deleted successfully.')] });
  } catch (err) {
    console.error(err);
    await message.reply({ embeds: [error('Failed to delete giveaway.')] });
  }
}
