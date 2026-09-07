const mongoose = require('mongoose');

// Only an HMAC of the network address is retained.  The source address is never
// stored in MongoDB or sent back to the client.
const anonymousGenerationQuotaSchema = new mongoose.Schema({
  ipHash: { type: String, required: true, unique: true, index: true },
  state: { type: String, enum: ['available', 'reserved', 'used'], default: 'available' },
  reservationId: { type: String, default: '' },
  reservedUntil: { type: Date, default: null },
  usedAt: { type: Date, default: null },
  // The same one-way address key also bounds public OTP requests across
  // different email addresses. Raw network addresses are never persisted.
  emailOtpWindowStartedAt: { type: Date, default: null },
  emailOtpSendCount: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

module.exports = mongoose.model('AnonymousGenerationQuota', anonymousGenerationQuotaSchema);
