require('dotenv').config();

const requiredEnv = ['DISCORD_TOKEN', 'MONGO_URI', 'CLIENT_ID'];
const missingEnv = requiredEnv.filter(env => !process.env[env]);

if (missingEnv.length > 0) {
  console.warn(`[WARNING] Missing environment variables: ${missingEnv.join(', ')}`);
  console.warn(`[WARNING] Make sure to set these in the .env file before running in production.`);
}

module.exports = {
  token: process.env.DISCORD_TOKEN || 'MOCK_TOKEN',
  clientId: process.env.CLIENT_ID || 'MOCK_CLIENT_ID',
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/ren-helper',
  owners: (process.env.OWNER_IDS || '').split(',').map(id => id.trim()).filter(Boolean),
  invitePrefix: '-i',
  utilityPrefix: 'r?',
  colors: {
    red: 0xE74C3C,    // Ren Cloud Red
    green: 0x2ECC71,  // Ren Cloud Green
    dark: 0x1A1A2E    // Dark UI background color
  },
  footer: '☁️ Ren Helper • Ren Cloud'
};
