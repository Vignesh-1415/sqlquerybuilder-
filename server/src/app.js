const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const env = require('./config/env');
const { generalLimiter } = require('./middleware/rateLimiter');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const uploadRoutes = require('./routes/upload.routes');
const queryRoutes = require('./routes/query.routes');
const historyRoutes = require('./routes/history.routes');
const sessionRoutes = require('./routes/session.routes');

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow same-origin/non-browser requests (no Origin header) and any configured origin.
      if (!origin || env.allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use(generalLimiter);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Statement API is running.', timestamp: new Date().toISOString() });
});

app.use('/api/upload', uploadRoutes);
app.use('/api/query', queryRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/session', sessionRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
