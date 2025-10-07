const express = require('express');
const { 認証 } = require('../middleware/auth');
const {
  マップデータ取得,
  現在地取得,
  マップ位置更新,
  マップ設定取得,
  マップデータ検証,
  位置更新検証
} = require('../controllers/mapController');

const ルーター = express.Router();

// マップ設定の取得（基本設定は認証不要）
ルーター.get('/設定', マップ設定取得);

// 近隣ユーザーを含むマップデータの取得（認証が必要）
ルーター.get('/データ', 認証, マップデータ検証, マップデータ取得);

// 現在ユーザーの位置の取得（認証が必要）
ルーター.get('/現在地', 認証, 現在地取得);

// マップからユーザーの位置を更新（認証が必要）
ルーター.post('/現在地', 認証, 位置更新検証, マップ位置更新);

module.exports = ルーター;
