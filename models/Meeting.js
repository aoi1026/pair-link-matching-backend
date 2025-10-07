const mongoose = require('mongoose');

const ミーティングスキーマ = new mongoose.Schema({
  マッチID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'マッチ',
    required: true
  },
  予定時刻: {
    type: Date,
    required: true
  },
  実会時刻: {
    type: Date
  },
  リクエスト者確認済み: {
    type: Boolean,
    default: false
  },
  対象者確認済み: {
    type: Boolean,
    default: false
  },
  両者確認済み: {
    type: Boolean,
    default: false
  },
  リクエスト者評価: {
    type: Number,
    min: 1,
    max: 5
  },
  対象者評価: {
    type: Number,
    min: 1,
    max: 5
  },
  会合成功: {
    type: Boolean,
    default: false
  },
  メモ: {
    type: String,
    maxlength: 1000
  }
}, {
  timestamps: true
});

ミーティングスキーマ.index({ マッチID: 1 });

module.exports = mongoose.model('ミーティング', ミーティングスキーマ);
