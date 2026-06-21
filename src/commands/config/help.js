const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { info, createEmbed } = require('../../utils/embedBuilder');
const config = require('../../config');
const GuildConfig = require('../../database/models/GuildConfig');
const logger = require('../../utils/logger');

module.exports = {
  name: 'help',
  description: 'Displays a list of all available commands via an interactive dropdown menu.',
  slashData: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Displays a list of all available commands via an interactive dropdown menu.'),

  async executePrefix(message, args, client) {
    await sendHelp(message, message.author, false);
  },

  async executeSlash(interaction, client) {
    await sendHelp(interaction, interaction.user, true);
  },

  async handleInteraction(interaction, client) {
    if (!interaction.isStringSelectMenu()) return;
    
    const customId = interaction.customId;
    if (!customId.startsWith('help_category_select:')) return;

    const parts = customId.split(':');
    const requesterId = parts[1];
    if (interaction.user.id !== requesterId) {
      return interaction.reply({ content: '❌ You did not invoke this help menu. Run `/help` or `r?help` to get your own.', ephemeral: true });
    }

    const category = interaction.values[0];
    
    // Fetch custom prefixes
    let invitePrefix = config.invitePrefix;
    let utilityPrefix = config.utilityPrefix;
    
    const guildConf = await GuildConfig.findOne({ guildId: interaction.guild.id }).catch(() => null);
    if (guildConf) {
      if (guildConf.invitePrefix) invitePrefix = guildConf.invitePrefix;
      if (guildConf.utilityPrefix) utilityPrefix = guildConf.utilityPrefix;
    }

    const embed = getHelpEmbed(category, interaction.guild, invitePrefix, utilityPrefix);
    const row = generateHelpComponents(requesterId, category);

    await interaction.update({ embeds: [embed], components: [row] });
  }
};

async function sendHelp(context, host, isInteraction) {
  try {
    const guildId = context.guildId || context.guild.id;
    
    // Fetch custom prefixes
    let invitePrefix = config.invitePrefix;
    let utilityPrefix = config.utilityPrefix;
    
    const guildConf = await GuildConfig.findOne({ guildId }).catch(() => null);
    if (guildConf) {
      if (guildConf.invitePrefix) invitePrefix = guildConf.invitePrefix;
      if (guildConf.utilityPrefix) utilityPrefix = guildConf.utilityPrefix;
    }

    const embed = getHelpEmbed('overview', context.guild, invitePrefix, utilityPrefix);
    const row = generateHelpComponents(host.id, 'overview');

    if (isInteraction) {
      await context.reply({ embeds: [embed], components: [row] });
    } else {
      await context.reply({ embeds: [embed], components: [row] });
    }
  } catch (err) {
    logger.error('Error executing help command:', err);
    const errEmbed = createEmbed({ color: 'red', title: '❌ Error', description: 'Failed to generate help menu.' });
    if (isInteraction) {
      await context.reply({ embeds: [errEmbed], ephemeral: true }).catch(() => null);
    } else {
      await context.reply({ embeds: [errEmbed] }).catch(() => null);
    }
  }
}

function generateHelpComponents(requesterId, currentCategory = 'overview') {
  const select = new StringSelectMenuBuilder()
    .setCustomId(`help_category_select:${requesterId}`)
    .setPlaceholder('📂 Choose a command category...')
    .addOptions([
      {
        label: 'Home Overview',
        description: 'Main welcome & prefix guide',
        value: 'overview',
        emoji: '☁️',
        default: currentCategory === 'overview'
      },
      {
        label: 'Moderation System',
        description: 'Ban, kick, timeout, mute, warn, lock, clear',
        value: 'moderation',
        emoji: '🛡️',
        default: currentCategory === 'moderation'
      },
      {
        label: 'Setup & Config',
        description: 'Server configurations and system setups',
        value: 'config',
        emoji: '⚙️',
        default: currentCategory === 'config'
      },
      {
        label: 'Invite & Rewards',
        description: 'Invite counts, top leaderboard, milestones',
        value: 'invites',
        emoji: '📥',
        default: currentCategory === 'invites'
      },
      {
        label: 'Auto Responses',
        description: 'Manage automated trigger keywords',
        value: 'autoresponses',
        emoji: '🤖',
        default: currentCategory === 'autoresponses'
      },
      {
        label: 'Embed Builder',
        description: 'Design and send premium customized embeds',
        value: 'embeds',
        emoji: '🎨',
        default: currentCategory === 'embeds'
      },
      {
        label: 'Booster Tracking',
        description: 'Server booster stats, alerts, and roles',
        value: 'boosters',
        emoji: '🚀',
        default: currentCategory === 'boosters'
      },
      {
        label: 'Payment System',
        description: 'Generate payment QRs, logs, verification',
        value: 'payments',
        emoji: '💳',
        default: currentCategory === 'payments'
      },
      {
        label: 'Giveaways',
        description: 'Schedule, run, and reroll server giveaways',
        value: 'giveaways',
        emoji: '🎉',
        default: currentCategory === 'giveaways'
      },
      {
        label: 'Owner Only',
        description: 'Global broadcasting and bot status config',
        value: 'owner',
        emoji: '📢',
        default: currentCategory === 'owner'
      }
    ]);

  return new ActionRowBuilder().addComponents(select);
}

