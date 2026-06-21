const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

module.exports = (client) => {
  const eventsPath = path.join(__dirname, '../events');
  
  // Read event category directories
  const categories = fs.readdirSync(eventsPath);

  for (const category of categories) {
    const categoryPath = path.join(eventsPath, category);
    
    if (!fs.lstatSync(categoryPath).isDirectory()) continue;

    const eventFiles = fs.readdirSync(categoryPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
      const filePath = path.join(categoryPath, file);
      try {
        const event = require(filePath);
        const eventName = file.split('.')[0];

        if (event.once) {
          client.once(eventName, (...args) => event.execute(...args, client));
        } else {
          client.on(eventName, (...args) => event.execute(...args, client));
        }

        logger.info(`Loaded event: ${eventName} (${category})`);
      } catch (err) {
        logger.error(`Error loading event ${file}`, err);
      }
    }
  }
};
