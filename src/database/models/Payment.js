const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  paymentId: { type: String, required: true, unique: true },
  guildId: { type: String, required: true },
  guildName: { type: String, required: true },
  userId: { type: String, required: true },
  username: { type: String, required: true },
  method: { type: String, required: true }, // 'UPI', 'PayPal', 'BTC', etc.
  amount: { type: String, required: true },
  notes: { type: String, default: null },
  transactionId: { type: String, default: null },
  screenshotUrl: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  verifiedBy: { type: String, default: null },
  rejectionReason: { type: String, default: null },
  timestamp: { type: Date, default: Date.now }
});

PaymentSchema.index({ guildId: 1, paymentId: 1 });
PaymentSchema.index({ guildId: 1, userId: 1 });

module.exports = mongoose.model('Payment', PaymentSchema);