function getHelpEmbed(category, guild, invitePrefix, utilityPrefix) {
  let embed;
  switch (category) {
    case 'overview':
      embed = info(
        `Welcome to the **Ren Helper** user guide.\n\n` +
        `📌 **Prefix Guide**\n` +
        `📊 Invite System & Boosts → \`${invitePrefix}\`\n` +
        `⚙️ Utility & Management → \`${utilityPrefix}\`\n` +
        `💎 Modern Commands → \`/\` (Slash Commands)\n\n` +
        `📂 **How to Use:**\n` +
        `Select a category from the dropdown menu below to view specific command references.`,
        `☁️ Ren Helper - Main Directory`
      );
      break;

    case 'moderation':
      embed = info(
        `Manage your server members, roles, and channels efficiently.\n\n` +
        `🛡️ **Moderation Command Reference:**\n\n` +
        `• \`${utilityPrefix}ban <user> [reason]\` / \`/ban\`\n` +
        `  └ *Ban a member from the server.*\n` +
        `• \`${utilityPrefix}unban <userId>\` / \`/unban\`\n` +
        `  └ *Revoke a server ban.*\n` +
        `• \`${utilityPrefix}kick <user> [reason]\` / \`/kick\`\n` +
        `  └ *Kick a member from the server.*\n` +
        `• \`${utilityPrefix}timeout <user> <duration> [reason]\` / \`/timeout\`\n` +
        `  └ *Temporarily timeout a member (e.g. 10m, 1h, 1d).*\n` +
        `• \`${utilityPrefix}untimeout <user>\` / \`/untimeout\`\n` +
        `  └ *Remove timeout lockout from a member.*\n` +
        `• \`${utilityPrefix}mute <user> [reason]\` / \`/mute\`\n` +
        `  └ *Mute a member using the Muted role.*\n` +
        `• \`${utilityPrefix}unmute <user>\` / \`/unmute\`\n` +
        `  └ *Unmute a member.*\n` +
        `• \`${utilityPrefix}warn <user> <reason>\` / \`/warn\`\n` +
        `  └ *Issue a formal warning to a member.*\n` +
        `• \`${utilityPrefix}warnings <user>\` / \`/warnings\`\n` +
        `  └ *View a member's active warnings.*\n` +
        `• \`${utilityPrefix}clear <amount>\` / \`/clear\`\n` +
        `  └ *Purge a specified number of messages from the channel.*\n` +
        `• \`${utilityPrefix}lock\` / \`${utilityPrefix}unlock\` or \`/lock\` / \`/unlock\`\n` +
        `  └ *Lock/Unlock channel send permissions.*\n` +
        `• \`${utilityPrefix}giverole <user> <role>\` / \`${utilityPrefix}removerole <user> <role>\`\n` +
        `  └ *Manage roles assigned to a member.*\n` +
        `• \`${utilityPrefix}nickname <user> [nick]\` / \`/nickname\`\n` +
        `  └ *Change a member's nickname.*\n` +
        `• \`${utilityPrefix}userinfo [@user]\` / \`/userinfo\`\n` +
        `  └ *Show user account and server joining metadata.*`,
        `🛡️ Moderation System Help`
      );
      break;

    case 'config':
      embed = info(
        `Configure system-wide settings, channels, and logs for Ren Helper.\n\n` +
        `⚙️ **Configuration Command Reference:**\n\n` +
        `• \`${utilityPrefix}config\` / \`/config\`\n` +
        `  └ *View current setup configuration for your server.*\n` +
        `• \`${utilityPrefix}setup\` / \`/setup\`\n` +
        `  └ *Configure log channels, welcome systems, and moderator permissions.*`,
        `⚙️ Configuration & Setup Help`
      );
      break;

    case 'invites':
      embed = info(
        `Track how members join the server and reward top referrers.\n\n` +
        `📥 **Invite Tracking & Rewards Reference:**\n\n` +
        `• \`${invitePrefix}invites [@user]\` / \`/invites\`\n` +
        `  └ *View active, left, fake, and total invites for a user.*\n` +
        `• \`${invitePrefix}inviter [@user]\` / \`/inviter\`\n` +
        `  └ *Show who invited a member to the server.*\n` +
        `• \`${invitePrefix}leaderboard\` / \`/leaderboard\`\n` +
        `  └ *Display top server referrers rankings.*\n` +
        `• \`${invitePrefix}stats\` / \`/stats\`\n` +
        `  └ *View server-wide join and invite metrics.*\n` +
        `• \`${invitePrefix}analytics\` / \`/analytics\`\n` +
        `  └ *Display join/leave retention analytics graphs.*\n` +
        `• \`${invitePrefix}rewards\` / \`/rewards\`\n` +
        `  └ *View configured invite milestone role rewards.*\n` +
        `• \`${invitePrefix}addreward <invites> <role>\`\n` +
        `  └ *Create an invite role reward milestone.*\n` +
        `• \`${invitePrefix}removereward <invites>\`\n` +
        `  └ *Delete an invite role reward milestone.*\n` +
        `• \`${invitePrefix}setinvitechannel #channel\`\n` +
        `  └ *Set the join/leave notification logs channel.*\n` +
        `• \`${invitePrefix}removeinvitechannel\`\n` +
        `  └ *Remove join/leave notification logs channel.*\n` +
        `• \`${invitePrefix}resetinvites <@user/all>\`\n` +
        `  └ *Reset invite metrics database entry.*`,
        `📥 Invite Tracking & Rewards Help`
      );
      break;

    case 'autoresponses':
      embed = info(
        `Set up automatic keyword and pattern responses.\n\n` +
        `🤖 **Auto Response Command Reference:**\n\n` +
        `• \`${utilityPrefix}ar create <trigger> <response>\`\n` +
        `  └ *Add a new automatic text response.*\n` +
        `• \`${utilityPrefix}ar edit <trigger> <response>\`\n` +
        `  └ *Modify response text for an existing trigger.*\n` +
        `• \`${utilityPrefix}ar delete <trigger>\`\n` +
        `  └ *Remove an auto-response trigger.*\n` +
        `• \`${utilityPrefix}ar list\`\n` +
        `  └ *List all configured auto-response triggers.*\n` +
        `• \`${utilityPrefix}ar view <trigger>\`\n` +
        `  └ *View specific settings for a trigger.*`,
        `🤖 Auto Response System Help`
      );
      break;

    case 'embeds':
      embed = info(
        `Create and distribute rich styled embed layouts.\n\n` +
        `🎨 **Interactive Embed Builder Reference:**\n\n` +
        `• \`${utilityPrefix}embed create\` / \`/embed create\`\n` +
        `  └ *Launches the interactive button/modal embed designer.*\n` +
        `• \`${utilityPrefix}embed send <id> #channel\` / \`/embed send\`\n` +
        `  └ *Deploy a saved embed layout into a designated channel.*`,
        `🎨 Embed Builder Help`
      );
      break;

    case 'boosters':
      embed = info(
        `Automated tracking and roles for premium nitro boosters.\n\n` +
        `🚀 **Booster Tracking Command Reference:**\n\n` +
        `• \`${invitePrefix}boosts [@user]\` / \`/boosts\`\n` +
        `  └ *View a user's current server boost details.*\n` +
        `• \`${invitePrefix}boostleaderboard\`\n` +
        `  └ *Show ranking of active server boosters.*\n` +
        `• \`${invitePrefix}boosterrole\` / \`setboosterrole\` / \`removeboosterrole\`\n` +
        `  └ *Configure a customized role automated for active boosters.*\n` +
        `• \`${invitePrefix}setboostchannel\`\n` +
        `  └ *Define target channel for boost notification alerts.*`,
        `🚀 Server Booster Tracking Help`
      );
      break;

    case 'payments':
      embed = info(
        `Manage merchant details, bill QR code generation, and manual review flow.\n\n` +
        `💳 **Payments Command Reference:**\n\n` +
        `• \`${utilityPrefix}upi [amount] [notes]\` / \`/upi\`\n` +
        `  └ *Generate a UPI payment QR code.*\n` +
        `• \`${utilityPrefix}paypal [amount]\` / \`/paypal\`\n` +
        `  └ *Generate a PayPal payment QR code.*\n` +
        `• \`${utilityPrefix}cryptopay <coin> <amount>\` / \`/cryptopay\`\n` +
        `  └ *Generate a cryptocurrency payment QR code.*\n` +
        `• \`${utilityPrefix}setupupi <upi-id> [merchantName]\` / \`/setupupi\`\n` +
        `  └ *Configure merchant UPI configuration details.*\n` +
        `• \`${utilityPrefix}setuppaypal <username>\` / \`/setuppaypal\`\n` +
        `  └ *Configure server PayPal merchant handle.*\n` +
        `• \`${utilityPrefix}setupcrypto <coin> <address>\` / \`/setupcrypto\`\n` +
        `  └ *Configure server cryptocurrency wallet address.*\n` +
        `• \`${utilityPrefix}setpaymentchannel #channel\` / \`/paymentchannel set\`\n` +
        `  └ *Configure target review channel for payment confirmations.*\n` +
        `• \`${utilityPrefix}paymentchannel\` / \`removepaymentchannel\`\n` +
        `  └ *View or remove the payment logs review channel.*\n` +
        `• \`${utilityPrefix}payments\` / \`paymenthistory\` or \`/payments history\`\n` +
        `  └ *Display recent payments history.*\n` +
        `• \`${utilityPrefix}paymentinfo <paymentid>\` or \`/payments info\`\n` +
        `  └ *Search detailed verification logs for a specific Payment ID.*\n` +
        `• \`${utilityPrefix}paymentstats\` / \`/paymentstats\`\n` +
        `  └ *Review revenue analytics and verification counts.*`,
        `💳 Payment System Help`
      );
      break;

    case 'giveaways':
      embed = info(
        `Schedule, configure, reroll, and track server giveaways.\n\n` +
        `🎉 **Giveaway System Reference:**\n\n` +
        `• \`${utilityPrefix}giveaway start <duration> <winners> <prize>\` / \`/ga start\`\n` +
        `  └ *Start a new giveaway with timers, roles, or invite filters.*\n` +
        `• \`${utilityPrefix}giveaway end <messageId>\` / \`/ga end\`\n` +
        `  └ *Force-end a giveaway immediately.*\n` +
        `• \`${utilityPrefix}giveaway reroll <messageId>\` / \`/ga reroll\`\n` +
        `  └ *Select new winners from existing participants pool.*\n` +
        `• \`${utilityPrefix}giveaway delete <messageId>\`\n` +
        `  └ *Clean up and delete a giveaway.*`,
        `🎉 Giveaway System Help`
      );
      break;

    case 'owner':
      embed = info(
        `Bot administration controls restricted to developers.\n\n` +
        `📢 **Owner Commands Reference:**\n\n` +
        `• \`${utilityPrefix}dmall <message/embedId>\`\n` +
        `  └ *DM broadcast all server members.*\n` +
        `• \`${utilityPrefix}setstatus <status> <type> <name>\`\n` +
        `  └ *Configure custom bot status presence.*`,
        `📢 Owner Only Commands Help`
      );
      break;

    default:
      embed = info('Category not found.', '❌ Error');
  }

  embed.setThumbnail(guild.iconURL({ dynamic: true }));
  embed.setTimestamp();
  return embed;
}
