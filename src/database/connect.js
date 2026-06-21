const mongoose = require('mongoose');
const config = require('../config');

async function connectDatabase() {
  try {
    mongoose.set('strictQuery', false);
    await mongoose.connect(config.mongoUri);
    console.log('[DATABASE] Connected to MongoDB database successfully.');
  } catch (error) {
    console.error('[DATABASE] Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

module.exports = connectDatabase;
