const mongoose = require('mongoose');

const PaymentConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  upiId: { type: String, default: null },
  merchantName: { type: String, default: 'Ren Cloud Merchant' },
  paypalUsername: { type: String, default: null },
  cryptoAddresses: {
    type: Map,
    of: String,
    default: {}
  },
  paymentChannelId: { type: String, default: null } // Log channel for payment verifications
});

module.exports = mongoose.model('PaymentConfig', PaymentConfigSchema);
