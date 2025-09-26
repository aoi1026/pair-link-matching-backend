const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { generateSMSCode, sendVerificationCode } = require('../services/twilioService');

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const generateRefreshToken = (userId) => {
  return jwt.sign({ userId, type: 'refresh' }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

const register = async (req, res) => {
  try {
    // const errors = validationResult(req);
    // if (!errors.isEmpty()) {
    //   return res.status(400).json({ errors: errors.array() });
    // }

    const { name, phoneNumber, gender, address } = req.body;

    let user = await User.findOne({ phoneNumber });
    if (user && user.smsVerified) {
      return res.status(400).json({ error: 'User already exists with this phone number' });
    }

    const smsCode = generateSMSCode();
    const smsCodeExpiry = new Date(Date.now() + 10 * 60 * 1000);

    if (user && !user.smsVerified) {
      user.name = name;
      user.gender = gender;
      user.address = address;
      user.smsCode = smsCode;
      user.smsCodeExpiry = smsCodeExpiry;
    } else {
      user = new User({
        name,
        phoneNumber,
        gender,
        address,
        smsCode,
        smsCodeExpiry,
        smsVerified: false
      });
    }

    await user.save();

    const smsResult = await sendVerificationCode(phoneNumber, smsCode);
    if (!smsResult.success) {
      console.error(`Failed to send SMS during registration:`, smsResult.error);
      // In production, properly handle SMS failures
      if (process.env.NODE_ENV === 'production') {
        // Clean up the user record if SMS fails in production
        if (!user.smsVerified) {
          await User.findByIdAndDelete(user._id);
        }
        return res.status(500).json({
          error: 'Failed to send verification code. Please check your phone number and try again.',
          details: process.env.NODE_ENV === 'development' ? smsResult.error : undefined
        });
      }
      // In development, allow registration to proceed even if SMS mock fails
      console.log('Development mode: Proceeding despite SMS failure');
    }

    res.status(201).json({
      message: 'Verification code sent to your phone',
      userId: user._id,
      phoneNumber: user.phoneNumber,
      isNewUser: true,
      requiresVerification: true
    });
  } catch (error) {
    console.error('Registration error:', error);
    // Provide more specific error messages in production
    if (process.env.NODE_ENV === 'production' && error.message) {
      if (error.message.includes('Invalid phone number')) {
        return res.status(400).json({ error: 'Invalid phone number format. Please use international format (e.g., +1234567890).' });
      }
      if (error.message.includes('SMS service not configured')) {
        return res.status(503).json({ error: 'SMS service temporarily unavailable. Please try again later.' });
      }
    }
    res.status(500).json({
      error: 'Server error during registration',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const verifySMS = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId, code } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    if (user.smsVerified) {
      return res.status(400).json({ error: 'Phone already verified' });
    }

    if (!user.smsCode || user.smsCode !== code) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    if (new Date() > user.smsCodeExpiry) {
      return res.status(400).json({ error: 'Verification code expired' });
    }

    user.smsVerified = true;
    user.smsCode = undefined;
    user.smsCodeExpiry = undefined;
    await user.save();

    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    res.json({
      message: 'Phone number verified successfully',
      token,
      refreshToken,
      isRegistrationComplete: true,
      user: {
        id: user._id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        gender: user.gender,
        address: user.address,
        profilePhoto: user.profilePhoto,
        bio: user.bio
      }
    });
  } catch (error) {
    console.error('SMS verification error:', error);
    res.status(500).json({ error: 'Server error during verification' });
  }
};

const login = async (req, res) => {
  try {
    // const errors = validationResult(req);
    // if (!errors.isEmpty()) {
    //   return res.status(400).json({ errors: errors.array() });
    // }
    const { phoneNumber } = req.body;
    console.log(req.body);

    const user = await User.findOne({ phoneNumber });

    // Check if user exists at all
    if (!user) {
      console.log(`🚫 Login attempt for unregistered phone: ${phoneNumber}`);
      return res.status(404).json({
        error: 'この電話番号は登録されていません。まず新規登録を行ってください。',
        errorCode: 'USER_NOT_REGISTERED',
        suggestion: '新規登録ページから登録を完了してください',
        redirectTo: 'register'
      });
    }

    // Check if user exists but not SMS verified
    if (!user.smsVerified) {
      console.log(`🚫 Login attempt for unverified user: ${phoneNumber}`);
      return res.status(400).json({
        error: 'この電話番号は登録されていますが、SMS認証が完了していません。',
        errorCode: 'SMS_NOT_VERIFIED',
        suggestion: 'SMS認証を完了してからログインしてください',
        userId: user._id,
        redirectTo: 'verify-sms'
      });
    }

    const smsCode = generateSMSCode();
    const smsCodeExpiry = new Date(Date.now() + 10 * 60 * 1000);

    user.smsCode = smsCode;
    user.smsCodeExpiry = smsCodeExpiry;
    await user.save();

    const smsResult = await sendVerificationCode(phoneNumber, smsCode);
    if (!smsResult.success) {
      console.error(`Failed to send SMS during login:`, smsResult.error);
      // In production, properly handle SMS failures
      if (process.env.NODE_ENV === 'production') {
        // Reset SMS code on failure
        user.smsCode = undefined;
        user.smsCodeExpiry = undefined;
        await user.save();
        return res.status(500).json({
          error: 'Failed to send verification code. Please check your phone number and try again.',
          details: process.env.NODE_ENV === 'development' ? smsResult.error : undefined
        });
      }
      // In development, allow login to proceed even if SMS mock fails
      console.log('Development mode: Proceeding despite SMS failure');
    }

    res.json({
      message: 'Verification code sent to your phone',
      userId: user._id,
      phoneNumber: user.phoneNumber,
      isNewUser: false,
      requiresVerification: true
    });
  } catch (error) {
    console.error('Login error:', error);
    // Provide more specific error messages in production
    if (process.env.NODE_ENV === 'production' && error.message) {
      if (error.message.includes('Invalid phone number')) {
        return res.status(400).json({ error: 'Invalid phone number format. Please use international format (e.g., +1234567890).' });
      }
      if (error.message.includes('SMS service not configured')) {
        return res.status(503).json({ error: 'SMS service temporarily unavailable. Please try again later.' });
      }
    }
    res.status(500).json({
      error: 'Server error during login',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const verifyLogin = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId, code } = req.body;

    const user = await User.findById(userId);
    if (!user || !user.smsVerified) {
      return res.status(400).json({ error: 'User not found or not verified' });
    }

    if (!user.smsCode || user.smsCode !== code) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    if (new Date() > user.smsCodeExpiry) {
      return res.status(400).json({ error: 'Verification code expired' });
    }

    user.smsCode = undefined;
    user.smsCodeExpiry = undefined;
    user.lastSeen = new Date();
    await user.save();

    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    res.json({
      message: 'Login successful',
      token,
      refreshToken,
      isLoginComplete: true,
      user: {
        id: user._id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        gender: user.gender,
        address: user.address,
        profilePhoto: user.profilePhoto,
        bio: user.bio,
        matchCount: user.matchCount,
        actualMeetCount: user.actualMeetCount
      }
    });
  } catch (error) {
    console.error('Login verification error:', error);
    res.status(500).json({ error: 'Server error during login verification' });
  }
};

const registerValidation = [
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
  body('phoneNumber').isMobilePhone('any', { strictMode: false }).withMessage('Valid phone number required'),
  body('gender').isIn(['male', 'female', 'other']).withMessage('Valid gender required'),
  body('address').trim().isLength({ min: 5, max: 200 }).withMessage('Address must be 5-200 characters')
];

const smsValidation = [
  body('userId').isMongoId().withMessage('Valid user ID required'),
  body('code').isLength({ min: 6, max: 6 }).withMessage('6-digit code required')
];

const loginValidation = [
  body('phoneNumber').isMobilePhone('any', { strictMode: false }).withMessage('Valid phone number required')
];

// Validate current session/token
const validateSession = async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        isAuthenticated: false,
        error: 'No token provided'
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-smsCode -smsCodeExpiry');

      if (!user) {
        return res.status(401).json({
          isAuthenticated: false,
          error: 'User not found'
        });
      }

      if (!user.smsVerified) {
        return res.status(401).json({
          isAuthenticated: false,
          error: 'Phone number not verified'
        });
      }

      res.json({
        isAuthenticated: true,
        user: {
          id: user._id,
          name: user.name,
          phoneNumber: user.phoneNumber,
          gender: user.gender,
          address: user.address,
          profilePhoto: user.profilePhoto,
          bio: user.bio,
          matchCount: user.matchCount,
          actualMeetCount: user.actualMeetCount,
          isOnline: user.isOnline,
          lastSeen: user.lastSeen
        }
      });
    } catch (error) {
      return res.status(401).json({
        isAuthenticated: false,
        error: 'Invalid token'
      });
    }
  } catch (error) {
    console.error('Session validation error:', error);
    res.status(500).json({
      isAuthenticated: false,
      error: 'Server error during session validation'
    });
  }
};

// Auto-login with token
const getCurrentUser = async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-smsCode -smsCodeExpiry');

    if (!user || !user.smsVerified) {
      return res.status(401).json({ error: 'Invalid user or not verified' });
    }

    res.json({
      user: {
        id: user._id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        gender: user.gender,
        address: user.address,
        profilePhoto: user.profilePhoto,
        bio: user.bio,
        matchCount: user.matchCount,
        actualMeetCount: user.actualMeetCount,
        isOnline: user.isOnline,
        location: user.location,
        lastSeen: user.lastSeen
      }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Refresh token endpoint
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

      if (decoded.type !== 'refresh') {
        return res.status(401).json({ error: 'Invalid refresh token' });
      }

      const user = await User.findById(decoded.userId).select('-smsCode -smsCodeExpiry');

      if (!user || !user.smsVerified) {
        return res.status(401).json({ error: 'User not found or not verified' });
      }

      const newToken = generateToken(user._id);
      const newRefreshToken = generateRefreshToken(user._id);

      res.json({
        token: newToken,
        refreshToken: newRefreshToken,
        user: {
          id: user._id,
          name: user.name,
          phoneNumber: user.phoneNumber,
          gender: user.gender,
          address: user.address,
          profilePhoto: user.profilePhoto,
          bio: user.bio,
          matchCount: user.matchCount,
          actualMeetCount: user.actualMeetCount,
          isOnline: user.isOnline,
          location: user.location,
          lastSeen: user.lastSeen
        }
      });
    } catch (error) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Server error during token refresh' });
  }
};
 ////
module.exports = {
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
};