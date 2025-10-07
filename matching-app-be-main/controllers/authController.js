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

    const { name, phoneNumber, gender, address, latitude, longitude } = req.body;

    let user = await User.findOne({ phoneNumber });
    if (user && user.smsVerified) {
      return res.status(400).json({ error: 'この電話番号は既に登録されています' });
    }

    const smsCode = generateSMSCode();
    const smsCodeExpiry = new Date(Date.now() + 10 * 60 * 1000);

    if (user && !user.smsVerified) {
      user.name = name;
      user.gender = gender;
      user.address = address;
      user.smsCode = smsCode;
      user.smsCodeExpiry = smsCodeExpiry;
      // Update location if provided
      if (latitude && longitude) {
        user.location = {
          type: 'Point',
          coordinates: [parseFloat(longitude), parseFloat(latitude)]
        };
      }
    } else {
      const userData = {
        name,
        phoneNumber,
        gender,
        address,
        smsCode,
        smsCodeExpiry,
        smsVerified: false
      };

      // Add location if provided
      if (latitude && longitude) {
        userData.location = {
          type: 'Point',
          coordinates: [parseFloat(longitude), parseFloat(latitude)]
        };
      }

      user = new User(userData);
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
          error: '認証コードの送信に失敗しました。電話番号を確認して再度お試しください。',
          details: process.env.NODE_ENV === 'development' ? smsResult.error : undefined
        });
      }
      // In development, allow registration to proceed even if SMS mock fails
      console.log('開発モード: SMS送信失敗でも処理を続行');
    }

    res.status(201).json({
      message: '認証コードを送信しました',
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
        return res.status(400).json({ error: '電話番号の形式が正しくありません。国際形式で入力してください（例：+8190XXXXXXXX）。' });
      }
      if (error.message.includes('SMS service not configured')) {
        return res.status(503).json({ error: 'SMS サービスが一時的に利用できません。後でもう一度お試しください。' });
      }
    }
    res.status(500).json({
      error: '登録中にサーバーエラーが発生しました',
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
      return res.status(400).json({ error: 'ユーザーが見つかりません' });
    }

    if (user.smsVerified) {
      return res.status(400).json({ error: '電話番号は既に認証済みです' });
    }

    if (!user.smsCode || user.smsCode !== code) {
      return res.status(400).json({ error: '認証コードが正しくありません' });
    }

    if (new Date() > user.smsCodeExpiry) {
      return res.status(400).json({ error: '認証コードの有効期限が切れています' });
    }

    user.smsVerified = true;
    user.smsCode = undefined;
    user.smsCodeExpiry = undefined;
    await user.save();

    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    res.json({
      message: '電話番号の認証が完了しました',
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
        bio: user.bio,
        location: user.location
      }
    });
  } catch (error) {
    console.error('SMS verification error:', error);
    res.status(500).json({ error: 'SMS認証中にサーバーエラーが発生しました' });
  }
};

