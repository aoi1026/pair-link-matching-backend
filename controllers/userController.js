const { body, query, validationResult } = require('express-validator');
const User = require('../models/User');

const getNearbyUsers = async (req, res) => {
  try {
    const errors = validationResult(req);

    console.log(errors, errors.isEmpty());


    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }
    const { lat, lng, radius = 100000 } = req.query;

    const currentUser = req.user;

    console.log(`Searching for users within ${radius}m of coordinates [${lng}, ${lat}] for user ${currentUser._id}`);

    const nearbyUsers = await User.find({
      _id: { $ne: currentUser._id },
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: parseInt(radius)
        }
      }
    }).select('-smsCode -smsCodeExpiry -phoneNumber');

    console.log(`Found ${nearbyUsers.length} users within ${radius}m radius`);

    // Log the first few users for debugging
    nearbyUsers.slice(0, 3).forEach((user, index) => {
      console.log(`User ${index + 1}: ${user.name} at [${user.location?.coordinates}]`);
    });

    res.json({
      users: nearbyUsers,
      count: nearbyUsers.length
    });
  } catch (error) {
    console.error('Get nearby users error:', error);
    res.status(500).json({ error: 'Server error getting nearby users' });
  }
};

const updateLocation = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { lat, lng } = req.body;
    const userId = req.user._id;

    const user = await User.findByIdAndUpdate(
      userId,
      {
        location: {
          type: 'Point',
          coordinates: [lng, lat]
        },
        lastSeen: new Date(),
        isOnline: true
      },
      { new: true }
    ).select('-smsCode -smsCodeExpiry');

    req.app.get('io').emit('userLocationUpdate', {
      userId: user._id,
      location: user.location,
      isOnline: user.isOnline
    });

    res.json({
      message: 'Location updated successfully',
      location: user.location
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ error: 'Server error updating location' });
  }
};

const getUserProfile = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select('-smsCode -smsCodeExpiry -phoneNumber');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ error: 'Server error getting user profile' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, bio, profilePhoto, address } = req.body;
    const userId = req.user._id;

    const updateData = {};
    if (name) updateData.name = name;
    if (bio !== undefined) updateData.bio = bio;
    if (profilePhoto) updateData.profilePhoto = profilePhoto;
    if (address) updateData.address = address;

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    ).select('-smsCode -smsCodeExpiry');

    res.json({
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Server error updating profile' });
  }
};

const setOnlineStatus = async (req, res) => {
  try {
    const { isOnline } = req.body;
    const userId = req.user._id;

    const user = await User.findByIdAndUpdate(
      userId,
      {
        isOnline,
        lastSeen: new Date(),
        ...(isOnline ? {} : { socketId: null })
      },
      { new: true }
    ).select('-smsCode -smsCodeExpiry');

    req.app.get('io').emit('userStatusUpdate', {
      userId: user._id,
      isOnline: user.isOnline,
      lastSeen: user.lastSeen
    });

    res.json({
      message: 'Status updated successfully',
      isOnline: user.isOnline
    });
  } catch (error) {
    console.error('Set online status error:', error);
    res.status(500).json({ error: 'Server error updating status' });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({})
      .select('name gender location isOnline profilePhoto bio address matchCount actualMeetCount lastSeen')
      .sort({ createdAt: -1 });

    res.json({
      users,
      count: users.length
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Server error getting users' });
  }
};

const nearbyUsersValidation = [
  query('lat').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
  query('lng').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
  query('radius').optional().isInt({ min: 100, max: 200000 }).withMessage('Radius must be 100-200000 meters')
];

const locationValidation = [
  body('lat').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
  body('lng').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required')
];

const profileValidation = [
  body('name').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
  body('bio').optional().isLength({ max: 500 }).withMessage('Bio must be less than 500 characters'),
  body('profilePhoto').optional().isURL().withMessage('Valid photo URL required'),
  body('address').optional().trim().isLength({ min: 5, max: 200 }).withMessage('Address must be 5-200 characters')
];

module.exports = {
  getNearbyUsers,
  updateLocation,
  getUserProfile,
  updateProfile,
  setOnlineStatus,
  getAllUsers,
  nearbyUsersValidation,
  locationValidation,
  profileValidation
};