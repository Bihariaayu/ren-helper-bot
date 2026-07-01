const mongoose = require('../localDb');

const PaymentSchema = new mongoose.Schema({
  paymentId: { type: String, required: true, unique: true },
  guildId: { type: String, required: true },
  guildName: { type: String, required: true },
  // The user who submitted the payment proof (payer)
  userId: { type: String, required: true },
  username: { type: String, required: true },
  // Who generated the QR (could be a staff/admin for another user)
  requestedById: { type: String, default: null },
  requestedByUsername: { type: String, default: null },
  // Target user this QR was generated for (if different from payer)
  targetUserId: { type: String, default: null },
  targetUsername: { type: String, default: null },
  channelId: { type: String, required: true },
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
