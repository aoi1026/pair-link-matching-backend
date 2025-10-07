const mongoose = require('mongoose');

const ユーザースキーマ = new mongoose.Schema({
  名前: {
    type: String,
    required: true,
    trim: true
  },
  電話番号: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  性別: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: true
  },
  住所: {
    type: String,
    required: true
  },
  位置: {
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
  プロフィール写真: {
    type: String,
    default: ''
  },
  自己紹介: {
    type: String,
    default: '',
    maxlength: 500
  },
  オンライン状態: {
    type: Boolean,
    default: false
  },
  マッチ数: {
    type: Number,
    default: 0
  },
  実会数: {
    type: Number,
    default: 0
  },
  SMS認証済み: {
    type: Boolean,
    default: false
  },
  SMSコード: {
    type: String
  },
  SMSコード有効期限: {
    type: Date
  },
  最終接続: {
    type: Date,
    default: Date.now
  },
  ソケットID: {
    type: String
  }
}, {
  timestamps: true
});

// 位置情報での地理空間検索用インデックス
ユーザースキーマ.index({ 位置: '2dsphere' });
ユーザースキーマ.index({ 電話番号: 1 });

module.exports = mongoose.model('ユーザー', ユーザースキーマ);
