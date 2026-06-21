const { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  StringSelectMenuBuilder,
  ChannelType,
  time,
  AttachmentBuilder
} = require('discord.js');
const TicketConfig = require('../../database/models/TicketConfig');
const TicketInstance = require('../../database/models/TicketInstance');
const TicketReview = require('../../database/models/TicketReview');
const TicketStaffStats = require('../../database/models/TicketStaffStats');
const { createEmbed, success, error, info } = require('../../utils/embedBuilder');
const { generateTranscript } = require('../../utils/transcriptGenerator');
const logger = require('../../utils/logger');

// Setup sessions: key = "guildId:userId"
const activeSetupSessions = new Map();

module.exports = {
  name: 'ticket',
  description: 'Advanced ticket management system commands.',
  slashData: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ticket management suite.')
    .addSubcommand(sub => sub.setName('setup').setDescription('Set up the ticket panels.'))
    .addSubcommand(sub => sub.setName('config').setDescription('Access interactive configuration menu.'))
    .addSubcommand(sub => sub.setName('create').setDescription('Create a ticket manually.'))
    .addSubcommand(sub => sub.setName('close').setDescription('Closes the active support ticket.').addStringOption(opt => opt.setName('reason').setDescription('Reason for closing').setRequired(false)))
    .addSubcommand(sub => sub.setName('reopen').setDescription('Reopens a closed ticket.'))
    .addSubcommand(sub => sub.setName('claim').setDescription('Claims the active ticket.'))
    .addSubcommand(sub => sub.setName('unclaim').setDescription('Unclaims the active ticket.'))
    .addSubcommand(sub => sub.setName('transfer').setDescription('Transfers ticket to another staff member.').addUserOption(opt => opt.setName('staff').setDescription('Target staff member').setRequired(true)))
    .addSubcommand(sub => sub.setName('add').setDescription('Adds a user to this ticket.').addUserOption(opt => opt.setName('user').setDescription('User to add').setRequired(true)))
    .addSubcommand(sub => sub.setName('remove').setDescription('Removes a user from this ticket.').addUserOption(opt => opt.setName('user').setDescription('User to remove').setRequired(true)))
    .addSubcommand(sub => sub.setName('rename').setDescription('Renames this ticket channel.').addStringOption(opt => opt.setName('name').setDescription('New channel name').setRequired(true)))
    .addSubcommand(sub => sub.setName('transcript').setDescription('Generates a chat transcript of the ticket.'))
    .addSubcommand(sub => sub.setName('info').setDescription('Shows details about the active ticket.'))
    .addSubcommand(sub => sub.setName('stats').setDescription('Display ticket system statistics.'))
    .addSubcommand(sub => sub.setName('leaderboard').setDescription('View top support staff leaderboards.'))
    .addSubcommand(sub => sub.setName('reviews').setDescription('View user satisfaction ratings & feedback.')),

  async executePrefix(message, args, client) {
    const sub = args[0]?.toLowerCase();
    
    // Auth validation for setup/config
    const isSetupCmd = ['setup', 'config', 'delete', 'create'].includes(sub);
    const hasAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator);

    if (isSetupCmd && !hasAdmin) {
      return message.reply({ embeds: [error('You must be an Administrator to configure tickets.')] });
    }

    if (!sub || sub === 'help') {
      const helpEmbed = info(
        `**Ticket Prefix Commands:**\n` +
        `• \`r?ticket setup\` - Set up the ticket panel\n` +
        `• \`r?ticket config\` - Toggle advanced settings\n` +
        `• \`r?ticket close [reason]\` - Close ticket\n` +
        `• \`r?ticket claim\` / \`unclaim\` - Claim ticket\n` +
        `• \`r?ticket transfer @staff\` - Transfer ticket\n` +
        `• \`r?ticket add\` / \`remove\` - Add/remove users\n` +
        `• \`r?ticket rename <name>\` - Rename channel\n` +
        `• \`r?ticket transcript\` - Save chat logs\n` +
        `• \`r?ticket stats\` / \`leaderboard\` / \`reviews\` - Check stats`,
        `🎫 Ticket Management Help`
      );
      return message.reply({ embeds: [helpEmbed] });
    }

    // Route Prefix commands
    if (sub === 'setup') return startSetup(message, message.author, false);
    if (sub === 'config') return startConfig(message, false);
    if (sub === 'create') return runCreate(message, false);
    
    // In-ticket action routing
    if (sub === 'close') {
      const reason = args.slice(1).join(' ') || 'No reason provided';
      return runClose(message, reason, false);
    }
    if (sub === 'reopen') return runReopen(message, false);
    if (sub === 'claim') return runClaim(message, message.author, false);
    if (sub === 'unclaim') return runUnclaim(message, message.author, false);
    if (sub === 'transfer') {
      const staff = message.mentions.users.first() || client.users.cache.get(args[1]);
      if (!staff) return message.reply({ embeds: [error('Please mention a staff member.')] });
      return runTransfer(message, staff, false);
    }
    if (sub === 'add') {
      const user = message.mentions.users.first() || client.users.cache.get(args[1]);
      if (!user) return message.reply({ embeds: [error('Please mention a user.')] });
      return runAdd(message, user, false);
    }
    if (sub === 'remove') {
      const user = message.mentions.users.first() || client.users.cache.get(args[1]);
      if (!user) return message.reply({ embeds: [error('Please mention a user.')] });
      return runRemove(message, user, false);
    }
    if (sub === 'rename') {
      const name = args.slice(1).join('-').trim();
      if (!name) return message.reply({ embeds: [error('Please provide a channel name.')] });
      return runRename(message, name, false);
    }
    if (sub === 'transcript') return runTranscript(message, false);
    if (sub === 'info') return runInfo(message, false);
    
    // Leaderboard/Stats
    if (sub === 'stats') return runStats(message, false);
    if (sub === 'leaderboard') return runLeaderboard(message, false);
    if (['reviews', 'ratings', 'feedback'].includes(sub)) return runReviews(message, false);

    return message.reply({ embeds: [error('Unknown ticket subcommand. Type `r?ticket help` for usage.')] });
  },

  async executeSlash(interaction, client) {
    const sub = interaction.options.getSubcommand();
    
    // Auth check
    const isSetupCmd = ['setup', 'config', 'create'].includes(sub);
    const hasAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    if (isSetupCmd && !hasAdmin) {
      return interaction.reply({ embeds: [error('You must be an Administrator to run configuration commands.')], ephemeral: true });
    }

    if (sub === 'setup') return startSetup(interaction, interaction.user, true);
    if (sub === 'config') return startConfig(interaction, true);
    if (sub === 'create') return runCreate(interaction, true);
    
    if (sub === 'close') {
      const reason = interaction.options.getString('reason') || 'No reason provided';
      return runClose(interaction, reason, true);
    }
    if (sub === 'reopen') return runReopen(interaction, true);
    if (sub === 'claim') return runClaim(interaction, interaction.user, true);
    if (sub === 'unclaim') return runUnclaim(interaction, interaction.user, true);
    if (sub === 'transfer') {
      const staff = interaction.options.getUser('staff');
      return runTransfer(interaction, staff, true);
    }
    if (sub === 'add') {
      const user = interaction.options.getUser('user');
      return runAdd(interaction, user, true);
    }
    if (sub === 'remove') {
      const user = interaction.options.getUser('user');
      return runRemove(interaction, user, true);
    }
    if (sub === 'rename') {
      const name = interaction.options.getString('name');
      return runRename(interaction, name, true);
    }
    if (sub === 'transcript') return runTranscript(interaction, true);
    if (sub === 'info') return runInfo(interaction, true);
    
    if (sub === 'stats') return runStats(interaction, true);
    if (sub === 'leaderboard') return runLeaderboard(interaction, true);
    if (sub === 'reviews') return runReviews(interaction, true);
  },

  // Export handlers to route button clicks in interactionCreate.js
  activeSetupSessions,
  handleInteraction: async (interaction, client) => {
    await handleSetupButtons(interaction, client);
    await handleConfigButtons(interaction, client);
    await handleTicketActionButtons(interaction, client);
    await handleSatisfactionRatingButtons(interaction, client);
  }
};

