const User = require('../models/User');

/**
 * Calculate distance between two points in meters using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lng1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lng2 - Longitude of second point
 * @returns {number} Distance in meters
 */
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

/**
 * Get users for map display with their locations
 * @param {Object} currentUser - The requesting user
 * @param {number} lat - Center latitude
 * @param {number} lng - Center longitude
 * @param {number} radius - Search radius in meters
 * @returns {Promise<Array>} Array of users with map data
 */
const getUsersForMap = async (currentUser, lat, lng, radius = 100000) => {
  try {
    console.log(`🗺️ Fetching map data for ${currentUser.name}`);
    console.log(`📍 Center: [${lng}, ${lat}], Radius: ${radius}m`);

    // Find nearby users
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
      },
      isOnline: true // Only show online users on map
    }).select('name gender location profilePhoto bio isOnline lastSeen matchCount');

    // Enhance users with map-specific data
    const mapUsers = nearbyUsers.map(user => {
      const distance = calculateDistance(
        lat, lng,
        user.location.coordinates[1], user.location.coordinates[0]
      );

      return {
        id: user._id,
        name: user.name,
        gender: user.gender,
        profilePhoto: user.profilePhoto || getDefaultAvatar(user.gender),
        bio: user.bio || 'こんにちは！',
        location: {
          lat: user.location.coordinates[1],
          lng: user.location.coordinates[0]
        },
        distance: Math.round(distance),
        isOnline: user.isOnline,
        lastSeen: user.lastSeen,
        matchCount: user.matchCount,
        // Add map marker properties
        marker: {
          color: getMarkerColor(user.gender),
          icon: getMarkerIcon(user.gender),
          size: user.isOnline ? 'large' : 'medium'
        }
      };
    });

    console.log(`📊 Found ${mapUsers.length} users for map display`);

    return {
      users: mapUsers,
      center: { lat: parseFloat(lat), lng: parseFloat(lng) },
      radius: parseInt(radius),
      count: mapUsers.length
    };

  } catch (error) {
    console.error('Map service error:', error);
    throw error;
  }
};

/**
 * Get default avatar based on gender
 * @param {string} gender - User gender
 * @returns {string} Avatar URL
 */
const getDefaultAvatar = (gender) => {
  const avatarMap = {
    male: 'https://randomuser.me/api/portraits/men/0.jpg',
    female: 'https://randomuser.me/api/portraits/women/0.jpg',
    other: 'https://randomuser.me/api/portraits/lego/0.jpg'
  };
  return avatarMap[gender] || avatarMap.other;
};

/**
 * Get marker color based on gender
 * @param {string} gender - User gender
 * @returns {string} Hex color code
 */
const getMarkerColor = (gender) => {
  const colorMap = {
    male: '#4A90E2',    // Blue
    female: '#E24A90',  // Pink
    other: '#50C878'    // Green
  };
  return colorMap[gender] || colorMap.other;
};

/**
 * Get marker icon based on gender
 * @param {string} gender - User gender
 * @returns {string} Icon identifier
 */
const getMarkerIcon = (gender) => {
  const iconMap = {
    male: 'male',
    female: 'female',
    other: 'person'
  };
  return iconMap[gender] || iconMap.other;
};

/**
 * Get user's current location for map centering
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User location
 */
const getUserLocation = async (userId) => {
  try {
    const user = await User.findById(userId).select('location address');

    if (!user || !user.location || !user.location.coordinates) {
      throw new Error('User location not found');
    }

    return {
      lat: user.location.coordinates[1],
      lng: user.location.coordinates[0],
      address: user.address
    };
  } catch (error) {
    console.error('Get user location error:', error);
    throw error;
  }
};

/**
 * Update user location for map
 * @param {string} userId - User ID
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {string} address - Optional address
 * @returns {Promise<Object>} Updated location
 */
const updateUserLocation = async (userId, lat, lng, address = null) => {
  try {
    console.log(`📍 Updating location for user ${userId}: [${lng}, ${lat}]`);

    const updateData = {
      location: {
        type: 'Point',
        coordinates: [parseFloat(lng), parseFloat(lat)]
      },
      lastSeen: new Date()
    };

    if (address) {
      updateData.address = address;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    ).select('location address name');

    console.log(`✅ Location updated for ${user.name}`);

    return {
      lat: user.location.coordinates[1],
      lng: user.location.coordinates[0],
      address: user.address
    };
  } catch (error) {
    console.error('Update user location error:', error);
    throw error;
  }
};

module.exports = {
  getUsersForMap,
  calculateDistance,
  getUserLocation,
  updateUserLocation,
  getDefaultAvatar,
  getMarkerColor,
  getMarkerIcon
};