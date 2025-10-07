const { validationResult, query, body } = require('express-validator');
const { getUsersForMap, getUserLocation, updateUserLocation } = require('../services/mapService');

/**
 * Get map data with nearby users
 */
const getMapData = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { lat, lng, radius = 50000 } = req.query; // Default 50km radius
    const currentUser = req.user;

    console.log(`🗺️ Map data requested by ${currentUser.name}`);

    const mapData = await getUsersForMap(currentUser, lat, lng, radius);

    res.json({
      success: true,
      data: mapData,
      message: `${mapData.count}人のユーザーが見つかりました`
    });

  } catch (error) {
    console.error('Get map data error:', error);
    res.status(500).json({
      success: false,
      error: 'マップデータの取得でエラーが発生しました'
    });
  }
};

/**
 * Get current user's location for map centering
 */
const getCurrentLocation = async (req, res) => {
  try {
    const userId = req.user._id;

    console.log(`📍 Current location requested for user ${userId}`);

    const location = await getUserLocation(userId);

    res.json({
      success: true,
      location,
      message: '現在地を取得しました'
    });

  } catch (error) {
    console.error('Get current location error:', error);
    res.status(500).json({
      success: false,
      error: '現在地の取得でエラーが発生しました',
      fallback: {
        lat: 35.6762, // Tokyo coordinates as fallback
        lng: 139.6503,
        address: 'Tokyo, Japan'
      }
    });
  }
};

/**
 * Update user location from map
 */
const updateMapLocation = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { lat, lng, address } = req.body;
    const userId = req.user._id;

    console.log(`📍 Location update from map for user ${userId}`);

    const updatedLocation = await updateUserLocation(userId, lat, lng, address);

    // Broadcast location update to connected sockets
    const io = req.app.get('io');
    if (io) {
      io.emit('userLocationUpdate', {
        userId,
        location: {
          lat: updatedLocation.lat,
          lng: updatedLocation.lng
        },
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      location: updatedLocation,
      message: '位置情報を更新しました'
    });

  } catch (error) {
    console.error('Update map location error:', error);
    res.status(500).json({
      success: false,
      error: '位置情報の更新でエラーが発生しました'
    });
  }
};

/**
 * Get map configuration and settings
 */
const getMapConfig = async (req, res) => {
  try {
    const config = {
      defaultCenter: {
        lat: 35.6762, // Tokyo
        lng: 139.6503
      },
      defaultZoom: 12,
      maxRadius: 200000, // 200km max search radius
      minRadius: 1000,   // 1km min search radius
      markerStyles: {
        male: {
          color: '#4A90E2',
          icon: '👨',
          size: 'medium'
        },
        female: {
          color: '#E24A90',
          icon: '👩',
          size: 'medium'
        },
        other: {
          color: '#50C878',
          icon: '🧑',
          size: 'medium'
        }
      },
      mapSettings: {
        showTraffic: false,
        showTransit: false,
        enableClustering: true,
        clusterRadius: 50,
        maxClusterRadius: 100
      },
      radiusOptions: [
        { label: '1km', value: 1000 },
        { label: '5km', value: 5000 },
        { label: '10km', value: 10000 },
        { label: '25km', value: 25000 },
        { label: '50km', value: 50000 },
        { label: '100km', value: 100000 }
      ]
    };

    res.json({
      success: true,
      config,
      message: 'マップ設定を取得しました'
    });

  } catch (error) {
    console.error('Get map config error:', error);
    res.status(500).json({
      success: false,
      error: 'マップ設定の取得でエラーが発生しました'
    });
  }
};

// Validation middleware
const mapDataValidation = [
  query('lat').isFloat({ min: -90, max: 90 }).withMessage('有効な緯度が必要です'),
  query('lng').isFloat({ min: -180, max: 180 }).withMessage('有効な経度が必要です'),
  query('radius').optional().isInt({ min: 1000, max: 200000 }).withMessage('半径は1000m〜200000mの範囲で入力してください')
];

const locationUpdateValidation = [
  body('lat').isFloat({ min: -90, max: 90 }).withMessage('有効な緯度が必要です'),
  body('lng').isFloat({ min: -180, max: 180 }).withMessage('有効な経度が必要です'),
  body('address').optional().isString().isLength({ max: 255 }).withMessage('住所は255文字以下で入力してください')
];

module.exports = {
  getMapData,
  getCurrentLocation,
  updateMapLocation,
  getMapConfig,
  mapDataValidation,
  locationUpdateValidation
};