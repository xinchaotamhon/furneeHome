const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  username: { type: String, unique: true, sparse: true, trim: true, lowercase: true, match: /^[a-z0-9][a-z0-9._-]{2,31}$/ },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  avatarUrl: { type: String, default: '', trim: true, maxlength: 2_000 },
  password: { type: String, required: true },
  emailVerified: { type: Boolean, default: true },
  registrationOtpHash: { type: String, select: false },
  registrationOtpExpiresAt: { type: Date, select: false },
  registrationOtpAttempts: { type: Number, default: 0, select: false },
  resetOtpHash: { type: String, select: false },
  resetOtpExpiresAt: { type: Date, select: false },
  role: { type: String, enum: ['customer', 'admin', 'superadmin'], default: 'customer' },
  localOnly: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
