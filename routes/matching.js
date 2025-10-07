const express = require('express');
const { 認証 } = require('../middleware/auth');
const {
  マッチリクエスト送信,
  マッチ応答,
  マッチ履歴取得,
  ミーティング確認,
  マッチリクエスト検証,
  マッチ応答検証,
  ミーティング確認検証
} = require('../controllers/matchingController');

const ルーター = express.Router();

ルーター.post('/リクエスト', 認証, マッチリクエスト検証, マッチリクエスト送信);
ルーター.post('/応答', 認証, マッチ応答検証, マッチ応答);
ルーター.get('/履歴', 認証, マッチ履歴取得);
ルーター.post('/ミーティング確認', 認証, ミーティング確認検証, ミーティング確認);

module.exports = ルーター;
