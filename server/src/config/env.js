const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true, quiet: true });

function readProductionMode(nodeEnv, renderFlag) {
  return nodeEnv === 'production' || renderFlag === 'true';
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
  // Express accepts a comma-separated allowlist of proxy IPs/CIDRs.  Deliberately
  // do not turn on unrestricted X-Forwarded-For trust from an environment typo.
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

module.exports = {
  readTrustProxy,
  readProductionMode,
  isProduction,
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGO_URI,
  jwtSecret: configuredJwtSecret || 'development-only-secret',
  anonymousQuotaSalt: process.env.ANONYMOUS_QUOTA_SALT || configuredJwtSecret || 'development-only-anonymous-quota-salt',
  trustProxy: readTrustProxy(process.env.TRUST_PROXY),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  kreaApiKey: process.env.KREA_API_KEY,
  cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN,
  cloudflareImageModel: process.env.CLOUDFLARE_IMAGE_MODEL || '@cf/black-forest-labs/flux-2-klein-4b',
  // Optional image-edit fallbacks. Existing Cloudflare-only .env files keep working.
  roomImageProviderOrder: process.env.ROOM_IMAGE_PROVIDER_ORDER || 'pollinations,cloudflare,huggingface',
  pollinationsApiKey: process.env.POLLINATIONS_API_KEY,
  pollinationsImageModels: process.env.POLLINATIONS_IMAGE_MODELS || 'gpt-image-2,gptimage-large,klein,kontext',
  huggingFaceToken: process.env.HF_TOKEN,
  // HF_TOKEN alone is intentionally insufficient: set an image-to-image model served by hf-inference.
  huggingFaceImageModel: process.env.HUGGINGFACE_IMAGE_MODEL,
};
