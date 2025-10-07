const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  登録,
  SMS認証,
  ログイン,
  ログイン認証,
  セッション検証,
  現在ユーザー取得,
  トークン更新,
  登録検証,
  SMS検証,
  ログイン検証
} = require('../controllers/authController');

const ルーター = express.Router();

// SMS 専用レート制限（SMS エンドポイントのみより厳しく制限する）
const SMS専用レート制限 = rateLimit({
  windowMs: 60 * 60 * 1000, // 1時間のウィンドウ
  max: process.env.NODE_ENV === 'production' ? 5 : 20, // 本番では5回、開発では20回
  message: {
    エラー: 'この IP からの SMS リクエストが多すぎます。後でもう一度お試しください',
    リトライ後: '1時間'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // SMS エンドポイントは IP + 電話番号でレート制限する
    return req.ip + (req.body.電話番号 || '');
  }
});

// 登録フロー - /登録 のみ SMS レート制限を適用する
ルーター.post('/登録', SMS専用レート制限, 登録検証, 登録);
ルーター.post('/SMS認証', SMS検証, SMS認証);

// ログインフロー - /ログイン のみ SMS レート制限を適用する
ルーター.post('/ログイン', SMS専用レート制限, ログイン検証, ログイン);
ルーター.post('/ログイン認証', SMS検証, ログイン認証);

// セッション検証（ページ更新用）- レート制限は不要
ルーター.get('/セッション検証', セッション検証);
ルーター.get('/現在ユーザー', 現在ユーザー取得);
ルーター.post('/トークン更新', トークン更新);

module.exports = ルーター;
