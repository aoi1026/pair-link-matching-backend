const jwt = require('jsonwebtoken');
const ユーザー = require('../models/User');

const 認証 = async (req, res, next) => {
  try {
    const トークン = req.header('Authorization')?.replace('Bearer ', '');

    if (!トークン) {
      return res.status(401).json({ エラー: 'アクセスが拒否されました。トークンが提供されていません。' });
    }

    const 復号データ = jwt.verify(トークン, process.env.JWT_SECRET);
    const 対象ユーザー = await ユーザー.findById(復号データ.ユーザーID).select('-SMSコード -SMSコード有効期限');

    console.log('トークン:', トークン);

    if (!対象ユーザー) {
      return res.status(401).json({ エラー: 'トークンが無効です。' });
    }

    if (!対象ユーザー.SMS認証済み) {
      return res.status(401).json({ エラー: '電話番号が認証されていません。' });
    }

    req.認証ユーザー = 対象ユーザー;
    next();
  } catch (error) {
    res.status(401).json({ エラー: 'トークンが無効です。' });
  }
};

const 任意認証 = async (req, res, next) => {
  try {
    const トークン = req.header('Authorization')?.replace('Bearer ', '');

    if (トークン) {
      const 復号データ = jwt.verify(トークン, process.env.JWT_SECRET);
      const 対象ユーザー = await ユーザー.findById(復号データ.ユーザーID).select('-SMSコード -SMSコード有効期限');
      req.認証ユーザー = 対象ユーザー;
    }

    next();
  } catch (error) {
    next();
  }
};

module.exports = { 認証, 任意認証 };