// ==========================================
// SETUP PANEL BUILDER (MATCHING USER IMAGES)
// ==========================================

async function startSetup(context, user, isInteraction) {
  const key = `${context.guild.id}:${user.id}`;
  
  const session = {
    embedData: {
      description: 'Please enter the requested information as prompted. This embed will automatically populate with the information you provide.',
      color: 0x5865F2,
    },
    message: null,
    currentCollector: null
  };

  activeSetupSessions.set(key, session);

  const previewEmbed = createEmbed(session.embedData);
  const rows = getSetupScreenButtons();

  if (isInteraction) {
    const msg = await context.reply({ embeds: [previewEmbed], components: rows, fetchReply: true });
    session.message = msg;
  } else {
    const msg = await context.reply({ embeds: [previewEmbed], components: rows });
    session.message = msg;
  }
}

function getSetupScreenButtons() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_setup_title').setLabel('Title').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('ticket_setup_desc').setLabel('Description').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('ticket_setup_color').setLabel('Color').setStyle(ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_setup_image').setLabel('Image').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticket_setup_thumbnail').setLabel('Thumbnail').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticket_setup_json').setLabel('JSON').setStyle(ButtonStyle.Success)
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_setup_save').setLabel('Save & Set Category').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('ticket_setup_exit').setLabel('Exit').setStyle(ButtonStyle.Danger)
  );

  return [row1, row2, row3];
}

async function handleSetupButtons(interaction, client) {
  const key = `${interaction.guildId}:${interaction.user.id}`;
  const customId = interaction.customId;
  const session = activeSetupSessions.get(key);

  if (!session || !customId.startsWith('ticket_setup_')) return;

  if (customId === 'ticket_setup_title') {
    await promptSetupInput(interaction, session, 'title', 'Enter title in the chat within next 10 minutes.');
  }
  else if (customId === 'ticket_setup_desc') {
    await promptSetupInput(interaction, session, 'desc', 'Enter description in the chat within next 10 minutes.');
  }
  else if (customId === 'ticket_setup_color') {
    await promptSetupInput(interaction, session, 'color', 'Enter color (Hex code) in the chat within next 10 minutes.');
  }
  else if (customId === 'ticket_setup_image') {
    await promptSetupInput(interaction, session, 'image', 'Enter image URL in the chat within next 10 minutes.');
  }
  else if (customId === 'ticket_setup_thumbnail') {
    await promptSetupInput(interaction, session, 'thumbnail', 'Enter thumbnail URL in the chat within next 10 minutes.');
  }
  else if (customId === 'ticket_setup_json') {
    await promptSetupInput(interaction, session, 'json', 'Enter full panel embed JSON in the chat within next 10 minutes.');
  }
  else if (customId === 'ticket_setup_exit') {
    if (session.currentCollector) session.currentCollector.stop('exit');
    activeSetupSessions.delete(key);
    await interaction.update({
      embeds: [info('Ticket panel setup session has been closed.')],
      components: []
    });
  }
  else if (customId === 'ticket_setup_save') {
    await promptSetupInput(interaction, session, 'save', 'Enter the Category ID where you want tickets to be created.');
  }
}

