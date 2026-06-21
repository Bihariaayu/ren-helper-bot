const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const config = require('../../config');
const CustomEmbed = require('../../database/models/CustomEmbed');
const { createEmbed, success, error, info } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');

// active DM All sessions to lock concurrent operations: key = guildId
const activeDmSessions = new Map();

module.exports = {
  name: 'dmall',
  description: 'Sends a DM message or embed to every member in the server. (Owner Only)',
  slashData: new SlashCommandBuilder()
    .setName('dmall')
    .setDescription('Sends a DM to every member in the server. (Owner Only)')
    .addStringOption(opt => opt.setName('message').setDescription('Plain text message to send').setRequired(false))
    .addStringOption(opt => opt.setName('embed_id').setDescription('The custom ID of a saved embed to send').setRequired(false)),

  async executePrefix(message, args, client) {
    // Whitelist check
    if (!config.owners.includes(message.author.id)) {
      return message.reply({ embeds: [error('This command is restricted to the bot owner only.')] });
    }

    if (activeDmSessions.has(message.guild.id)) {
      return message.reply({ embeds: [error('A DM-all broadcast is already running in this server.')] });
    }

    const content = args.join(' ').trim();
    if (!content) {
      return message.reply({ embeds: [error('Please provide a message or embed ID. Usage: `-i dmall <message>` or `-i dmall embed:<id>`')] });
    }

    let textToSend = content;
    let embedId = null;

    if (content.startsWith('embed:')) {
      embedId = content.replace('embed:', '').trim();
      textToSend = null;
    }

    await handleDmAll(message, textToSend, embedId, false);
  },

  async executeSlash(interaction, client) {
    // Whitelist check
    if (!config.owners.includes(interaction.user.id)) {
      return interaction.reply({ embeds: [error('This command is restricted to the bot owner only.')], ephemeral: true });
    }

    if (activeDmSessions.has(interaction.guild.id)) {
      return interaction.reply({ embeds: [error('A DM-all broadcast is already running in this server.')], ephemeral: true });
    }

    const textToSend = interaction.options.getString('message');
    const embedId = interaction.options.getString('embed_id');

    if (!textToSend && !embedId) {
      return interaction.reply({ embeds: [error('You must specify either a text message or a saved embed ID to broadcast.')], ephemeral: true });
    }

    await handleDmAll(interaction, textToSend, embedId, true);
  },

  /**
   * Route button interactions for DMAll cancel clicks
   */
  async handleInteraction(interaction, client) {
    const customId = interaction.customId;
    const guildId = interaction.guildId;

    if (customId === 'dmall_cancel') {
      // check if active session exists and caller is owner
      if (!config.owners.includes(interaction.user.id)) {
        return interaction.reply({ embeds: [error('Only the bot owner who initiated the broadcast can cancel it.')], ephemeral: true });
      }

      const session = activeDmSessions.get(guildId);
      if (session) {
        session.isCancelled = true;
        await interaction.reply({ content: '⏱️ Requesting cancellation... the queue will halt shortly.', ephemeral: true });
      } else {
        await interaction.reply({ embeds: [error('No active broadcast found to cancel.')], ephemeral: true });
      }
    }
  }
};

async function handleDmAll(context, textToSend, embedId, isInteraction) {
  const guild = context.guild;
  const author = isInteraction ? context.user : context.author;
  let embedToSend = null;

  try {
    // Resolve embed if embedId is provided
    if (embedId) {
      const saved = await CustomEmbed.findOne({ guildId: guild.id, embedId: embedId.toLowerCase() });
      if (!saved) {
        return context.reply({ embeds: [error(`Saved embed with ID \`${embedId}\` was not found.`)] });
      }
      embedToSend = createEmbed(saved.data);
    }

    // 1. Fetch targets
    await context.reply({ content: '⏳ Gathering guild members, please wait...', ephemeral: isInteraction });
    const members = await guild.members.fetch({ force: true }).catch(() => guild.members.cache);
    const targets = [...members.values()].filter(m => !m.user.bot);

    if (targets.length === 0) {
      return context.channel.send({ embeds: [error('No human members found in this server to DM.')] });
    }

    // 2. Prompt Confirmation
    const confirmEmbed = info(
      `You are about to send a broadcast DM to **${targets.length}** members.\n` +
      `Estimated Time: ~**${Math.round((targets.length * 1.5) / 60)}** minutes.\n\n` +
      `Click **Confirm Send** to initiate the broadcast queue.`,
      `📢 DM All Broadcast Confirmation`
    );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('dmall_confirm').setLabel('Confirm Send').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('dmall_confirm_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
    );

    const promptMsg = await context.channel.send({ 
      embeds: [confirmEmbed], 
      components: [row] 
    });

    const collector = promptMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 30000
    });

    collector.on('collect', async (click) => {
      if (click.user.id !== author.id) {
        return click.reply({ embeds: [error('Only the owner who triggered the command can confirm.')], ephemeral: true });
      }

      if (click.customId === 'dmall_confirm') {
        // Start DM process
        await click.update({ content: '🚀 Starting broadcast...', embeds: [], components: [] });
        await startDmQueue(context, targets, textToSend, embedToSend, author);
      } else {
        await click.update({ embeds: [info('Broadcast cancelled by owner.')], components: [] });
      }
      collector.stop();
    });

    collector.on('end', (collected, reason) => {
      if (reason === 'time') {
        promptMsg.edit({ embeds: [error('Confirmation timed out.')], components: [] }).catch(() => null);
      }
    });

  } catch (err) {
    console.error('Error starting DMAll:', err);
    await context.channel.send({ embeds: [error('Failed to initialize DM All process.')] }).catch(() => null);
  }
}

