const { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ChannelType,
  WebhookClient
} = require('discord.js');
const GuildConfig = require('../../database/models/GuildConfig');
const CustomEmbed = require('../../database/models/CustomEmbed');
const { createEmbed, success, error, info } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');

// active building sessions: key = "guildId:userId"
const activeSessions = new Map();

module.exports = {
  name: 'embed',
  description: 'Interactive embed builder tool.',
  slashData: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Create, edit, and send custom embeds.')
    .addSubcommand(sub => sub
      .setName('create')
      .setDescription('Launch the interactive embed builder dashboard.')
    )
    .addSubcommand(sub => sub
      .setName('send')
      .setDescription('Sends a saved custom embed to a channel.')
      .addStringOption(opt => opt.setName('id').setDescription('The custom ID of the saved embed').setRequired(true))
      .addChannelOption(opt => opt.setName('channel').setDescription('Channel to send the embed to').setRequired(true).addChannelTypes(ChannelType.GuildText))
    ),

  async executePrefix(message, args, client) {
    const hasPerm = await checkEmbedPermission(message.member, message.guild);
    if (!hasPerm) {
      return message.reply({ embeds: [error('You do not have permission to use the embed builder.')] });
    }

    const sub = args[0]?.toLowerCase();
    if (!sub || sub === 'help') {
      const helpEmbed = info(
        `**Embed Builder Prefix Commands:**\n` +
        `• \`r?embed create\` - Opens the interactive embed builder\n` +
        `• \`r?embed send <id> #channel\` - Sends a saved embed\n` +
        `• \`r?embed delete <id>\` - Deletes a saved embed`,
        `🎨 Embed Builder Help`
      );
      return message.reply({ embeds: [helpEmbed] });
    }

    if (sub === 'create') {
      await startBuilderSession(message, message.author, false);
      return;
    }

    if (sub === 'send') {
      const id = args[1];
      const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[2]);
      if (!id || !channel || channel.type !== ChannelType.GuildText) {
        return message.reply({ embeds: [error('Invalid arguments. Usage: `r?embed send <id> #channel`')] });
      }
      await sendSavedEmbed(message, id, channel);
      return;
    }

    if (sub === 'delete') {
      const id = args[1];
      if (!id) {
        return message.reply({ embeds: [error('Usage: `r?embed delete <id>`')] });
      }
      await deleteSavedEmbed(message, id);
      return;
    }

    return message.reply({ embeds: [error('Unknown subcommand. Type `r?embed help` for instructions.')] });
  },

  async executeSlash(interaction, client) {
    const hasPerm = await checkEmbedPermission(interaction.member, interaction.guild);
    if (!hasPerm) {
      return interaction.reply({ embeds: [error('You do not have permission to use the embed builder.')], ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    
    if (sub === 'create') {
      await startBuilderSession(interaction, interaction.user, true);
    } else if (sub === 'send') {
      const id = interaction.options.getString('id');
      const channel = interaction.options.getChannel('channel');
      await sendSavedEmbed(interaction, id, channel);
    }
  },

  /**
   * Handles button click routing for custom embed menu
   */
  async handleInteraction(interaction, client) {
    const key = `${interaction.guildId}:${interaction.user.id}`;
    const customId = interaction.customId;
    const session = activeSessions.get(key);

    if (!session) {
      return interaction.reply({ embeds: [error('No active embed builder session found. Start one with `r?embed create`. (Sessions expire after inactivity)')], ephemeral: true });
    }

    if (!interaction.isButton()) return;

    // --- MAIN BUILDER SCREEN BUTTONS ---
    if (customId === 'embed_btn_title') {
      await promptChatInput(interaction, session, 'title', 'Enter title in the chat within next 10 minutes.');
    }
    else if (customId === 'embed_btn_desc') {
      await promptChatInput(interaction, session, 'desc', 'Enter description in the chat within next 10 minutes.');
    }
    else if (customId === 'embed_btn_color') {
      await promptChatInput(interaction, session, 'color', 'Enter color (Hex code) in the chat within next 10 minutes.');
    }
    else if (customId === 'embed_btn_image') {
      await promptChatInput(interaction, session, 'image', 'Enter image URL in the chat within next 10 minutes.');
    }
    else if (customId === 'embed_btn_thumbnail') {
      await promptChatInput(interaction, session, 'thumbnail', 'Enter thumbnail URL in the chat within next 10 minutes.');
    }
    else if (customId === 'embed_btn_json') {
      await promptChatInput(interaction, session, 'json', 'Enter full embed JSON in the chat within next 10 minutes.');
    }
    else if (customId === 'embed_btn_exit') {
      if (session.currentCollector) session.currentCollector.stop('exit');
      activeSessions.delete(key);
      await interaction.update({
        embeds: [info('Embed building session has been closed.')],
        components: []
      });
    }

    // TRANSITION TO SAVE SCREEN
    else if (customId === 'embed_btn_save') {
      if (session.currentCollector) session.currentCollector.stop('save_screen');
      
      const previewEmbed = createEmbed(session.embedData);
      const saveRows = getSaveScreenButtons();

      await interaction.update({
        embeds: [previewEmbed],
        components: saveRows
      });
    }

    // --- SAVE SCREEN BUTTONS ---
    else if (customId === 'embed_btn_add_link') {
      await promptChatInput(interaction, session, 'link', 'Enter the link button details in the chat (Format: Label | URL) within next 10 minutes.');
    }
    else if (customId === 'embed_btn_webhook') {
      await promptChatInput(interaction, session, 'webhook', 'Enter the Webhook URL in the chat within next 10 minutes.');
    }
    else if (customId === 'embed_btn_finish_send') {
      // Transition to destination choice screen
      const previewEmbed = createEmbed(session.embedData);
      const choiceRows = getDestinationChoiceButtons();

      await interaction.update({
        embeds: [previewEmbed],
        components: choiceRows
      });
    }

    // --- SEND DESTINATION SCREEN BUTTONS ---
    else if (customId === 'embed_btn_send_here') {
      await sendEmbedToDestination(interaction, session, interaction.channel);
    }
    else if (customId === 'embed_btn_send_other') {
      await promptChatInput(interaction, session, 'other_channel', 'Enter the ID or mention of the channel where you want to send the embed.');
    }
    else if (customId === 'embed_btn_cancel_send') {
      // Back to save screen
      const previewEmbed = createEmbed(session.embedData);
      const saveRows = getSaveScreenButtons();

      await interaction.update({
        embeds: [previewEmbed],
        components: saveRows
      });
    }
  }
};

/**
 * Checks if a member has permission to build embeds
 */
async function checkEmbedPermission(member, guild) {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  
  const configData = await GuildConfig.findOne({ guildId: guild.id });
  if (!configData || !configData.embedRoles || configData.embedRoles.length === 0) return false;

  return member.roles.cache.some(role => configData.embedRoles.includes(role.id));
}

/**
 * Starts a new interactive builder session
 */
async function startBuilderSession(context, user, isInteraction) {
  const key = `${context.guild.id}:${user.id}`;
  
  const session = {
    embedData: {
      description: 'Use the buttons below to add fields',
      color: 0x5865F2,
    },
    linkButtons: [],
    message: null,
    currentCollector: null
  };

  activeSessions.set(key, session);

  setTimeout(() => {
    if (activeSessions.has(key)) {
      const active = activeSessions.get(key);
      if (active.currentCollector) active.currentCollector.stop('timeout');
      activeSessions.delete(key);
    }
  }, 15 * 60 * 1000);

  const previewEmbed = createEmbed(session.embedData);
  const rows = getBuilderButtons();

  if (isInteraction) {
    const msg = await context.reply({ embeds: [previewEmbed], components: rows, fetchReply: true });
    session.message = msg;
  } else {
    const msg = await context.reply({ embeds: [previewEmbed], components: rows });
    session.message = msg;
  }
}

/**
 * Prompts user for chat input and creates a message collector to capture it
 */
async function promptChatInput(interaction, session, fieldName, promptMessage) {
  if (session.currentCollector) {
    session.currentCollector.stop('new_prompt');
  }

  await interaction.reply({ content: `💬 ${promptMessage}`, ephemeral: true });

  const channel = interaction.channel;
  const filter = m => m.author.id === interaction.user.id;
  const collector = channel.createMessageCollector({ filter, time: 600000 }); // 10 minutes
  
  session.currentCollector = collector;

  collector.on('collect', async (msg) => {
    try {
      const content = msg.content.trim();

      if (channel.permissionsFor(interaction.guild.members.me).has('ManageMessages')) {
        await msg.delete().catch(() => null);
      }

      if (fieldName === 'title') {
        session.embedData.title = content;
      } 
      else if (fieldName === 'desc') {
        session.embedData.description = content;
      } 
      else if (fieldName === 'color') {
        session.embedData.color = content;
      } 
      else if (fieldName === 'image') {
        session.embedData.image = content;
      } 
      else if (fieldName === 'thumbnail') {
        session.embedData.thumbnail = content;
      } 
      else if (fieldName === 'json') {
        try {
          const parsed = JSON.parse(content);
          session.embedData = { ...session.embedData, ...parsed };
        } catch (e) {
          await channel.send({ embeds: [error('Invalid JSON structure.')] }).then(m => setTimeout(() => m.delete().catch(() => null), 5000));
          collector.stop('invalid_json');
          return;
        }
      } 
      else if (fieldName === 'link') {
        const parts = content.split('|');
        if (parts.length < 2) {
          await channel.send({ embeds: [error('Invalid link format. Use `Label | URL`')] }).then(m => setTimeout(() => m.delete().catch(() => null), 5000));
          collector.stop('invalid_link');
          return;
        }

        const label = parts[0].trim();
        const url = parts[1].trim();

        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          await channel.send({ embeds: [error('URL must start with http:// or https://')] }).then(m => setTimeout(() => m.delete().catch(() => null), 5000));
          collector.stop('invalid_link');
          return;
        }

        if (!session.linkButtons) session.linkButtons = [];
        session.linkButtons.push({ label, url });

        await channel.send({ content: `✅ Link button **${label}** added.` }).then(m => setTimeout(() => m.delete().catch(() => null), 3000));
        collector.stop('collected');
        return;
      }
      else if (fieldName === 'webhook') {
        try {
          const webhook = new WebhookClient({ url: content });
          const webhookEmbed = createEmbed(session.embedData);

          const payload = { embeds: [webhookEmbed] };
          if (session.linkButtons && session.linkButtons.length > 0) {
            const row = new ActionRowBuilder();
            session.linkButtons.forEach(btn => {
              row.addComponents(new ButtonBuilder().setLabel(btn.label).setURL(btn.url).setStyle(ButtonStyle.Link));
            });
            payload.components = [row];
          }

          await webhook.send(payload);
          await channel.send({ embeds: [success('Embed sent successfully via Webhook!')] }).then(m => setTimeout(() => m.delete().catch(() => null), 5000));
          
          activeSessions.delete(`${interaction.guildId}:${interaction.user.id}`);
          collector.stop('webhook_sent');

          await session.message.edit({
            embeds: [success('Embed successfully broadcasted via Webhook.')],
            components: []
          }).catch(() => null);
          return;
        } catch (e) {
          await channel.send({ embeds: [error('Failed to send webhook. Verify the URL is correct.')] }).then(m => setTimeout(() => m.delete().catch(() => null), 5000));
          collector.stop('webhook_failed');
          return;
        }
      }
      else if (fieldName === 'other_channel') {
        const cleanedId = content.replace(/[<#>]/g, '');
        const targetChannel = await interaction.guild.channels.fetch(cleanedId).catch(() => null);

        if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
          await channel.send({ embeds: [error('Invalid channel. Please mention a valid text channel or provide a valid channel ID.')] }).then(m => setTimeout(() => m.delete().catch(() => null), 5000));
          collector.stop('channel_failed');
          return;
        }

        collector.stop('channel_found');
        await sendEmbedToDestination(interaction, session, targetChannel);
        return;
      }

      // Update the preview message
      const updatedEmbed = createEmbed(session.embedData);
      await session.message.edit({ embeds: [updatedEmbed] }).catch(() => null);

      await channel.send({ content: `✅ **${fieldName.toUpperCase()}** updated.` }).then(m => setTimeout(() => m.delete().catch(() => null), 3000));
      collector.stop('collected');

    } catch (err) {
      console.error(`Error collecting chat input for ${fieldName}:`, err);
    }
  });

  collector.on('end', (collected, reason) => {
    if (reason === 'time') {
      channel.send({ content: `⚠️ Timeout: Input session expired.` }).then(m => setTimeout(() => m.delete().catch(() => null), 5000));
    }
  });
}

/**
 * Sends the final embed to a selected destination and wraps up the session
 */
async function sendEmbedToDestination(interaction, session, destinationChannel) {
  try {
    const finalEmbed = createEmbed(session.embedData);
    const payload = { embeds: [finalEmbed] };

    // Attach any link buttons if configured
    if (session.linkButtons && session.linkButtons.length > 0) {
      const row = new ActionRowBuilder();
      session.linkButtons.forEach(btn => {
        row.addComponents(new ButtonBuilder().setLabel(btn.label).setURL(btn.url).setStyle(ButtonStyle.Link));
      });
      payload.components = [row];
    }

    await destinationChannel.send(payload);

    // Save to database with auto generated ID
    const embedId = 'auto_' + Math.random().toString(36).substring(2, 8);
    await CustomEmbed.create({
      guildId: interaction.guildId,
      embedId,
      data: session.embedData,
      creatorId: interaction.user.id
    });

    activeSessions.delete(`${interaction.guildId}:${interaction.user.id}`);

    await session.message.edit({
      embeds: [success(`Embed successfully sent to ${destinationChannel}!\nSaved in database under ID: \`${embedId}\`.`)],
      components: []
    }).catch(() => null);

    logger.logToGuild(interaction.guild, 'Embed Sent', `🎨 Custom embed sent to ${destinationChannel} by ${interaction.user}`);

  } catch (err) {
    console.error('Error sending embed to destination:', err);
    await interaction.reply({ embeds: [error('Failed to send the embed to that channel.')], ephemeral: true }).catch(() => null);
  }
}

/**
 * Returns the button layout for the main editor screen
 */
function getBuilderButtons() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('embed_btn_title').setLabel('Title').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('embed_btn_desc').setLabel('Description').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('embed_btn_color').setLabel('Color').setStyle(ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('embed_btn_image').setLabel('Image').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('embed_btn_thumbnail').setLabel('Thumbnail').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('embed_btn_json').setLabel('JSON').setStyle(ButtonStyle.Success)
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('embed_btn_save').setLabel('Save').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('embed_btn_exit').setLabel('Exit').setStyle(ButtonStyle.Danger)
  );

  return [row1, row2, row3];
}

/**
 * Returns the button layout for the Save screen matching the user's uploaded image
 */
function getSaveScreenButtons() {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('embed_btn_add_link').setLabel('Add Link Buttons').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('embed_btn_webhook').setLabel('Send As Webhook').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('embed_btn_finish_send').setLabel('Finish and Send').setStyle(ButtonStyle.Success)
  );
  return [row];
}