async function promptSetupInput(interaction, session, fieldName, promptMessage) {
  if (session.currentCollector) {
    session.currentCollector.stop('new_prompt');
  }

  await interaction.reply({ content: `💬 ${promptMessage}`, ephemeral: true });

  const channel = interaction.channel;
  const filter = m => m.author.id === interaction.user.id;
  const collector = channel.createMessageCollector({ filter, time: 600000 });
  
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
      else if (fieldName === 'save') {
        // Validate category ID
        const category = await interaction.guild.channels.fetch(content).catch(() => null);
        if (!category || category.type !== ChannelType.GuildCategory) {
          await channel.send({ embeds: [error('Invalid ID. Please specify a valid Guild Category ID.')] }).then(m => setTimeout(() => m.delete().catch(() => null), 5000));
          collector.stop('category_failed');
          return;
        }

        // Save Config in DB
        await TicketConfig.findOneAndUpdate(
          { guildId: interaction.guildId },
          { 
            $set: { 
              panelEmbed: session.embedData,
              categoryId: category.id
            }
          },
          { upsert: true }
        );

        activeSetupSessions.delete(`${interaction.guildId}:${interaction.user.id}`);
        collector.stop('saved');

        // Deploy panel
        const panelEmbed = createEmbed(session.embedData);
        const panelRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('ticket_create_btn').setLabel('🎫 Create Ticket').setStyle(ButtonStyle.Primary)
        );

        await session.message.edit({
          embeds: [success(`Ticket Panel configured successfully and bound to Category: **${category.name}**!`)],
          components: []
        }).catch(() => null);

        // Send panel in the channel
        await channel.send({ embeds: [panelEmbed], components: [panelRow] });
        
        logger.logToGuild(interaction.guild, 'Ticket Panel Created', `🎫 Ticket creation panel deployed in ${channel} by ${interaction.user}`);
        return;
      }

      const updatedEmbed = createEmbed(session.embedData);
      await session.message.edit({ embeds: [updatedEmbed] }).catch(() => null);

      await channel.send({ content: `✅ **${fieldName.toUpperCase()}** updated.` }).then(m => setTimeout(() => m.delete().catch(() => null), 3000));
      collector.stop('collected');

    } catch (err) {
      console.error(`Error collecting ticket setup input:`, err);
    }
  });
}

// ==========================================
// CONFIG SCREEN (TOGGLE INTERFACE MATCHING USER IMAGE)
// ==========================================

async function startConfig(context, isInteraction) {
  const guild = context.guild;
  let conf = await TicketConfig.findOne({ guildId: guild.id });
  if (!conf) {
    conf = await TicketConfig.create({ guildId: guild.id });
  }

  const preview = info(
    `Set your advanced ticket configurations below. Buttons show green when enabled, and red when disabled.`,
    `⚙️ Advance Configuration`
  );

  const rows = getConfigTogglesRows(conf);

  if (isInteraction) {
    await context.reply({ embeds: [preview], components: rows });
  } else {
    await context.reply({ embeds: [preview], components: rows });
  }
}

function getConfigTogglesRows(conf) {
  // Row 1
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_cfg_close').setLabel('Member can close').setStyle(conf.memberCanClose ? ButtonStyle.Success : ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ticket_cfg_name').setLabel('Consistent Channel name').setStyle(conf.consistentChannelName ? ButtonStyle.Success : ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ticket_cfg_mention').setLabel('Role Mention').setStyle(conf.roleMention ? ButtonStyle.Success : ButtonStyle.Danger)
  );

  // Row 2
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_cfg_stats').setLabel('Show Opened Stats on Button').setStyle(conf.showOpenedStats ? ButtonStyle.Success : ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ticket_cfg_perm').setLabel('Give Permissions').setStyle(conf.givePermissionsAuto ? ButtonStyle.Success : ButtonStyle.Danger)
  );

  // Row 3
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_cfg_claim').setLabel('Ticket Claimable').setStyle(conf.claimable ? ButtonStyle.Success : ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ticket_cfg_limit').setLabel('One Ticket Per User').setStyle(conf.oneTicketPerUser ? ButtonStyle.Success : ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ticket_cfg_back').setLabel('Go Back').setStyle(ButtonStyle.Secondary)
  );

  return [row1, row2, row3];
}

