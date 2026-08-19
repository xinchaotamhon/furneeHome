const cors = require('cors');
const express = require('express');
const env = require('./config/env');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.use(cors({ origin: env.clientUrl }));
app.use(express.json({ limit: '15mb' }));
app.get('/api/health', (req, res) => res.json({ success: true, message: 'API is running', data: null }));
app.use('/api', routes);
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found', data: null }));
app.use(errorHandler);

module.exports = app;
