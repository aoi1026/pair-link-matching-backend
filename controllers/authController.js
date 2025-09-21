const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { generateSMSCode, sendVerificationCode } = require('../services/twilioService');

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

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
      return res.status(500).json({ error: 'Failed to send verification code' });
    }

    res.status(201).json({
      message: 'Verification code sent to your phone',
      userId: user._id,
      phoneNumber: user.phoneNumber
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during registration' });
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

    res.json({
      message: 'Phone number verified successfully',
      token,
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
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { phoneNumber } = req.body;

    const user = await User.findOne({ phoneNumber });
    if (!user || !user.smsVerified) {
      return res.status(400).json({ error: 'User not found or not verified' });
    }

    const smsCode = generateSMSCode();
    const smsCodeExpiry = new Date(Date.now() + 10 * 60 * 1000);

    user.smsCode = smsCode;
    user.smsCodeExpiry = smsCodeExpiry;
    await user.save();

    const smsResult = await sendVerificationCode(phoneNumber, smsCode);
    if (!smsResult.success) {
      return res.status(500).json({ error: 'Failed to send verification code' });
    }

    res.json({
      message: 'Verification code sent to your phone',
      userId: user._id,
      phoneNumber: user.phoneNumber
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
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

    res.json({
      message: 'Login successful',
      token,
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

module.exports = {
  register,
  verifySMS,
  login,
  verifyLogin,
  registerValidation,
  smsValidation,
  loginValidation
};