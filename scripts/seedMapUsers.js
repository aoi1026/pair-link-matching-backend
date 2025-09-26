const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

// Tokyo area coordinates for realistic testing
const tokyoCenter = { lat: 35.6762, lng: 139.6503 };

const mapUsers = [
  {
    name: "田中太郎",
    phoneNumber: "+81901234567",
    gender: "male",
    address: "東京都渋谷区",
    location: {
      type: 'Point',
      coordinates: [139.6503, 35.6762] // Shibuya
    },
    profilePhoto: "https://randomuser.me/api/portraits/men/1.jpg",
    bio: "こんにちは！映画と読書が好きです。",
    smsVerified: true,
    isOnline: true,
    matchCount: 3,
    actualMeetCount: 1
  },
  {
    name: "佐藤花子",
    phoneNumber: "+81901234568",
    gender: "female",
    address: "東京都新宿区",
    location: {
      type: 'Point',
      coordinates: [139.7036, 35.6938] // Shinjuku
    },
    profilePhoto: "https://randomuser.me/api/portraits/women/1.jpg",
    bio: "カフェ巡りとヨガが趣味です♪",
    smsVerified: true,
    isOnline: true,
    matchCount: 5,
    actualMeetCount: 2
  },
  {
    name: "鈴木一郎",
    phoneNumber: "+81901234569",
    gender: "male",
    address: "東京都港区",
    location: {
      type: 'Point',
      coordinates: [139.7525, 35.6654] // Roppongi
    },
    profilePhoto: "https://randomuser.me/api/portraits/men/2.jpg",
    bio: "IT関係の仕事をしています。よろしくお願いします！",
    smsVerified: true,
    isOnline: false,
    matchCount: 2,
    actualMeetCount: 0,
    lastSeen: new Date(Date.now() - 1000 * 60 * 30) // 30 minutes ago
  },
  {
    name: "高橋美咲",
    phoneNumber: "+81901234570",
    gender: "female",
    address: "東京都品川区",
    location: {
      type: 'Point',
      coordinates: [139.7281, 35.6284] // Shinagawa
    },
    profilePhoto: "https://randomuser.me/api/portraits/women/2.jpg",
    bio: "料理と旅行が大好きです！",
    smsVerified: true,
    isOnline: true,
    matchCount: 7,
    actualMeetCount: 3
  },
  {
    name: "伊藤健太",
    phoneNumber: "+81901234571",
    gender: "male",
    address: "東京都台東区",
    location: {
      type: 'Point',
      coordinates: [139.7786, 35.7123] // Ueno
    },
    profilePhoto: "https://randomuser.me/api/portraits/men/3.jpg",
    bio: "スポーツ全般好きです。一緒に運動しませんか？",
    smsVerified: true,
    isOnline: true,
    matchCount: 4,
    actualMeetCount: 2
  },
  {
    name: "山田由美",
    phoneNumber: "+81901234572",
    gender: "female",
    address: "東京都文京区",
    location: {
      type: 'Point',
      coordinates: [139.7513, 35.7089] // Bunkyo
    },
    profilePhoto: "https://randomuser.me/api/portraits/women/3.jpg",
    bio: "アートと音楽が好きな会社員です。",
    smsVerified: true,
    isOnline: false,
    matchCount: 6,
    actualMeetCount: 1,
    lastSeen: new Date(Date.now() - 1000 * 60 * 60 * 2) // 2 hours ago
  },
  {
    name: "中村雄大",
    phoneNumber: "+81901234573",
    gender: "male",
    address: "東京都目黒区",
    location: {
      type: 'Point',
      coordinates: [139.6983, 35.6333] // Meguro
    },
    profilePhoto: "https://randomuser.me/api/portraits/men/4.jpg",
    bio: "ゲームとアニメが趣味です！同じ趣味の人と話したいです。",
    smsVerified: true,
    isOnline: true,
    matchCount: 1,
    actualMeetCount: 0
  },
  {
    name: "小林さくら",
    phoneNumber: "+81901234574",
    gender: "female",
    address: "東京都世田谷区",
    location: {
      type: 'Point',
      coordinates: [139.6503, 35.6464] // Setagaya
    },
    profilePhoto: "https://randomuser.me/api/portraits/women/4.jpg",
    bio: "犬と散歩するのが日課です🐕",
    smsVerified: true,
    isOnline: true,
    matchCount: 8,
    actualMeetCount: 4
  },
  {
    name: "加藤翔太",
    phoneNumber: "+81901234575",
    gender: "male",
    address: "東京都江戸川区",
    location: {
      type: 'Point',
      coordinates: [139.8686, 35.7068] // Edogawa
    },
    profilePhoto: "https://randomuser.me/api/portraits/men/5.jpg",
    bio: "釣りとキャンプが趣味のアウトドア派です！",
    smsVerified: true,
    isOnline: false,
    matchCount: 3,
    actualMeetCount: 1,
    lastSeen: new Date(Date.now() - 1000 * 60 * 15) // 15 minutes ago
  },
  {
    name: "松本あい",
    phoneNumber: "+81901234576",
    gender: "female",
    address: "東京都杉並区",
    location: {
      type: 'Point',
      coordinates: [139.6365, 35.7003] // Suginami
    },
    profilePhoto: "https://randomuser.me/api/portraits/women/5.jpg",
    bio: "カラオケとダンスが好きです♪",
    smsVerified: true,
    isOnline: true,
    matchCount: 9,
    actualMeetCount: 5
  }
];

const seedMapUsers = async () => {
  try {
    console.log('🗺️ Starting map users seed...');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/matching-app');
    console.log('💾 Connected to database');

    // Clear existing map test users
    await User.deleteMany({
      phoneNumber: { $regex: /^\+81901234/ }
    });
    console.log('🗑️ Cleared existing map test users');

    // Insert new map users
    const insertedUsers = await User.insertMany(mapUsers);
    console.log(`✅ Inserted ${insertedUsers.length} map test users`);

    // Log user locations for verification
    console.log('\n📍 User Locations:');
    insertedUsers.forEach((user, index) => {
      const [lng, lat] = user.location.coordinates;
      console.log(`${index + 1}. ${user.name}: [${lng}, ${lat}] - ${user.address}`);
    });

    console.log('\n🎯 Map seed completed successfully!');
    console.log('You can now test the map functionality with these users.');
    console.log('\nAPI Endpoints to test:');
    console.log('- GET /api/map/config');
    console.log('- GET /api/map/data?lat=35.6762&lng=139.6503&radius=50000');
    console.log('- GET /api/map/location (requires auth)');
    console.log('- POST /api/map/location (requires auth)');

  } catch (error) {
    console.error('❌ Map seed error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
    process.exit(0);
  }
};

// Run if called directly
if (require.main === module) {
  seedMapUsers();
}

module.exports = { seedMapUsers, mapUsers };