async function handleConfigButtons(interaction, client) {
  const customId = interaction.customId;
  const guildId = interaction.guildId;

  if (!customId.startsWith('ticket_cfg_')) return;

  // Authorization check
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ embeds: [error('You must be an Administrator to toggle configurations.')], ephemeral: true });
  }

  let conf = await TicketConfig.findOne({ guildId });
  if (!conf) conf = new TicketConfig({ guildId });

  if (customId === 'ticket_cfg_close') {
    conf.memberCanClose = !conf.memberCanClose;
  }
  else if (customId === 'ticket_cfg_name') {
    conf.consistentChannelName = !conf.consistentChannelName;
  }
  else if (customId === 'ticket_cfg_mention') {
    conf.roleMention = !conf.roleMention;
  }
  else if (customId === 'ticket_cfg_stats') {
    conf.showOpenedStats = !conf.showOpenedStats;
  }
  else if (customId === 'ticket_cfg_perm') {
    conf.givePermissionsAuto = !conf.givePermissionsAuto;
  }
  else if (customId === 'ticket_cfg_claim') {
    conf.claimable = !conf.claimable;
  }
  else if (customId === 'ticket_cfg_limit') {
    conf.oneTicketPerUser = !conf.oneTicketPerUser;
  }
  else if (customId === 'ticket_cfg_back') {
    return interaction.update({
      embeds: [info('Advanced configuration closed.')],
      components: []
    });
  }

  await conf.save();

  // Re-render menu
  const rows = getConfigTogglesRows(conf);
  await interaction.update({ components: rows });
}

// ==========================================
// TICKET ACTION LISTENERS & WELCOMING FLOW
// ==========================================

async function handleTicketActionButtons(interaction, client) {
  const customId = interaction.customId;
  const guild = interaction.guild;
  const user = interaction.user;

  // 1. CREATE TICKET ACTION BUTTON CLICKED (Panel Click)
  if (customId === 'ticket_create_btn') {
    await executeTicketCreation(interaction, user, guild);
  }

  // 2. IN-TICKET QUICK BUTTON ACTIONS
  if (customId.startsWith('ticket_action_')) {
    const action = customId.replace('ticket_action_', '');
    const ticket = await TicketInstance.findOne({ guildId: guild.id, channelId: interaction.channelId });

    if (!ticket) {
      return interaction.reply({ embeds: [error('This channel is not registered as an active ticket.')], ephemeral: true });
    }

    if (action === 'close') {
      // Prompt modal close reason
      await promptCloseReasonModal(interaction);
    }
    else if (action === 'claim') {
      await runClaim(interaction, user, true);
    }
    else if (action === 'unclaim') {
      await runUnclaim(interaction, user, true);
    }
    else if (action === 'transfer') {
      await interaction.reply({ content: '💡 To transfer, type: `r?ticket transfer @staff` or use the slash command.', ephemeral: true });
    }
    else if (action === 'add') {
      await interaction.reply({ content: '💡 To add a user, type: `r?ticket add @user` or use the slash command.', ephemeral: true });
    }
  }
}

async function executeTicketCreation(interaction, creator, guild) {
  try {
    const conf = await TicketConfig.findOne({ guildId: guild.id });
    if (!conf || !conf.categoryId) {
      return interaction.reply({ embeds: [error('The ticket system is not configured. Admin must run `r?ticket setup`.')], ephemeral: true });
    }

    // Limit check
    if (conf.oneTicketPerUser) {
      const active = await TicketInstance.findOne({ guildId: guild.id, userId: creator.id, status: 'open' });
      if (active) {
        return interaction.reply({ embeds: [error('You already have an active support ticket open.')], ephemeral: true });
      }
    }

    // Generate unique ID / Case ID
    const count = await TicketInstance.countDocuments({ guildId: guild.id });
    const caseId = `#${1000 + count + 1}`;

    const channelName = conf.consistentChannelName 
      ? `ticket-${creator.username}`.toLowerCase()
      : `ticket-${caseId.replace('#', '')}`;

    await interaction.reply({ content: '🎫 Creating your ticket channel...', ephemeral: true });

    // Establish Permission Overrides
    const overrides = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: creator.id,
        allow: [
          PermissionFlagsBits.ViewChannel, 
          PermissionFlagsBits.SendMessages, 
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.AttachFiles
        ]
      }
    ];

    // Grant Support Roles permissions
    if (conf.supportRoleIds && conf.supportRoleIds.length > 0) {
      conf.supportRoleIds.forEach(roleId => {
        overrides.push({
          id: roleId,
          allow: [
            PermissionFlagsBits.ViewChannel, 
            PermissionFlagsBits.SendMessages, 
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.AttachFiles
          ]
        });
      });
    }

    // Create channel
    const ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: conf.categoryId,
      permissionOverwrites: overrides
    });

    // Save ticket instance in database
    await TicketInstance.create({
      guildId: guild.id,
      channelId: ticketChannel.id,
      userId: creator.id,
      caseId,
      status: 'open'
    });

    // Welcome embed with quick action buttons
    const welcomeEmbed = info(
      `Welcome ${creator} to your support ticket.\n` +
      `Our staff team will assist you shortly.\n\n` +
      `Use the buttons below to perform quick actions:`,
      `🎫 Ticket Welcome Panel`
    );

    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_action_close').setLabel('🔒 Close').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('ticket_action_claim').setLabel('👤 Claim').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('ticket_action_unclaim').setLabel('🔓 Unclaim').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket_action_add').setLabel('➕ Add User').setStyle(ButtonStyle.Primary)
    );

    await ticketChannel.send({ embeds: [welcomeEmbed], components: [actionRow] });

    if (conf.roleMention && conf.supportRoleIds && conf.supportRoleIds.length > 0) {
      const mentionStr = conf.supportRoleIds.map(id => `<@&${id}>`).join(' ');
      await ticketChannel.send({ content: `🔔 Support Alert: ${mentionStr}` }).then(m => setTimeout(() => m.delete().catch(() => null), 3000));
    }

    await interaction.followUp({ content: `🎫 Your ticket has been created: ${ticketChannel}`, ephemeral: true });

  } catch (err) {
    console.error('Error creating ticket:', err);
    await interaction.followUp({ content: '❌ Failed to create ticket channel.', ephemeral: true }).catch(() => null);
  }
}

