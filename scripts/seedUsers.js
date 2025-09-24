const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/matching-app', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB Connected for seeding');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Function to generate random coordinates within a radius
const generateRandomLocation = (centerLat, centerLng, radiusKm) => {
  // Convert radius from kilometers to degrees
  const radiusInDegrees = radiusKm / 111.32;

  // Generate random angle and distance
  const u = Math.random();
  const v = Math.random();
  const w = radiusInDegrees * Math.sqrt(u);
  const t = 2 * Math.PI * v;

  // Calculate offset
  const x = w * Math.cos(t);
  const y = w * Math.sin(t);

  // Adjust for latitude scaling
  const newLat = centerLat + y;
  const newLng = centerLng + (x / Math.cos(centerLat * Math.PI / 180));

  return {
    lat: newLat,
    lng: newLng
  };
};

// Test users data
const createTestUsers = (centerLat, centerLng) => {
  const testUsers = [
    {
      name: 'Emma Johnson',
      phoneNumber: '+1234567891',
      gender: 'female',
      address: '123 Park Street, Downtown',
      bio: 'Love hiking and outdoor adventures. Looking for someone to explore the city with!',
      profilePhoto: 'https://randomuser.me/api/portraits/women/1.jpg',
      isOnline: true,
      matchCount: 15,
      actualMeetCount: 3,
      smsVerified: true
    },
    {
      name: 'Michael Chen',
      phoneNumber: '+1234567892',
      gender: 'male',
      address: '456 Main Avenue, Riverside',
      bio: 'Coffee enthusiast and bookworm. Let\'s grab a latte and discuss our favorite novels!',
      profilePhoto: 'https://randomuser.me/api/portraits/men/2.jpg',
      isOnline: true,
      matchCount: 8,
      actualMeetCount: 2,
      smsVerified: true
    },
    {
      name: 'Sophie Martinez',
      phoneNumber: '+1234567893',
      gender: 'female',
      address: '789 Oak Boulevard, Westside',
      bio: 'Yoga instructor and foodie. Always up for trying new restaurants!',
      profilePhoto: 'https://randomuser.me/api/portraits/women/3.jpg',
      isOnline: false,
      matchCount: 22,
      actualMeetCount: 5,
      smsVerified: true,
      lastSeen: new Date(Date.now() - 3600000) // 1 hour ago
    },
    {
      name: 'David Wilson',
      phoneNumber: '+1234567894',
      gender: 'male',
      address: '321 Elm Street, North District',
      bio: 'Musician and artist. Looking for someone who appreciates creativity and good music.',
      profilePhoto: 'https://randomuser.me/api/portraits/men/4.jpg',
      isOnline: true,
      matchCount: 12,
      actualMeetCount: 4,
      smsVerified: true
    },
    {
      name: 'Olivia Thompson',
      phoneNumber: '+1234567895',
      gender: 'female',
      address: '654 Pine Road, East End',
      bio: 'Travel blogger and photographer. Let\'s capture some memories together!',
      profilePhoto: 'https://randomuser.me/api/portraits/women/5.jpg',
      isOnline: false,
      matchCount: 30,
      actualMeetCount: 7,
      smsVerified: true,
      lastSeen: new Date(Date.now() - 7200000) // 2 hours ago
    }
  ];

  // Add random locations within 10km radius
  return testUsers.map(user => {
    const location = generateRandomLocation(centerLat, centerLng, 8); // Within 8km
    return {
      ...user,
      location: {
        type: 'Point',
        coordinates: [location.lng, location.lat]
      }
    };
  });
};

const seedUsers = async () => {
  try {
    await connectDB();

    // Default center location (you can change this to your actual location)
    // Using a sample location - Update these coordinates to your actual location
    const centerLat = 40.7128; // Example: New York City latitude
    const centerLng = -74.0060; // Example: New York City longitude

    console.log(`Creating test users around location: ${centerLat}, ${centerLng}`);

    // Clear existing test users
    await User.deleteMany({
      phoneNumber: { $in: ['+1234567891', '+1234567892', '+1234567893', '+1234567894', '+1234567895'] }
    });
    console.log('Cleared existing test users');

    // Create new test users
    const testUsers = createTestUsers(centerLat, centerLng);

    for (const testUser of testUsers) {
      const user = new User(testUser);
      await user.save();
      console.log(`Created user: ${user.name} at ${user.location.coordinates}`);
    }

    console.log('Test users created successfully!');

    // Display all users
    const allUsers = await User.find({}).select('name location isOnline');
    console.log('\nAll users in database:');
    allUsers.forEach(user => {
      console.log(`- ${user.name}: ${user.location.coordinates} (${user.isOnline ? 'Online' : 'Offline'})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error seeding users:', error);
    process.exit(1);
  }
};

// Run the seed function
seedUsers();