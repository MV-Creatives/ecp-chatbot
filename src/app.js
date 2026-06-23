require('dotenv').config(); // v2

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const chatRoutes = require('./routes/chat');
const bookingRoutes = require('./routes/booking');
const paymentRoutes = require('./routes/payment');
const cruiseRoutes = require('./routes/cruise');
const escalateRoutes = require('./routes/escalate');
const { widgetAuth } = require('./middleware/auth');

const app = express();

const allowedOrigins = [
  'https://eastcoastparking.com.au',
  'https://www.eastcoastparking.com.au',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:3001',
];

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '50kb' }));

const limiter = rateLimit({ windowMs: 60 * 1000, max: 30, message: { error: 'Too many requests' } });
app.use('/api/', limiter);

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.get('/debug', async (req, res) => {
  const result = { env: {}, allKeys: Object.keys(process.env).sort() };
  result.env.ANTHROPIC_API_KEY = (process.env.ANTHROPIC_API_KEY || '').substring(0, 15) + '...';
  result.env.WIDGET_API_KEY = process.env.WIDGET_API_KEY || 'NOT SET';
  result.env.NODE_ENV = process.env.NODE_ENV || 'NOT SET';
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    await client.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: 5, messages: [{ role: 'user', content: 'hi' }] });
    result.claude = 'ok';
  } catch (err) { result.claude = err.message; }
  res.json(result);
});

app.use('/api/chat', widgetAuth, chatRoutes);
app.use('/api/booking', widgetAuth, bookingRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/cruise-schedule', cruiseRoutes);
app.use('/api/escalate-to-agent', widgetAuth, escalateRoutes);

// Serve frontend files (widget.js + demo page)
app.use(express.static(require('path').join(__dirname, '../frontend')));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
