const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const AutoResponse = require('../../database/models/AutoResponse');
const { success, error, info } = require('../../utils/embedBuilder');
const logger = require('../../utils/logger');

module.exports = {
  name: 'autoresponse',
  aliases: ['ar'],
  description: 'Manage auto-responses for the server.',
  slashData: new SlashCommandBuilder()
    .setName('autoresponse')
    .setDescription('Manage server autoresponses.')
    .addSubcommand(sub => sub
      .setName('create')
      .setDescription('Create a new auto-response.')
      .addStringOption(opt => opt.setName('trigger').setDescription('Word or phrase that triggers the bot').setRequired(true))
      .addStringOption(opt => opt.setName('response').setDescription('Reply sent when triggered').setRequired(true))
      .addBooleanOption(opt => opt.setName('regex').setDescription('Use regular expressions?').setRequired(false))
      .addBooleanOption(opt => opt.setName('case_insensitive').setDescription('Ignore word case?').setRequired(false))
      .addIntegerOption(opt => opt.setName('cooldown').setDescription('Cooldown in seconds').setRequired(false))
    )
    .addSubcommand(sub => sub
      .setName('edit')
      .setDescription('Edit an existing auto-response response and cooldown.')
      .addStringOption(opt => opt.setName('trigger').setDescription('The trigger to edit').setRequired(true))
      .addStringOption(opt => opt.setName('response').setDescription('The new response message').setRequired(true))
      .addIntegerOption(opt => opt.setName('cooldown').setDescription('New cooldown in seconds').setRequired(false))
    )
    .addSubcommand(sub => sub
      .setName('delete')
      .setDescription('Delete an auto-response.')
      .addStringOption(opt => opt.setName('trigger').setDescription('The trigger to delete').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('Lists all configured auto-responses.')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async executePrefix(message, args, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply({ embeds: [error('You must be an Administrator to use this command.')] });
    }

    const sub = args[0]?.toLowerCase();
    if (!sub || sub === 'help') {
      const helpEmbed = info(
        `**Autoresponse Prefix Commands:**\n` +
        `• \`-i ar create <trigger> | <response> [cooldown]\`\n` +
        `• \`-i ar edit <trigger> | <response> [cooldown]\`\n` +
        `• \`-i ar delete <trigger>\`\n` +
        `• \`-i ar list\`\n` +
        `• \`-i ar view <trigger>\`\n\n` +
        `*Note: Use the pipe character \`|\` to separate trigger and response.*`,
        `🤖 Autoresponse Help`
      );
      return message.reply({ embeds: [helpEmbed] });
    }

    // 1. CREATE PREF
    if (sub === 'create') {
      const parts = args.slice(1).join(' ').split('|');
      if (parts.length < 2) {
        return message.reply({ embeds: [error('Invalid format. Usage: `-i ar create <trigger> | <response> [cooldown]`')] });
      }

      const trigger = parts[0].trim();
      const response = parts[1].trim();
      const cooldown = parseInt(parts[2]?.trim()) || 0;

      if (!trigger || !response) {
        return message.reply({ embeds: [error('Trigger and response cannot be empty.')] });
      }

      await createAR(message, trigger, response, false, true, cooldown);
      return;
    }

    // 2. EDIT PREF
    if (sub === 'edit') {
      const parts = args.slice(1).join(' ').split('|');
      if (parts.length < 2) {
        return message.reply({ embeds: [error('Invalid format. Usage: `-i ar edit <trigger> | <new_response> [new_cooldown]`')] });
      }

      const trigger = parts[0].trim();
      const response = parts[1].trim();
      const cooldown = parts[2] ? parseInt(parts[2].trim()) : undefined;

      await editAR(message, trigger, response, cooldown);
      return;
    }

    // 3. DELETE PREF
    if (sub === 'delete') {
      const trigger = args.slice(1).join(' ').trim();
      if (!trigger) {
        return message.reply({ embeds: [error('Please specify the trigger. Usage: `-i ar delete <trigger>`')] });
      }
      await deleteAR(message, trigger);
      return;
    }

    // 4. LIST PREF
    if (sub === 'list') {
      await listARs(message);
      return;
    }

    // 5. VIEW PREF
    if (sub === 'view') {
      const trigger = args.slice(1).join(' ').trim();
      if (!trigger) {
        return message.reply({ embeds: [error('Please specify the trigger. Usage: `-i ar view <trigger>`')] });
      }
      await viewAR(message, trigger);
      return;
    }

    return message.reply({ embeds: [error('Unknown subcommand. Use `-i ar help` for usage.')] });
  },

  async executeSlash(interaction, client) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'create') {
      const trigger = interaction.options.getString('trigger');
      const response = interaction.options.getString('response');
      const regex = interaction.options.getBoolean('regex') || false;
      const caseInsensitive = interaction.options.getBoolean('case_insensitive') !== false; // default true
      const cooldown = interaction.options.getInteger('cooldown') || 0;
      await createAR(interaction, trigger, response, regex, caseInsensitive, cooldown);
    } else if (sub === 'edit') {
      const trigger = interaction.options.getString('trigger');
      const response = interaction.options.getString('response');
      const cooldown = interaction.options.getInteger('cooldown') ?? undefined;
      await editAR(interaction, trigger, response, cooldown);
    } else if (sub === 'delete') {
      const trigger = interaction.options.getString('trigger');
      await deleteAR(interaction, trigger);
    } else if (sub === 'list') {
      await listARs(interaction);
    }
  }
};

