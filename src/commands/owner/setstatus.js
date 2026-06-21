const { SlashCommandBuilder, ActivityType } = require('discord.js');
const config = require('../../config');
const { success, error, info } = require('../../utils/embedBuilder');

module.exports = {
  name: 'setstatus',
  aliases: ['status', 'botstatus'],
  description: 'Changes the online status and activity of the bot. (Owner Only)',
  slashData: new SlashCommandBuilder()
    .setName('setstatus')
    .setDescription('Changes the online status and activity of the bot. (Owner Only)')
    
    .addStringOption(opt => opt.setName('status')
      .setDescription('Bot status state')
      .setRequired(true)
      .addChoices(
        { name: 'Online', value: 'online' },
        { name: 'Idle', value: 'idle' },
        { name: 'Do Not Disturb', value: 'dnd' },
        { name: 'Invisible', value: 'invisible' }
      )
    )
    
    .addStringOption(opt => opt.setName('type')
      .setDescription('Bot activity type')
      .setRequired(true)
      .addChoices(
        { name: 'Playing', value: 'playing' },
        { name: 'Streaming', value: 'streaming' },
        { name: 'Listening', value: 'listening' },
        { name: 'Watching', value: 'watching' },
        { name: 'Competing', value: 'competing' }
      )
    )
    
    .addStringOption(opt => opt.setName('name')
      .setDescription('Custom activity name / text')
      .setRequired(true)
    ),

  async executePrefix(message, args, client) {
    // Whitelist check
    if (!config.owners.includes(message.author.id)) {
      return message.reply({ embeds: [error('This command is restricted to the bot owner only.')] });
    }

    const statusInput = args[0]?.toLowerCase();
    const typeInput = args[1]?.toLowerCase();
    const nameInput = args.slice(2).join(' ').trim();

    const validStatuses = ['online', 'idle', 'dnd', 'invisible'];
    const validTypes = ['playing', 'streaming', 'listening', 'watching', 'competing'];

    if (!statusInput || !typeInput || !nameInput || !validStatuses.includes(statusInput) || !validTypes.includes(typeInput)) {
      const usageEmbed = info(
        `**Usage:**\n\`r?setstatus <status> <type> <activity name>\`\n\n` +
        `• **Statuses:** \`online\`, \`idle\`, \`dnd\`, \`invisible\`\n` +
        `• **Types:** \`playing\`, \`streaming\`, \`listening\`, \`watching\`, \`competing\`\n\n` +
        `**Example:**\n\`r?setstatus dnd watching Managing Ren Cloud\``,
        `🤖 Bot Status Usage Guide`
      );
      return message.reply({ embeds: [usageEmbed] });
    }

    await updateBotStatus(message, statusInput, typeInput, nameInput, client, false);
  },

  async executeSlash(interaction, client) {
    // Whitelist check
    if (!config.owners.includes(interaction.user.id)) {
      return interaction.reply({ embeds: [error('This command is restricted to the bot owner only.')], ephemeral: true });
    }

    const statusInput = interaction.options.getString('status');
    const typeInput = interaction.options.getString('type');
    const nameInput = interaction.options.getString('name');

    await updateBotStatus(interaction, statusInput, typeInput, nameInput, client, true);
  }
};

async function updateBotStatus(context, status, type, name, client, isInteraction) {
  try {
    // Map string activity types to Discord ActivityType enum values
    let activityTypeEnum = ActivityType.Playing;
    if (type === 'streaming') activityTypeEnum = ActivityType.Streaming;
    else if (type === 'listening') activityTypeEnum = ActivityType.Listening;
    else if (type === 'watching') activityTypeEnum = ActivityType.Watching;
    else if (type === 'competing') activityTypeEnum = ActivityType.Competing;

    // Apply status change to bot client
    client.user.setPresence({
      activities: [{ name: name, type: activityTypeEnum }],
      status: status
    });

    const replyEmbed = success(
      `Updated bot status and activity successfully!\n\n` +
      `• **Status:** \`${status.toUpperCase()}\`\n` +
      `• **Activity:** \`${type.toUpperCase()}\` \`${name}\``
    );

    if (isInteraction) {
      await context.reply({ embeds: [replyEmbed] });
    } else {
      await context.reply({ embeds: [replyEmbed] });
    }

  } catch (err) {
    console.error('Error changing bot status:', err);
    await context.reply({ embeds: [error('Failed to change the bot status.')], ephemeral: isInteraction }).catch(() => null);
  }
}