/**
 * Returns the button layout to pick a sending destination
 */
function getDestinationChoiceButtons() {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('embed_btn_send_here').setLabel('Send Here').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('embed_btn_send_other').setLabel('Send in Another Channel').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('embed_btn_cancel_send').setLabel('Back / Cancel').setStyle(ButtonStyle.Danger)
  );
  return [row];
}

/**
 * Sends a saved custom embed to a target channel
 */
async function sendSavedEmbed(context, id, channel) {
  try {
    const guild = context.guild;
    const author = context.user || context.author;
    const saved = await CustomEmbed.findOne({ guildId: guild.id, embedId: id.trim().toLowerCase() });

    if (!saved) {
      return context.reply({ embeds: [error(`No saved embed found with ID: \`${id}\`.`)] });
    }

    const embed = createEmbed(saved.data);
    await channel.send({ embeds: [embed] });

    await context.reply({ embeds: [success(`Saved embed \`${id}\` has been successfully sent to ${channel}.`)] });
    logger.logToGuild(guild, 'Embed Sent', `🎨 Custom embed \`${id}\` sent to ${channel} by ${author}`);
  } catch (err) {
    console.error('Error sending saved embed:', err);
    await context.reply({ embeds: [error('Failed to send the saved embed.')], ephemeral: true }).catch(() => null);
  }
}

/**
 * Deletes a saved custom embed
 */
async function deleteSavedEmbed(message, id) {
  try {
    const guild = message.guild;
    const res = await CustomEmbed.findOneAndDelete({ guildId: guild.id, embedId: id.trim().toLowerCase() });

    if (!res) {
      return message.reply({ embeds: [error(`No saved embed found with ID: \`${id}\`.`)] });
    }

    await message.reply({ embeds: [success(`Successfully deleted saved embed \`${id}\`.`)] });
    logger.logToGuild(guild, 'Embed Deleted', `🎨 Custom embed \`${id}\` was deleted by ${message.author}`);
  } catch (err) {
    console.error('Error deleting embed:', err);
    await message.reply({ embeds: [error('Failed to delete saved embed.')] }).catch(() => null);
  }
}