// ==========================================
// TICKET ACTIONS EXECUTIONS
// ==========================================

async function runCreate(context, isInteraction) {
  const author = isInteraction ? context.user : context.author;
  await executeTicketCreation(context, author, context.guild);
}

async function runClaim(context, staffUser, isInteraction) {
  const guild = context.guild;
  const channel = context.channel;

  try {
    const ticket = await TicketInstance.findOne({ guildId: guild.id, channelId: channel.id });
    if (!ticket || ticket.status === 'closed') {
      return context.reply({ embeds: [error('This command can only be run inside an open ticket channel.')], ephemeral: isInteraction });
    }

    if (ticket.claimedBy) {
      return context.reply({ embeds: [error(`This ticket is already claimed by <@${ticket.claimedBy}>.`)], ephemeral: isInteraction });
    }

    // Set claimed stats
    ticket.claimedBy = staffUser.id;
    ticket.claimedAt = new Date();
    await ticket.save();

    // Increment staff claimed count
    await TicketStaffStats.findOneAndUpdate(
      { guildId: guild.id, userId: staffUser.id },
      { $inc: { claimedCount: 1 } },
      { upsert: true }
    );

    // Apply exclusive overrides if desired (restrict write to creator and claimer staff)
    const conf = await TicketConfig.findOne({ guildId: guild.id });
    if (conf && conf.givePermissionsAuto) {
      // Overwrite permissions for other support roles if claimable restricts write
      // To keep it simple: inform the room
    }

    const claimEmbed = success(`This ticket has been claimed by **${staffUser.tag}** (${staffUser}).\nThey will now assist you.`, `👤 Ticket Claimed`);
    await context.reply({ embeds: [claimEmbed] });

    logger.logToGuild(guild, 'Ticket Claimed', `👤 Ticket **${channel.name}** claimed by ${staffUser}`);
  } catch (err) {
    console.error('Error claiming ticket:', err);
    await context.reply({ embeds: [error('Failed to claim ticket.')], ephemeral: isInteraction }).catch(() => null);
  }
}

async function runUnclaim(context, staffUser, isInteraction) {
  const guild = context.guild;
  const channel = context.channel;

  try {
    const ticket = await TicketInstance.findOne({ guildId: guild.id, channelId: channel.id });
    if (!ticket || ticket.status === 'closed') {
      return context.reply({ embeds: [error('This command can only be run inside an open ticket channel.')], ephemeral: isInteraction });
    }

    if (!ticket.claimedBy) {
      return context.reply({ embeds: [error('This ticket is not currently claimed.')], ephemeral: isInteraction });
    }

    if (ticket.claimedBy !== staffUser.id && !context.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return context.reply({ embeds: [error('Only the claimer staff member or an Administrator can unclaim this ticket.')], ephemeral: isInteraction });
    }

    ticket.claimedBy = null;
    ticket.claimedAt = null;
    await ticket.save();

    const unclaimEmbed = info(`This ticket has been unclaimed and is now open for other staff.`, `🔓 Ticket Unclaimed`);
    await context.reply({ embeds: [unclaimEmbed] });

    logger.logToGuild(guild, 'Ticket Unclaimed', `🔓 Ticket **${channel.name}** unclaimed by ${staffUser}`);
  } catch (err) {
    console.error('Error unclaiming ticket:', err);
    await context.reply({ embeds: [error('Failed to unclaim ticket.')], ephemeral: isInteraction }).catch(() => null);
  }
}

async function runTransfer(context, targetStaff, isInteraction) {
  const guild = context.guild;
  const channel = context.channel;

  try {
    const ticket = await TicketInstance.findOne({ guildId: guild.id, channelId: channel.id });
    if (!ticket || ticket.status === 'closed') {
      return context.reply({ embeds: [error('This command can only be run inside an open ticket channel.')], ephemeral: isInteraction });
    }

    ticket.claimedBy = targetStaff.id;
    ticket.claimedAt = new Date();
    await ticket.save();

    const transferEmbed = success(`This ticket has been successfully transferred to **${targetStaff.tag}** (${targetStaff}).`, `🔄 Ticket Transferred`);
    await context.reply({ embeds: [transferEmbed] });

    logger.logToGuild(guild, 'Ticket Transferred', `🔄 Ticket **${channel.name}** transferred to ${targetStaff}`);
  } catch (err) {
    console.error('Error transferring ticket:', err);
    await context.reply({ embeds: [error('Failed to transfer ticket.')], ephemeral: isInteraction }).catch(() => null);
  }
}

