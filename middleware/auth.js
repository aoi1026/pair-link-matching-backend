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

    console.log('token:', token);


    // const user = {
    //   "_id": "68d2b6e5cf3427dbf4b6dd7e",
    //   "name": "Michael Chen",
    //   "phoneNumber": "+1234567892",
    //   "gender": "male",
    //   "address": "456 Main Avenue, Riverside",
    //   "location": {
    //     "type": "Point",
    //     "coordinates": [
    //       -73.9885070683817,
    //       40.7687968977701
    //     ]
    //   },
    //   "profilePhoto": "https://randomuser.me/api/portraits/men/2.jpg",
    //   "bio": "Coffee enthusiast and bookworm. Let's grab a latte and discuss our favorite novels!",
    //   "isOnline": true,
    //   "matchCount": 8,
    //   "actualMeetCount": 2,
    //   "smsVerified": true,
    //   "lastSeen": "2025-09-23T15:04:05.052Z",
    //   "createdAt": "2025-09-23T15:04:05.053Z",
    //   "updatedAt": "2025-09-23T15:04:05.053Z",
    //   "__v": 0
    // }

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