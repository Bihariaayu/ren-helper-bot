const dns = require('dns');

// Fix for Windows IPv6 preference
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

// Fix for local ISP DNS blocking MongoDB SRV queries (use Google/Cloudflare DNS instead)
const dnsResolver = new dns.Resolver();
dnsResolver.setServers(['8.8.8.8', '1.1.1.1']);

dns.resolveSrv = (name, cb) => dnsResolver.resolveSrv(name, cb);
dns.resolveTxt = (name, cb) => dnsResolver.resolveTxt(name, cb);

if (dns.promises && dns.promises.Resolver) {
  const dnsPromisesResolver = new dns.promises.Resolver();
  dnsPromisesResolver.setServers(['8.8.8.8', '1.1.1.1']);
  dns.promises.resolveSrv = (name) => dnsPromisesResolver.resolveSrv(name);
  dns.promises.resolveTxt = (name) => dnsPromisesResolver.resolveTxt(name);
}

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const config = require('./config');
const connectDatabase = require('./database/connect');
const logger = require('./utils/logger');

// Initialize Client with necessary intents and partials
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.MessageContent
  ],
  partials: [
    Partials.User,
    Partials.GuildMember,
    Partials.Message,
    Partials.Channel
  ]
});

// Add global error handling to prevent bot crashes in production
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise);
  logger.error('Reason:', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception thrown:', err);
});

async function bootstrap() {
  // Connect to Database
  await connectDatabase();

  // Load Handlers
  require('./handlers/commandHandler')(client);
  require('./handlers/eventHandler')(client);

  // Login Client
  if (config.token === 'MOCK_TOKEN') {
    logger.warn('Running with a mock token. Replace with your actual token in .env for production.');
  } else {
    try {
      await client.login(config.token);
    } catch (err) {
      logger.error('Failed to log in to Discord API:', err);
    }
  }
}

bootstrap();