/**
 * Handles the actual sequential sending of DMs with rate-limit delays
 */
async function startDmQueue(context, targets, text, embed, author) {
  const guild = context.guild;
  const total = targets.length;

  const session = {
    isCancelled: false,
    successCount: 0,
    failCount: 0
  };

  activeDmSessions.set(guild.id, session);
  logger.logToGuild(guild, 'DM Broadcast Started', `📢 Owner ${author} started a global DM broadcast targeting **${total}** users.`);

  // Create progress tracker message
  const progressEmbed = () => {
    const processed = session.successCount + session.failCount;
    const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
    
    // progress bar visual
    const filled = Math.min(10, Math.round(pct / 10));
    const empty = 10 - filled;
    const progressBar = '🟢'.repeat(filled) + '⚫'.repeat(empty);

    return info(
      `📡 **Broadcast Progress:**\n` +
      `${progressBar} \`${pct}%\` (${processed}/${total})\n\n` +
      `• **Success:** \`${session.successCount}\`\n` +
      `• **Failed:** \`${session.failCount}\`\n` +
      `• **Status:** \`${session.isCancelled ? 'Halting...' : 'Sending DMs...'}\``,
      `📢 DM Broadcast Active`
    );
  };

  const cancelRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('dmall_cancel').setLabel('🛑 Cancel Send').setStyle(ButtonStyle.Danger)
  );

  const trackerMsg = await context.channel.send({ 
    embeds: [progressEmbed()], 
    components: [cancelRow] 
  });

  // Periodically update progress tracker message
  const intervalId = setInterval(async () => {
    await trackerMsg.edit({ embeds: [progressEmbed()] }).catch(() => null);
  }, 7000);

  const startTime = Date.now();

  for (const member of targets) {
    if (session.isCancelled) break;

    try {
      if (embed) {
        await member.send({ embeds: [embed] });
      } else {
        await member.send(text);
      }
      session.successCount++;
    } catch (err) {
      // Failure (usually DMs closed / blocked bot)
      session.failCount++;
    }

    // Rate-limit safety delay (1.5 seconds)
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  // Finished or cancelled
  clearInterval(intervalId);
  activeDmSessions.delete(guild.id);

  const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
  
  const finalEmbed = info(
    `📢 **Broadcast completed.**\n\n` +
    `• **Total Targeted:** \`${total}\`\n` +
    `• **Delivered:** \`${session.successCount}\`\n` +
    `• **Failed / Closed DMs:** \`${session.failCount}\`\n` +
    `• **Status:** \`${session.isCancelled ? '🛑 Cancelled' : '✅ Completed'}\`\n` +
    `• **Time Elapsed:** \`${elapsedSeconds}\` seconds`,
    `📢 DM Broadcast Statistics`
  );

  await trackerMsg.edit({ embeds: [finalEmbed], components: [] }).catch(() => null);

  logger.logToGuild(
    guild, 
    'DM Broadcast Finished', 
    `📢 Broadcast finished.\n• Delivered: \`${session.successCount}\`\n• Failed: \`${session.failCount}\`\n• Status: \`${session.isCancelled ? 'Cancelled' : 'Completed'}\` (Elapsed: \`${elapsedSeconds}s\`)`
  );
}