async function createAR(context, trigger, response, isRegex, isCaseInsensitive, cooldown) {
  const guild = context.guild;
  const author = context.user || context.author;

  try {
    const existing = await AutoResponse.findOne({ guildId: guild.id, trigger });
    if (existing) {
      return context.reply({ embeds: [error(`An auto-response with trigger \`${trigger}\` already exists. Use \`edit\` instead.`)] });
    }

    await AutoResponse.create({
      guildId: guild.id,
      trigger,
      response,
      isRegex,
      isCaseInsensitive,
      cooldown
    });

    const replyEmbed = success(`Auto-response created successfully!\n\n**Trigger:** \`${trigger}\`\n**Response:** ${response}\n**Regex:** \`${isRegex}\` | **Case Insensitive:** \`${isCaseInsensitive}\` | **Cooldown:** \`${cooldown}s\``);
    await context.reply({ embeds: [replyEmbed] });

    logger.logToGuild(guild, 'Auto Response Created', `🤖 Auto-response trigger \`${trigger}\` created by ${author}`);
  } catch (err) {
    console.error('Error creating auto-response:', err);
    await context.reply({ embeds: [error('Failed to create auto-response.')], ephemeral: true }).catch(() => null);
  }
}

async function editAR(context, trigger, response, cooldown) {
  const guild = context.guild;
  const author = context.user || context.author;

  try {
    const ar = await AutoResponse.findOne({ guildId: guild.id, trigger });
    if (!ar) {
      return context.reply({ embeds: [error(`No auto-response found with trigger \`${trigger}\`.`)] });
    }

    ar.response = response;
    if (cooldown !== undefined) ar.cooldown = cooldown;
    await ar.save();

    const replyEmbed = success(`Auto-response updated successfully!\n\n**Trigger:** \`${trigger}\`\n**New Response:** ${response}\n**Cooldown:** \`${ar.cooldown}s\``);
    await context.reply({ embeds: [replyEmbed] });

    logger.logToGuild(guild, 'Auto Response Edited', `🤖 Auto-response trigger \`${trigger}\` edited by ${author}`);
  } catch (err) {
    console.error('Error editing auto-response:', err);
    await context.reply({ embeds: [error('Failed to edit auto-response.')], ephemeral: true }).catch(() => null);
  }
}

async function deleteAR(context, trigger) {
  const guild = context.guild;
  const author = context.user || context.author;

  try {
    const res = await AutoResponse.findOneAndDelete({ guildId: guild.id, trigger });
    if (!res) {
      return context.reply({ embeds: [error(`No auto-response found with trigger \`${trigger}\`.`)] });
    }

    const replyEmbed = success(`Successfully deleted auto-response for trigger \`${trigger}\`.`);
    await context.reply({ embeds: [replyEmbed] });

    logger.logToGuild(guild, 'Auto Response Deleted', `🤖 Auto-response trigger \`${trigger}\` deleted by ${author}`);
  } catch (err) {
    console.error('Error deleting auto-response:', err);
    await context.reply({ embeds: [error('Failed to delete auto-response.')], ephemeral: true }).catch(() => null);
  }
}

async function listARs(context) {
  const guild = context.guild;

  try {
    const list = await AutoResponse.find({ guildId: guild.id });
    if (!list || list.length === 0) {
      return context.reply({ embeds: [info('No auto-responses configured for this server.', '🤖 Auto Responses')] });
    }

    let desc = '';
    list.forEach((ar, index) => {
      const typeStr = ar.isRegex ? 'Regex' : 'Text';
      desc += `**${index + 1}.** \`${ar.trigger}\` [${typeStr}]\n` +
              `└ **Reply:** ${ar.response.substring(0, 100)}${ar.response.length > 100 ? '...' : ''}\n` +
              `└ **Cooldown:** \`${ar.cooldown}s\` | **Case-Insensitive:** \`${ar.isCaseInsensitive}\`\n\n`;
    });

    await context.reply({ embeds: [info(desc, '🤖 Auto Responses')] });
  } catch (err) {
    console.error('Error listing auto-responses:', err);
    await context.reply({ embeds: [error('Failed to retrieve auto-responses.')], ephemeral: true }).catch(() => null);
  }
}

async function viewAR(context, trigger) {
  const guild = context.guild;

  try {
    const ar = await AutoResponse.findOne({ guildId: guild.id, trigger });
    if (!ar) {
      return context.reply({ embeds: [error(`No auto-response found with trigger \`${trigger}\`.`)] });
    }

    const viewEmbed = info(
      `**Trigger:** \`${ar.trigger}\`\n` +
      `**Response:** ${ar.response}\n` +
      `**Regex Trigger:** \`${ar.isRegex}\`\n` +
      `**Case Insensitive:** \`${ar.isCaseInsensitive}\`\n` +
      `**Cooldown:** \`${ar.cooldown}s\``,
      `🤖 Auto-Response Details`
    );

    await context.reply({ embeds: [viewEmbed] });
  } catch (err) {
    console.error('Error viewing auto-response:', err);
    await context.reply({ embeds: [error('Failed to view auto-response details.')] }).catch(() => null);
  }
}
