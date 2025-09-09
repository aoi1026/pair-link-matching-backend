const express = require('express');
const { auth } = require('../middleware/auth');
const {
  getNearbyUsers,
  updateLocation,
  getUserProfile,
  updateProfile,
  setOnlineStatus,
  nearbyUsersValidation,
  locationValidation,
  profileValidation
} = require('../controllers/userController');

const router = express.Router();

router.get('/nearby', auth, nearbyUsersValidation, getNearbyUsers);
router.post('/update-location', auth, locationValidation, updateLocation);
router.get('/profile/:id', auth, getUserProfile);
router.put('/profile', auth, profileValidation, updateProfile);
router.post('/status', auth, setOnlineStatus);

module.exports = router;