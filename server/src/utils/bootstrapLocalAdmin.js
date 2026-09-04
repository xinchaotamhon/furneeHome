// Explicit, local-only bootstrap. It never runs as part of server startup or
// normal seed data, and it never prints a password or connection string.
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDatabase = require('../config/db');
const env = require('../config/env');
const User = require('../models/User');

function readConfiguration() {
  const username = String(process.env.LOCAL_ADMIN_USERNAME || '').trim().toLowerCase();
  const email = String(process.env.LOCAL_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.LOCAL_ADMIN_PASSWORD || '');
  // This script makes only localOnly accounts and refuses production. Its explicit
  // confirmation flag is the narrow exception for a requested short demo secret;
  // ordinary registration continues to require a six-character password.
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username) || !email || password.length < 1) {
    throw new Error('Thiếu cấu hình local admin hợp lệ. Kiểm tra LOCAL_ADMIN_USERNAME, LOCAL_ADMIN_EMAIL, LOCAL_ADMIN_PASSWORD.');
  }
  return { username, email, password };
}

async function bootstrapLocalAdmin({ resetPassword = false } = {}) {
  if (env.isProduction) throw new Error('Local admin bootstrap không được phép chạy trong production.');
  const configuration = readConfiguration();
  await connectDatabase();
  try {
    const existing = await User.findOne({ $or: [{ username: configuration.username }, { email: configuration.email }] });
    if (existing && (existing.username !== configuration.username || existing.email !== configuration.email)) {
      throw new Error('Username hoặc email đã thuộc tài khoản khác; không thay đổi tài khoản đó.');
    }
    if (existing) {
      existing.name = existing.name || 'Local Administrator';
      existing.role = 'admin';
      existing.localOnly = true;
      existing.isActive = true;
      if (resetPassword) existing.password = await bcrypt.hash(configuration.password, 12);
      await existing.save();
      return { created: false, passwordReset: resetPassword, username: existing.username };
    }
    const user = await User.create({
      name: 'Local Administrator', username: configuration.username, email: configuration.email,
      password: await bcrypt.hash(configuration.password, 12), role: 'admin', localOnly: true, isActive: true,
    });
    return { created: true, passwordReset: true, username: user.username };
  } finally {
    await mongoose.disconnect();
  }
}

async function main() {
  if (!process.argv.includes('--create-or-update-local-admin')) {
    throw new Error('Xác nhận rõ bằng --create-or-update-local-admin. Thêm --reset-password nếu thực sự muốn đổi mật khẩu admin local có sẵn.');
  }
  const result = await bootstrapLocalAdmin({ resetPassword: process.argv.includes('--reset-password') });
  console.log(result.created ? `Đã tạo local admin: ${result.username}` : `Đã xác nhận local admin: ${result.username}`);
}

module.exports = { bootstrapLocalAdmin, readConfiguration };

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    mongoose.disconnect().finally(() => { process.exitCode = 1; });
  });
}
