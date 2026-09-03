const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

module.exports = {
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET || 'development-only-secret',
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
