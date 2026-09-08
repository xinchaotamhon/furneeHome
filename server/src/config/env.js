const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true, quiet: true });

function readProductionMode(nodeEnv, renderFlag) {
  return nodeEnv === 'production' || renderFlag === 'true';
}

function readAuthOtpDevMode(value, productionMode) {
  if (productionMode) return false;
  if (value === undefined || value === '') return true;
  return value === 'true';
}

function readSmtpFrom(values = process.env) {
  return values.EMAIL_FROM || values.SMTP_FROM || values.SMTP_USER;
}

function readSmtpSecure(values = process.env) {
  return values.SMTP_SECURE === 'true' || Number(values.SMTP_PORT) === 465;
}

// Render sets RENDER=true. Treat it as production even if NODE_ENV was omitted,
// so a deployed backend can never fall back to the local JWT secret.
const isProduction = readProductionMode(process.env.NODE_ENV, process.env.RENDER);
const configuredJwtSecret = process.env.JWT_SECRET;
if (isProduction && !configuredJwtSecret) {
  throw new Error('JWT_SECRET phải được cấu hình khi chạy production.');
}

function readTrustProxy(value) {
  if (!value || value === 'false') return false;
  if (value === 'true') return 'loopback';
  if (/^\d+$/.test(value)) return Number(value);
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

module.exports = {
  readTrustProxy,
  readProductionMode,
  readAuthOtpDevMode,
  readSmtpFrom,
  readSmtpSecure,
  isProduction,
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGO_URI,
  jwtSecret: configuredJwtSecret || 'development-only-secret',
  trustProxy: readTrustProxy(process.env.TRUST_PROXY),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN,
  cloudflareImageModel: process.env.CLOUDFLARE_IMAGE_MODEL || '@cf/black-forest-labs/flux-2-klein-4b',
  roomImageProviderOrder: process.env.ROOM_IMAGE_PROVIDER_ORDER || 'pollinations,cloudflare',
  pollinationsApiKey: process.env.POLLINATIONS_API_KEY,
  pollinationsImageModels: process.env.POLLINATIONS_IMAGE_MODELS || 'gpt-image-2,gptimage-large',
  smtpHost: process.env.SMTP_HOST,
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: readSmtpSecure(),
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  smtpFrom: readSmtpFrom(),
  authOtpDevMode: readAuthOtpDevMode(process.env.AUTH_OTP_DEV_MODE, isProduction),
};
