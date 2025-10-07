const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const connectDB = require('./config/database');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const matchingRoutes = require('./routes/matching');
const mapRoutes = require('./routes/map');
const socketHandler = require('./services/socketHandler');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["*"],
    credentials: true
  }
});

// Enhanced console logging on startup
console.log('\n🚀 STARTING MATCHAPP BACKEND SERVER 🚀');
console.log('══════════════════════════════════════');
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Time: ${new Date().toISOString()}`);
console.log(`Node Version: ${process.version}`);
console.log(`Platform: ${process.platform}`);
console.log('══════════════════════════════════════\n');

// Connect to database with logging
connectDB();

app.use(helmet());

// Enhanced Morgan logging for development
const morganFormat = process.env.NODE_ENV === 'production'
  ? 'combined'
  : ':method :url :status :res[content-length] - :response-time ms :date[iso]';

app.use(morgan(morganFormat, {
  stream: {
    write: (message) => {
      // Color code HTTP status
      const status = message.match(/(\d{3})/)?.[1];
      let color = '\x1b[0m'; // Default
      if (status) {
        if (status.startsWith('2')) color = '\x1b[32m'; // Green for 2xx
        else if (status.startsWith('3')) color = '\x1b[33m'; // Yellow for 3xx
        else if (status.startsWith('4')) color = '\x1b[31m'; // Red for 4xx
        else if (status.startsWith('5')) color = '\x1b[35m'; // Magenta for 5xx
      }
      console.log(`📡 ${color}${message.trim()}\x1b[0m`);
    }
  }
}));
app.use(cors({
  origin: "*",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["*"]
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // More generous in development
  message: {
    error: 'Too many requests from this IP, please try again later',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.error('\n🚫 RATE LIMIT EXCEEDED 🚫');
    console.error('═══════════════════════════');
    console.error(`Time: ${new Date().toISOString()}`);
    console.error(`IP: ${req.ip}`);
    console.error(`Method: ${req.method}`);
    console.error(`URL: ${req.originalUrl}`);
    console.error(`User-Agent: ${req.get('User-Agent')}`);
    console.error('═══════════════════════════\n');

    res.status(429).json({
      error: 'Too many requests from this IP, please try again later',
      retryAfter: '15 minutes'
    });
  }
});
app.use(limiter);

// More lenient SMS rate limiter for development
const smsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: process.env.NODE_ENV === 'production' ? 5 : 50, // 5 in production, 50 in development
  message: {
    error: 'Too many SMS requests, try again later',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Separate rate limiter for other auth endpoints (more permissive)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // More requests for auth endpoints
  message: {
    error: 'Too many authentication requests, try again later',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.set('io', io);

// Apply different rate limiters to different auth routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/matching', matchingRoutes);
app.use('/api/map', mapRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Server is running',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Debug endpoint for development
if (process.env.NODE_ENV !== 'production') {
  app.get('/api/debug/auth-flow', (req, res) => {
    res.json({
      authFlow: {
        registration: {
          step1: 'POST /api/auth/register - Returns userId, requires SMS verification',
          step2: 'POST /api/auth/verify-sms - Returns token after SMS verification'
        },
        login: {
          step1: 'POST /api/auth/login - Returns userId, requires SMS verification',
          step2: 'POST /api/auth/verify-login - Returns token after SMS verification'
        },
        note: 'Both registration and login require SMS verification to get authentication token'
      }
    });
  });

  app.get('/api/debug/rate-limits', (req, res) => {
    res.json({
      rateLimits: {
        general: {
          windowMs: '15 minutes',
          max: process.env.NODE_ENV === 'production' ? 100 : 1000,
          current: 'Check RateLimit-Remaining header in response'
        },
        auth: {
          windowMs: '15 minutes',
          max: process.env.NODE_ENV === 'production' ? 100 : 1000,
          applies: 'All /api/auth/* routes'
        },
        sms: {
          windowMs: '1 hour',
          max: process.env.NODE_ENV === 'production' ? 5 : 20,
          applies: 'Only /api/auth/register and /api/auth/login',
          keyBy: 'IP + phone number'
        }
      },
      headers: {
        'RateLimit-Limit': 'Maximum requests allowed',
        'RateLimit-Remaining': 'Requests remaining in current window',
        'RateLimit-Reset': 'Time when rate limit resets'
      },
      troubleshooting: {
        429: 'Too Many Requests - wait for rate limit to reset',
        solution: 'Wait for the time period or restart server in development'
      }
    });
  });

  // Debug endpoint to check user registration status
  app.post('/api/debug/check-user', async (req, res) => {
    try {
      const { phoneNumber } = req.body;
      if (!phoneNumber) {
        return res.status(400).json({ error: 'Phone number required' });
      }

      const User = require('./models/User');
      const user = await User.findOne({ phoneNumber }).select('-smsCode -smsCodeExpiry');

      if (!user) {
        return res.json({
          exists: false,
          status: 'NOT_REGISTERED',
          message: 'User does not exist in database',
          action: 'User needs to register first'
        });
      }

      res.json({
        exists: true,
        status: user.smsVerified ? 'FULLY_REGISTERED' : 'PENDING_SMS_VERIFICATION',
        user: {
          id: user._id,
          name: user.name,
          phoneNumber: user.phoneNumber,
          smsVerified: user.smsVerified,
          createdAt: user.createdAt
        },
        action: user.smsVerified ? 'Can login normally' : 'Needs to complete SMS verification'
      });
    } catch (error) {
      console.error('Debug check user error:', error);
      res.status(500).json({ error: 'Server error checking user' });
    }
  });
}

// Add error handling middleware (must be last)
app.use(errorHandler);

socketHandler(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log('\n✅ SERVER STARTED SUCCESSFULLY ✅');
  console.log('═══════════════════════════════');
  console.log(`🌐 Server running on port ${PORT}`);
  console.log(`📍 Local URL: http://localhost:${PORT}`);
  console.log(`🔍 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📊 Debug info: http://localhost:${PORT}/api/debug/auth-flow`);
  console.log(`⏰ Started at: ${new Date().toLocaleString()}`);
  console.log('═══════════════════════════════\n');

  console.log('📋 Available API Routes:');
  console.log('  AUTH:');
  console.log('    POST /api/auth/register');
  console.log('    POST /api/auth/verify-sms');
  console.log('    POST /api/auth/login');
  console.log('    POST /api/auth/verify-login');
  console.log('    GET  /api/auth/validate');
  console.log('    GET  /api/auth/me');
  console.log('    POST /api/auth/refresh');
  console.log('  USERS:');
  console.log('    GET  /api/users/nearby');
  console.log('    GET  /api/users/all');
  console.log('    POST /api/users/update-location');
  console.log('    GET  /api/users/profile/:id');
  console.log('    PUT  /api/users/profile');
  console.log('    POST /api/users/status');
  console.log('  MATCHING:');
  console.log('    POST /api/matching/request');
  console.log('    POST /api/matching/respond');
  console.log('    GET  /api/matching/history');
  console.log('    POST /api/matching/confirm-meeting');
  console.log('  MAP:');
  console.log('    GET  /api/map/config');
  console.log('    GET  /api/map/data');
  console.log('    GET  /api/map/location');
  console.log('    POST /api/map/location');
  console.log('\n🎯 Ready to accept requests!\n');
});