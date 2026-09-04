const cors = require('cors');
const express = require('express');
const env = require('./config/env');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.set('trust proxy', env.trustProxy);
app.use(cors({
  origin: env.clientUrl === '*' ? '*' : [env.clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}));
app.use(express.json({ limit: '15mb' }));
app.get('/api/health', (req, res) => res.json({ success: true, message: 'API is running', data: null }));
app.use('/api', routes);
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found', data: null }));
app.use(errorHandler);

module.exports = app;
