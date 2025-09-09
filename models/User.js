const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: true
  },
  address: {
    type: String,
    required: true
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    }
  },
  profilePhoto: {
    type: String,
    default: ''
  },
  bio: {
    type: String,
    default: '',
    maxlength: 500
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  matchCount: {
    type: Number,
    default: 0
  },
  actualMeetCount: {
    type: Number,
    default: 0
  },
  smsVerified: {
    type: Boolean,
    default: false
  },
  smsCode: {
    type: String
  },
  smsCodeExpiry: {
    type: Date
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  socketId: {
    type: String
  }
}, {
  timestamps: true
});

userSchema.index({ location: '2dsphere' });
userSchema.index({ phoneNumber: 1 });

module.exports = mongoose.model('User', userSchema);