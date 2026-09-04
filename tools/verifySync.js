const fs = require('fs');
const path = require('path');
const mongoose = require(path.join(__dirname, '../server/node_modules/mongoose'));

const ROOT_DIR = path.resolve(__dirname, '..');
const ENV_FILE = path.join(ROOT_DIR, '.env');
const DATA_JSON_FILE = path.join(ROOT_DIR, 'client/public/data_import/data_import.json');

try {
  const envContent = fs.readFileSync(ENV_FILE, 'utf8');
  for (const line of envContent.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const idx = t.indexOf('=');
    if (idx !== -1) {
      const k = t.slice(0, idx).trim();
      const v = t.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[k]) process.env[k] = v;
    }
  }
} catch (err) {
  console.warn(err.message);
}

async function verify() {
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'furneeHome' });
  const db = mongoose.connection.db;
  const products = await db.collection('products').find({}).toArray();
  const trailingHyphens = products.filter(p => (p.slug || '').endsWith('-'));
  const missingCatName = products.filter(p => !p.categoryName || p.categoryName === '');
  const missingCategory = products.filter(p => !p.category);

  console.log('=== MONGO VERIFICATION ===');
  console.log('Total products:', products.length);
  console.log('Products with trailing hyphens in slug:', trailingHyphens.length);
  console.log('Products with missing categoryName:', missingCatName.length);
  console.log('Products with missing category ObjectId:', missingCategory.length);

  const jsonContent = JSON.parse(fs.readFileSync(DATA_JSON_FILE, 'utf8'));
  const jsonTrailingHyphens = jsonContent.filter(p => (p.slug || '').endsWith('-'));
  const jsonMissingCat = jsonContent.filter(p => !p.categoryName || !p.category);

  console.log('\n=== JSON VERIFICATION ===');
  console.log('Total JSON items:', jsonContent.length);
  console.log('JSON items with trailing hyphens:', jsonTrailingHyphens.length);
  console.log('JSON items missing category:', jsonMissingCat.length);

  const pLine815 = jsonContent.find(p => p._id === '6a87d4f4e6bc754fbb5bcbc3');
  console.log('\n=== TARGET PRODUCT (6a87d4f4e6bc754fbb5bcbc3) ===');
  console.log('Slug in JSON:', pLine815 ? pLine815.slug : 'Not found');
  console.log('Category in JSON:', pLine815 ? pLine815.categoryName : 'Not found');

  const pMongo815 = products.find(p => String(p._id) === '6a87d4f4e6bc754fbb5bcbc3');
  console.log('Slug in Mongo:', pMongo815 ? pMongo815.slug : 'Not found');
  console.log('Category in Mongo:', pMongo815 ? pMongo815.categoryName : 'Not found');

  await mongoose.disconnect();
}

verify().catch(console.error);
