const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
  matchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match',
    required: true
  },
  scheduledTime: {
    type: Date,
    required: true
  },
  actualMeetingTime: {
    type: Date
  },
  requesterConfirmed: {
    type: Boolean,
    default: false
  },
  targetConfirmed: {
    type: Boolean,
    default: false
  },
  bothConfirmed: {
    type: Boolean,
    default: false
  },
  requesterRating: {
    type: Number,
    min: 1,
    max: 5
  },
  targetRating: {
    type: Number,
    min: 1,
    max: 5
  },
  meetingSuccess: {
    type: Boolean,
    default: false
  },
  notes: {
    type: String,
    maxlength: 1000
  }
}, {
  timestamps: true
});

meetingSchema.index({ matchId: 1 });

module.exports = mongoose.model('Meeting', meetingSchema);