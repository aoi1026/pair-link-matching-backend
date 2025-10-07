const mongoose = require('mongoose');

const マッチスキーマ = new mongoose.Schema({
  リクエスト者ID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ユーザー',
    required: true
  },
  対象ユーザーID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ユーザー',
    required: true
  },
  ステータス: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'expired'],
    default: 'pending'
  },
  会う理由: {
    type: String,
    required: true
  },
  待ち合わせ地点: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true
    },
    住所: {
      type: String
    },
    場所名: {
      type: String
    }
  },
  有効期限: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000)
  }
}, {
  timestamps: true
});

マッチスキーマ.index({ リクエスト者ID: 1, 対象ユーザーID: 1 });
マッチスキーマ.index({ 有効期限: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('マッチ', マッチスキーマ);
