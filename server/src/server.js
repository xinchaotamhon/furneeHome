const dns = require('node:dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {}

const app = require('./app');
const connectDatabase = require('./config/db');
const env = require('./config/env');

connectDatabase()
  .then(() => app.listen(env.port, () => console.log(`Server running at http://localhost:${env.port}`)))
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