const login = async (req, res) => {
  try {
    // const errors = validationResult(req);
    // if (!errors.isEmpty()) {
    //   return res.status(400).json({ errors: errors.array() });
    // }
    const { phoneNumber, latitude, longitude } = req.body;
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

    // Update location if provided
    if (latitude && longitude) {
      user.location = {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)]
      };
    }

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
          error: '認証コードの送信に失敗しました。電話番号を確認して再度お試しください。',
          details: process.env.NODE_ENV === 'development' ? smsResult.error : undefined
        });
      }
      // In development, allow login to proceed even if SMS mock fails
      console.log('開発モード: SMS送信失敗でも処理を続行');
    }

    res.json({
      message: '認証コードを送信しました',
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
        return res.status(400).json({ error: '電話番号の形式が正しくありません。国際形式で入力してください（例：+8190XXXXXXXX）。' });
      }
      if (error.message.includes('SMS service not configured')) {
        return res.status(503).json({ error: 'SMS サービスが一時的に利用できません。後でもう一度お試しください。' });
      }
    }
    res.status(500).json({
      error: 'ログイン中にサーバーエラーが発生しました',
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

    const { userId, code, latitude, longitude } = req.body;

    const user = await User.findById(userId);
    if (!user || !user.smsVerified) {
      return res.status(400).json({ error: 'ユーザーが見つからないか認証が完了していません' });
    }

    if (!user.smsCode || user.smsCode !== code) {
      return res.status(400).json({ error: '認証コードが正しくありません' });
    }

    if (new Date() > user.smsCodeExpiry) {
      return res.status(400).json({ error: '認証コードの有効期限が切れています' });
    }

    user.smsCode = undefined;
    user.smsCodeExpiry = undefined;
    user.lastSeen = new Date();

    // Update location if provided
    if (latitude && longitude) {
      user.location = {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)]
      };
    }

    await user.save();

    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    res.json({
      message: 'ログインが完了しました',
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
        location: user.location,
        bio: user.bio,
        matchCount: user.matchCount,
        actualMeetCount: user.actualMeetCount
      }
    });
  } catch (error) {
    console.error('Login verification error:', error);
    res.status(500).json({ error: 'ログイン認証中にサーバーエラーが発生しました' });
  }
};

const registerValidation = [
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('名前は2文字以上50文字以下で入力してください'),
  body('phoneNumber').isMobilePhone('any', { strictMode: false }).withMessage('有効な電話番号を入力してください'),
  body('gender').isIn(['male', 'female', 'other']).withMessage('性別を選択してください'),
  body('address').trim().isLength({ min: 5, max: 200 }).withMessage('住所は5文字以上200文字以下で入力してください'),
  body('latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('有効な緯度を入力してください'),
  body('longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('有効な経度を入力してください')
];

const smsValidation = [
  body('userId').isMongoId().withMessage('有効なユーザーIDが必要です'),
  body('code').isLength({ min: 6, max: 6 }).withMessage('6桁のコードを入力してください'),
  body('latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('有効な緯度を入力してください'),
  body('longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('有効な経度を入力してください')
];

const loginValidation = [
  body('phoneNumber').isMobilePhone('any', { strictMode: false }).withMessage('有効な電話番号を入力してください'),
  body('latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('有効な緯度を入力してください'),
  body('longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('有効な経度を入力してください')
];

// Validate current session/token
const validateSession = async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        isAuthenticated: false,
        error: 'トークンが提供されていません'
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-smsCode -smsCodeExpiry');

      if (!user) {
        return res.status(401).json({
          isAuthenticated: false,
          error: 'ユーザーが見つかりません'
        });
      }

      if (!user.smsVerified) {
        return res.status(401).json({
          isAuthenticated: false,
          error: '電話番号が認証されていません'
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
        error: '無効なトークンです'
      });
    }
  } catch (error) {
    console.error('Session validation error:', error);
    res.status(500).json({
      isAuthenticated: false,
      error: 'セッション認証中にサーバーエラーが発生しました'
    });
  }
};

// Auto-login with token
const getCurrentUser = async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: '認証が必要です' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-smsCode -smsCodeExpiry');

    if (!user || !user.smsVerified) {
      return res.status(401).json({ error: '無効なユーザーまたは認証が完了していません' });
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
    res.status(401).json({ error: '無効または期限切れのトークンです' });
  }
};

// Refresh token endpoint
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: 'リフレッシュトークンが必要です' });
    }

    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

      if (decoded.type !== 'refresh') {
        return res.status(401).json({ error: '無効なリフレッシュトークンです' });
      }

      const user = await User.findById(decoded.userId).select('-smsCode -smsCodeExpiry');

      if (!user || !user.smsVerified) {
        return res.status(401).json({ error: 'ユーザーが見つからないか認証が完了していません' });
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
      return res.status(401).json({ error: '無効または期限切れのリフレッシュトークンです' });
    }
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'トークン更新中にサーバーエラーが発生しました' });
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