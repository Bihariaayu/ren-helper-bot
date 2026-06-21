const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const config = require('../config');
const logger = require('../utils/logger');

module.exports = (client) => {
  client.commands = new Map();
  client.slashCommands = [];

  const commandsPath = path.join(__dirname, '../commands');
  
  // Read category folders
  const categories = fs.readdirSync(commandsPath);

  for (const category of categories) {
    const categoryPath = path.join(commandsPath, category);
    
    // Skip if not a directory
    if (!fs.lstatSync(categoryPath).isDirectory()) continue;

    const commandFiles = fs.readdirSync(categoryPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
      const filePath = path.join(categoryPath, file);
      try {
        const command = require(filePath);
        
        if (!command.name) {
          logger.warn(`Command at ${file} is missing a name. Skipping.`);
          continue;
        }

        // Add category property
        command.category = category;
        
        // Store in commands collection
        client.commands.set(command.name, command);

        // Store aliases if they exist
        if (command.aliases && Array.isArray(command.aliases)) {
          command.aliases.forEach(alias => {
            client.commands.set(alias, command);
          });
        }

        // If the command supports slash commands, register its slash data
        if (command.slashData) {
          client.slashCommands.push(command.slashData.toJSON());
        }

        logger.info(`Loaded command: ${command.name}`);
      } catch (err) {
        logger.error(`Error loading command ${file}`, err);
      }
    }
  }

  /**
   * Registers slash commands globally with the Discord API
   */
  client.registerSlashCommands = async () => {
    if (client.slashCommands.length === 0) return;
    
    const rest = new REST({ version: '10' }).setToken(config.token);

    try {
      logger.info(`Started refreshing ${client.slashCommands.length} application (/) commands.`);

      // Register globally
      const data = await rest.put(
        Routes.applicationCommands(config.clientId),
        { body: client.slashCommands }
      );

      logger.info(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
      logger.error('Failed to register slash commands:', error);
    }
  };
};
