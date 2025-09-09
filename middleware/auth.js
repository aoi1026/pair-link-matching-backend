const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-smsCode -smsCodeExpiry');
    
    if (!user) {
      return res.status(401).json({ error: 'Token is not valid.' });
    }

    if (!user.smsVerified) {
      return res.status(401).json({ error: 'Phone number not verified.' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token is not valid.' });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-smsCode -smsCodeExpiry');
      req.user = user;
    }
    
    next();
  } catch (error) {
    next();
  }
};

module.exports = { auth, optionalAuth };