const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });

const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';

if (isProduction && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET phải được cấu hình khi chạy production.');
}

module.exports = {
  isProduction,
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET || 'development-only-secret',
  trustProxy: process.env.TRUST_PROXY === 'true' ? 1 : false,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN,
  cloudflareImageModel: process.env.CLOUDFLARE_IMAGE_MODEL || '@cf/black-forest-labs/flux-2-klein-4b',
  roomImageProviderOrder: process.env.ROOM_IMAGE_PROVIDER_ORDER || 'pollinations,cloudflare',
  pollinationsApiKey: process.env.POLLINATIONS_API_KEY,
  pollinationsImageModels: process.env.POLLINATIONS_IMAGE_MODELS || 'gpt-image-2,gptimage-large',
  smtpHost: process.env.SMTP_HOST,
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  smtpFrom: process.env.EMAIL_FROM,
  authOtpDevMode: !isProduction && process.env.AUTH_OTP_DEV_MODE !== 'false',
};
