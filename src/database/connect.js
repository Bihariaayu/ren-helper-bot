const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

async function connectDatabase() {
  try {
    const dataDir = path.join(__dirname, '../../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    logger.info('[DATABASE] Using local file-based JSON storage (No online database required).');
    logger.info(`[DATABASE] Data directory: ${dataDir}`);
  } catch (error) {
    logger.error('[DATABASE] Failed to initialize local storage directory:', error);
    process.exit(1);
  }
}

module.exports = connectDatabase;
