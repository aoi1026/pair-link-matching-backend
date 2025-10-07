const express = require('express');
const { 認証 } = require('../middleware/auth');
const {
  近隣ユーザー取得,
  位置更新,
  ユーザープロフィール取得,
  プロフィール更新,
  オンライン状態設定,
  全ユーザー取得,
  近隣ユーザー検証,
  位置検証,
  プロフィール検証
} = require('../controllers/userController');

const ルーター = express.Router();

ルーター.get('/近隣', 認証, 近隣ユーザー検証, 近隣ユーザー取得);
ルーター.get('/全件', 全ユーザー取得);
ルーター.post('/位置更新', 認証, 位置検証, 位置更新);
ルーター.get('/プロフィール/:id', 認証, ユーザープロフィール取得);
ルーター.put('/プロフィール', プロフィール更新);
ルーター.post('/状態', 認証, オンライン状態設定);

module.exports = ルーター;
