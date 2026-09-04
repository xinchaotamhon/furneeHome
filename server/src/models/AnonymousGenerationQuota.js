const mongoose = require('mongoose');

// Only an HMAC of the network address is retained.  The source address is never
// stored in MongoDB or sent back to the client.
const anonymousGenerationQuotaSchema = new mongoose.Schema({
  ipHash: { type: String, required: true, unique: true, index: true },
  state: { type: String, enum: ['available', 'reserved', 'used'], default: 'available' },
  reservationId: { type: String, default: '' },
  reservedUntil: { type: Date, default: null },
  usedAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('AnonymousGenerationQuota', anonymousGenerationQuotaSchema);