async function runAdd(context, targetUser, isInteraction) {
  const channel = context.channel;
  const guild = context.guild;

  try {
    const ticket = await TicketInstance.findOne({ guildId: guild.id, channelId: channel.id });
    if (!ticket) {
      return context.reply({ embeds: [error('This command must be run inside a ticket channel.')], ephemeral: isInteraction });
    }

    await channel.permissionOverwrites.edit(targetUser.id, {
      ViewChannel: true,
      SendMessages: true,
      EmbedLinks: true,
      AttachFiles: true
    });

    await context.reply({ embeds: [success(`Successfully added ${targetUser} to the ticket.`)] });
  } catch (err) {
    console.error('Error adding user:', err);
    await context.reply({ embeds: [error('Failed to add user.')], ephemeral: isInteraction }).catch(() => null);
  }
}

async function runRemove(context, targetUser, isInteraction) {
  const channel = context.channel;
  const guild = context.guild;

  try {
    const ticket = await TicketInstance.findOne({ guildId: guild.id, channelId: channel.id });
    if (!ticket) {
      return context.reply({ embeds: [error('This command must be run inside a ticket channel.')], ephemeral: isInteraction });
    }

    await channel.permissionOverwrites.delete(targetUser.id);
    await context.reply({ embeds: [success(`Successfully removed ${targetUser} from the ticket.`)] });
  } catch (err) {
    console.error('Error removing user:', err);
    await context.reply({ embeds: [error('Failed to remove user.')], ephemeral: isInteraction }).catch(() => null);
  }
}

async function runRename(context, newName, isInteraction) {
  const channel = context.channel;
  const guild = context.guild;

  try {
    const ticket = await TicketInstance.findOne({ guildId: guild.id, channelId: channel.id });
    if (!ticket) {
      return context.reply({ embeds: [error('This command must be run inside a ticket channel.')], ephemeral: isInteraction });
    }

    const formattedName = newName.toLowerCase().replace(/\s+/g, '-');
    await channel.setName(formattedName);
    await context.reply({ embeds: [success(`Channel successfully renamed to \`${formattedName}\`.`)] });
  } catch (err) {
    console.error('Error renaming channel:', err);
    await context.reply({ embeds: [error('Failed to rename channel.')], ephemeral: isInteraction }).catch(() => null);
  }
}

async function runInfo(context, isInteraction) {
  const guild = context.guild;
  const channel = context.channel;

  try {
    const ticket = await TicketInstance.findOne({ guildId: guild.id, channelId: channel.id });
    if (!ticket) {
      return context.reply({ embeds: [error('This channel is not an active ticket.')], ephemeral: isInteraction });
    }

    const creator = await guild.client.users.fetch(ticket.userId).catch(() => null);
    const claimerStr = ticket.claimedBy ? `<@${ticket.claimedBy}>` : '❌ Unclaimed';

    const infoEmbed = info(
      `Ticket details dashboard.`,
      `🎫 Ticket Information`
    )
    .addFields([
      { name: '🎫 Ticket ID', value: `\`${ticket.caseId}\``, inline: true },
      { name: '👤 Creator', value: creator ? `${creator} (\`${creator.tag}\`)` : 'Unknown', inline: true },
      { name: '🛡️ Claimed By', value: claimerStr, inline: true },
      { name: '🚦 Status', value: `\`${ticket.status.toUpperCase()}\``, inline: true },
      { name: '📅 Created At', value: `${time(ticket.createdAt, 'f')} (${time(ticket.createdAt, 'R')})`, inline: false }
    ]);

    await context.reply({ embeds: [infoEmbed] });
  } catch (err) {
    console.error('Error loading ticket info:', err);
    await context.reply({ embeds: [error('Failed to retrieve ticket info.')] }).catch(() => null);
  }
}

async function runTranscript(context, isInteraction) {
  const channel = context.channel;
  const guild = context.guild;

  try {
    const ticket = await TicketInstance.findOne({ guildId: guild.id, channelId: channel.id });
    if (!ticket) {
      return context.reply({ embeds: [error('This command must be run inside a ticket channel.')], ephemeral: isInteraction });
    }

    await context.reply({ content: '⏳ Compiling transcript logs, please wait...', ephemeral: isInteraction });

    const htmlBuffer = await generateTranscript(channel);
    const file = new AttachmentBuilder(htmlBuffer, { name: `transcript-${channel.name}.html` });

    await context.channel.send({
      content: '✅ Transcript logs compiled successfully:',
      files: [file]
    });
  } catch (err) {
    console.error('Error generating transcript command:', err);
    await context.reply({ embeds: [error('Failed to compile transcript.')] }).catch(() => null);
  }
}

// ==========================================
// TICKET MODAL CLOSE & CLOSING WORKFLOW
// ==========================================

async function promptCloseReasonModal(interaction) {
  // Modal setup
  const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
  const modal = new ModalBuilder()
    .setCustomId(`ticket_modal_close_${interaction.channelId}`)
    .setTitle('Close Support Ticket');

  const reasonInput = new TextInputBuilder()
    .setCustomId('reason')
    .setLabel('Close Reason')
    .setPlaceholder('Enter reason for closing this ticket')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setValue('Issue Resolved');

  modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
  await interaction.showModal(modal);
}

// Listener for Modal submits of close reasons
clientModalSubmitsListener();
function clientModalSubmitsListener() {
  // We will intercept Modal submissions in interactionCreate.js and call runClose from here
}

