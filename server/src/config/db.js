const mongoose = require('mongoose');
const env = require('./env');

async function connectDatabase() {
  if (!env.mongoUri) throw new Error('MONGO_URI is missing');
  await mongoose.connect(env.mongoUri);
  console.log('Connected to MongoDB');
}

module.exports = connectDatabase;
