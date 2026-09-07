const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  username: { type: String, unique: true, sparse: true, trim: true, lowercase: true, match: /^[a-z0-9][a-z0-9._-]{2,31}$/ },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  avatarUrl: { type: String, default: '', trim: true, maxlength: 2_000 },
  password: { type: String, required: true },
  // Existing users predate email verification and remain usable because the
  // default is true. New registrations explicitly set this to false first.
  emailVerified: { type: Boolean, default: true },
  emailOtpHash: { type: String, select: false },
  emailOtpExpiresAt: { type: Date, select: false },
  emailOtpAttempts: { type: Number, default: 0, select: false },
  emailOtpSentAt: { type: Date, select: false },
  emailOtpWindowStartedAt: { type: Date, select: false },
  emailOtpSendCount: { type: Number, default: 0, select: false },
  registrationTokenHash: { type: String, select: false },
  registrationTokenExpiresAt: { type: Date, select: false },
  role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
  // A deliberately weak demonstration account may exist only on this machine.
  // It is denied on production and from every non-loopback socket address.
  localOnly: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