async function runClose(context, reason, isInteraction) {
  const guild = context.guild;
  const channel = context.channel;
  const author = isInteraction ? context.user : context.author;

  try {
    const ticket = await TicketInstance.findOne({ guildId: guild.id, channelId: channel.id });
    if (!ticket || ticket.status === 'closed') {
      return context.reply({ embeds: [error('This command can only be run inside an open ticket channel.')], ephemeral: isInteraction });
    }

    const conf = await TicketConfig.findOne({ guildId: guild.id });
    const memberCanClose = conf ? conf.memberCanClose : true;

    // Check permissions
    if (ticket.userId === author.id && !memberCanClose) {
      return context.reply({ embeds: [error('Only support staff are authorized to close tickets.')], ephemeral: isInteraction });
    }

    // Set state
    ticket.status = 'closed';
    ticket.closedAt = new Date();
    ticket.closedBy = author.id;
    ticket.closeReason = reason;

    // Calculate duration
    const durationSec = Math.round((ticket.closedAt - ticket.createdAt) / 1000);
    ticket.durationSeconds = durationSec;
    await ticket.save();

    // Increment staff stats
    await TicketStaffStats.findOneAndUpdate(
      { guildId: guild.id, userId: author.id },
      { $inc: { closedCount: 1 } },
      { upsert: true }
    );

    // Reply and acknowledge immediately
    const closeNotice = info(`🔒 Ticket closing initiated by **${author.tag}**.\n**Reason:** ${reason}\nChannel will delete shortly.`, `🔒 Ticket Closed`);
    
    if (isInteraction) {
      await context.reply({ embeds: [closeNotice] });
    } else {
      await context.reply({ embeds: [closeNotice] });
    }

    // 1. Generate HTML Transcript
    const htmlBuffer = await generateTranscript(channel);
    const transcriptFile = new AttachmentBuilder(htmlBuffer, { name: `transcript-${channel.name}.html` });

    // Format duration string: e.g. 2h 14m 32s
    const formatDuration = (sec) => {
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      return `${h}h ${m}m ${s}s`;
    };

    const durationStr = formatDuration(durationSec);

    // 2. Send Detailed Log Embed to logChannelId
    if (conf && conf.logChannelId) {
      const logChan = await guild.channels.fetch(conf.logChannelId).catch(() => null);
      if (logChan) {
        const creatorUser = await guild.client.users.fetch(ticket.userId).catch(() => null);
        const claimerUser = ticket.claimedBy ? await guild.client.users.fetch(ticket.claimedBy).catch(() => null) : null;

        const logEmbed = info(
          `Detailed closure log for ticket \`${channel.name}\`.`,
          `🎫 Ticket Closed`
        )
        .addFields([
          { name: '🎫 Ticket ID', value: `\`${ticket.caseId}\``, inline: true },
          { name: '📁 Category', value: `<#${conf.categoryId}>`, inline: true },
          { name: '👤 Created By', value: creatorUser ? `${creatorUser} (${creatorUser.tag})` : 'Unknown', inline: false },
          { name: '🛡️ Claimed By', value: claimerUser ? `${claimerUser} (${claimerUser.tag})` : '❌ Unclaimed', inline: false },
          { name: '🔒 Closed By', value: `${author} (${author.tag})`, inline: false },
          { name: '⏱️ Duration', value: `\`${durationStr}\``, inline: true },
          { name: '📝 Close Reason', value: reason, inline: true }
        ])
        .setTimestamp();

        await logChan.send({ embeds: [logEmbed], files: [transcriptFile] });
      }
    }

    // 3. DM User satisfaction review card & Transcript
    const creatorUser = await guild.client.users.fetch(ticket.userId).catch(() => null);
    if (creatorUser) {
      const dmEmbed = info(
        `Your support ticket in **${guild.name}** has been closed.\n\n` +
        `• **Ticket Name:** \`${channel.name}\`\n` +
        `• **Closed By:** ${author.tag}\n` +
        `• **Duration:** \`${durationStr}\`\n` +
        `• **Reason:** ${reason}\n\n` +
        `Please rate the support quality you received using the buttons below:`,
        `☁️ Ren Helper - Ticket Closed`
      );

      // Star Rating Buttons
      const ratingRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ticket_rating_1_${ticket.caseId}`).setLabel('⭐ 1').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`ticket_rating_2_${ticket.caseId}`).setLabel('⭐ 2').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`ticket_rating_3_${ticket.caseId}`).setLabel('⭐ 3').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`ticket_rating_4_${ticket.caseId}`).setLabel('⭐ 4').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`ticket_rating_5_${ticket.caseId}`).setLabel('⭐ 5').setStyle(ButtonStyle.Success)
      );

      await creatorUser.send({ embeds: [dmEmbed], components: [ratingRow], files: [transcriptFile] }).catch(err => {
        logger.warn(`Failed to send closure DM to ${creatorUser.tag}: ${err.message}`);
      });
    }

    // 4. Auto Delete Closed Tickets (5 seconds delay)
    setTimeout(async () => {
      await channel.delete().catch(() => null);
    }, 5000);

  } catch (err) {
    console.error('Error closing ticket:', err);
    await context.reply({ embeds: [error('Failed to close ticket.')], ephemeral: isInteraction }).catch(() => null);
  }
}

async function runReopen(context, isInteraction) {
  // If the channel was deleted, we cannot reopen in it.
  // Reopening is only supported if Auto Delete is off.
  // Let's reply that the channel has been set to auto-delete.
  await context.reply({ embeds: [error('This ticket channel is scheduled for immediate deletion. Reopen is not available.')], ephemeral: isInteraction });
}

async function handleSatisfactionRatingButtons(interaction, client) {
  const customId = interaction.customId;
  if (!customId.startsWith('ticket_rating_')) return;

  try {
    const parts = customId.split('_');
    const rating = parseInt(parts[2]);
    const caseId = parts[3];

    // Find the ticket case in DB
    const ticket = await TicketInstance.findOne({ caseId });
    if (!ticket) {
      return interaction.reply({ content: '❌ Ticket record not found in database.', ephemeral: true });
    }

    // Save review
    await TicketReview.create({
      guildId: ticket.guildId,
      userId: interaction.user.id,
      ticketId: caseId,
      rating
    });

    // Update ticket instance
    ticket.rating = rating;
    await ticket.save();

    await interaction.update({
      content: `💖 **Thank you!** You rated this ticket **${'⭐'.repeat(rating)}** (${rating}/5). Your feedback helps us improve!`,
      embeds: [],
      components: []
    });

  } catch (err) {
    console.error('Error saving satisfaction rating:', err);
    await interaction.reply({ content: '❌ Failed to record your rating.', ephemeral: true }).catch(() => null);
  }
}

// ==========================================
// TICKET ANALYTICS & REVIEWS STATISTICS COMMANDS
// ==========================================

async function runStats(context, isInteraction) {
  const guild = context.guild;

  try {
    const openCount = await TicketInstance.countDocuments({ guildId: guild.id, status: 'open' });
    const closedCount = await TicketInstance.countDocuments({ guildId: guild.id, status: 'closed' });
    const claimedCount = await TicketInstance.countDocuments({ guildId: guild.id, claimedBy: { $ne: null } });

    const totalTickets = openCount + closedCount;

    const statsEmbed = info(
      `Detailed ticket analytics summary for **${guild.name}**.`,
      `📊 Ticket Analytics`
    )
    .addFields([
      { name: '🟢 Open Tickets', value: `\`${openCount}\` active`, inline: true },
      { name: '🔴 Closed Tickets', value: `\`${closedCount}\` resolved`, inline: true },
      { name: '🛡️ Claimed Tickets', value: `\`${claimedCount}\` claimed`, inline: true },
      { name: '📂 Total Tickets Created', value: `\`${totalTickets}\` tickets`, inline: false }
    ]);

    await context.reply({ embeds: [statsEmbed] });
  } catch (err) {
    console.error('Error fetching ticket stats:', err);
    await context.reply({ embeds: [error('Failed to load stats.')], ephemeral: isInteraction }).catch(() => null);
  }
}

