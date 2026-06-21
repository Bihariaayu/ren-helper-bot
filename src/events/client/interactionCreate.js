const logger = require('../../utils/logger');
const { error } = require('../../utils/embedBuilder');

module.exports = {
  once: false,
  async execute(interaction, client) {
    if (interaction.isChatInputCommand()) {
      const commandName = interaction.commandName;
      const command = client.commands.get(commandName);

      if (!command) {
        return interaction.reply({ embeds: [error('This command is no longer registered.')], ephemeral: true });
      }

      try {
        await command.executeSlash(interaction, client);
      } catch (err) {
        logger.error(`Error executing slash command ${commandName}`, err);
        const errEmbed = error('An unexpected error occurred while executing this command.');
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ embeds: [errEmbed], ephemeral: true }).catch(() => null);
        } else {
          await interaction.reply({ embeds: [errEmbed], ephemeral: true }).catch(() => null);
        }
      }
    } else if (interaction.isButton() || interaction.isModalSubmit() || interaction.isStringSelectMenu()) {
      const customId = interaction.customId;
      
      // Delegate Embed Builder interactions
      if (customId.startsWith('embed_')) {
        const embedCmd = client.commands.get('embed');
        if (embedCmd && typeof embedCmd.handleInteraction === 'function') {
          try {
            await embedCmd.handleInteraction(interaction, client);
          } catch (err) {
            logger.error(`Error handling embed builder interaction ${customId}`, err);
          }
        }
      }
      
      // Delegate Owner DMAll interactions
      if (customId.startsWith('dmall_')) {
        const dmallCmd = client.commands.get('dmall');
        if (dmallCmd && typeof dmallCmd.handleInteraction === 'function') {
          try {
            await dmallCmd.handleInteraction(interaction, client);
          } catch (err) {
            logger.error(`Error handling dmall interaction ${customId}`, err);
          }
        }
      }

      // Delegate Ticket interactions
      if (customId.startsWith('ticket_')) {
        if (interaction.isModalSubmit() && customId.startsWith('ticket_modal_close_')) {
          try {
            const ticketCmd = client.commands.get('ticket');
            if (ticketCmd && typeof ticketCmd.runClose === 'function') {
              const reason = interaction.fields.getTextInputValue('reason') || 'No reason provided';
              await ticketCmd.runClose(interaction, reason, true);
            } else {
              await interaction.reply({ content: '❌ Ticket close command is not loaded.', ephemeral: true });
            }
          } catch (err) {
            logger.error(`Error handling ticket close modal submit:`, err);
          }
        } else if (customId === 'ticket_create') {
          // Keep the simulation option for compatibility if needed, but otherwise it will delegate
          try {
            await interaction.reply({ content: '🎫 Ticket created successfully! A private support channel has been simulated for you.', ephemeral: true });
          } catch (err) {
            logger.error('Error simulating ticket creation', err);
          }
        } else {
          const ticketCmd = client.commands.get('ticket');
          if (ticketCmd && typeof ticketCmd.handleInteraction === 'function') {
            try {
              await ticketCmd.handleInteraction(interaction, client);
            } catch (err) {
              logger.error(`Error handling ticket interaction ${customId}:`, err);
            }
          }
        }
      }
    }
  }
};
