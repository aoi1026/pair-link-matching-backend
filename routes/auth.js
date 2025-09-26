const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  register,
  verifySMS,
  login,
  verifyLogin,
  validateSession,
  getCurrentUser,
  refreshToken,
  registerValidation,
  smsValidation,
  loginValidation
} = require('../controllers/authController');

const router = express.Router();

// SMS-specific rate limiter (more restrictive for SMS endpoints only)
const smsSpecificLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: process.env.NODE_ENV === 'production' ? 5 : 20, // 5 in production, 20 in development
  message: {
    error: 'Too many SMS requests from this IP, please try again later',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by IP + phone number for SMS endpoints
    return req.ip + (req.body.phoneNumber || '');
  }
});

// Registration flow - only /register gets SMS rate limiting
router.post('/register', smsSpecificLimiter, registerValidation, register);
router.post('/verify-sms', smsValidation, verifySMS);

// Login flow - only /login gets SMS rate limiting
router.post('/login', smsSpecificLimiter, loginValidation, login);
router.post('/verify-login', smsValidation, verifyLogin);

// Session validation (for page refresh) - no rate limiting needed
router.get('/validate', validateSession);
router.get('/me', getCurrentUser);
router.post('/refresh', refreshToken);

module.exports = router;