async function runLeaderboard(context, isInteraction) {
  const guild = context.guild;

  try {
    const staffStats = await TicketStaffStats.find({ guildId: guild.id }).sort({ claimedCount: -1 }).limit(10);

    if (!staffStats || staffStats.length === 0) {
      return context.reply({ embeds: [info('No staff ticket metrics recorded yet.', '🥇 Support Leaderboard')] });
    }

    let desc = 'Support rankings based on total claimed tickets:\n\n';
    staffStats.forEach((staff, index) => {
      let rankEmoji = '⚫';
      if (index === 0) rankEmoji = '🥇';
      else if (index === 1) rankEmoji = '🥈';
      else if (index === 2) rankEmoji = '🥉';

      desc += `${rankEmoji} **#${index + 1}** <@${staff.userId}> - **${staff.claimedCount}** claimed (Closed: \`${staff.closedCount}\`)\n`;
    });

    const embed = info(desc, '🥇 Support Leaderboard');
    await context.reply({ embeds: [embed] });
  } catch (err) {
    console.error('Error loading leaderboard:', err);
    await context.reply({ embeds: [error('Failed to load leaderboard.')], ephemeral: isInteraction }).catch(() => null);
  }
}

async function runReviews(context, isInteraction) {
  const guild = context.guild;

  try {
    const reviews = await TicketReview.find({ guildId: guild.id }).sort({ timestamp: -1 }).limit(10);
    const avgStats = await TicketReview.aggregate([
      { $match: { guildId: guild.id } },
      { $group: { _id: null, avgRating: { $avg: '$rating' }, total: { $sum: 1 } } }
    ]);

    const avg = avgStats[0] ? avgStats[0].avgRating.toFixed(1) : 'N/A';
    const total = avgStats[0] ? avgStats[0].total : 0;

    let desc = `⭐ **Average Satisfaction Score:** \`${avg} / 5.0\` (Total Reviews: \`${total}\`)\n\n` +
               `**Recent Feedbacks:**\n\n`;

    if (reviews.length === 0) {
      desc += '❌ No user feedback recorded yet.';
    } else {
      reviews.forEach((r, idx) => {
        desc += `**${idx + 1}.** User <@${r.userId}> rated: **${'⭐'.repeat(r.rating)}** (${r.rating}/5)\n` +
                `└ **Date:** ${time(r.timestamp, 'd')}\n\n`;
      });
    }

    const embed = info(desc, '⭐ User Ratings & Feedback');
    await context.reply({ embeds: [embed] });
  } catch (err) {
    console.error('Error fetching reviews:', err);
    await context.reply({ embeds: [error('Failed to load reviews.')], ephemeral: isInteraction }).catch(() => null);
  }
}

// Helper functions for modal closings
module.exports.runClose = runClose;
module.exports.promptCloseReasonModal = promptCloseReasonModal;
