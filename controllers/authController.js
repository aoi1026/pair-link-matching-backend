const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const ユーザー = require('../models/User');
const { SMSコード生成, 認証コード送信 } = require('../services/twilioService');

const トークン生成 = (ユーザーID) => {
  return jwt.sign({ ユーザーID }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const リフレッシュトークン生成 = (ユーザーID) => {
  return jwt.sign({ ユーザーID, type: 'refresh' }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

const 登録 = async (req, res) => {
  try {
    // const 検証エラー = validationResult(req);
    // if (!検証エラー.isEmpty()) {
    //   return res.status(400).json({ エラー一覧: 検証エラー.array() });
    // }

    const { 名前, 電話番号, 性別, 住所, 緯度, 経度 } = req.body;

    let 対象ユーザー = await ユーザー.findOne({ 電話番号 });
    if (対象ユーザー && 対象ユーザー.SMS認証済み) {
      return res.status(400).json({ エラー: 'この電話番号は既に登録されています' });
    }

    const SMSコード = SMSコード生成();
    const SMSコード有効期限 = new Date(Date.now() + 10 * 60 * 1000);

    if (対象ユーザー && !対象ユーザー.SMS認証済み) {
      対象ユーザー.名前 = 名前;
      対象ユーザー.性別 = 性別;
      対象ユーザー.住所 = 住所;
      対象ユーザー.SMSコード = SMSコード;
      対象ユーザー.SMSコード有効期限 = SMSコード有効期限;
      // 位置情報が提供されていれば更新する
      if (緯度 && 経度) {
        対象ユーザー.位置 = {
          type: 'Point',
          coordinates: [parseFloat(経度), parseFloat(緯度)]
        };
      }
    } else {
      const ユーザーデータ = {
        名前,
        電話番号,
        性別,
        住所,
        SMSコード,
        SMSコード有効期限,
        SMS認証済み: false
      };

      // 位置情報が提供されていれば追加する
      if (緯度 && 経度) {
        ユーザーデータ.位置 = {
          type: 'Point',
          coordinates: [parseFloat(経度), parseFloat(緯度)]
        };
      }

      対象ユーザー = new ユーザー(ユーザーデータ);
    }

    await 対象ユーザー.save();

    const SMS結果 = await 認証コード送信(電話番号, SMSコード);
    if (!SMS結果.成功) {
      console.error(`登録時の SMS 送信に失敗しました:`, SMS結果.エラー);
      // 本番環境では SMS 失敗を適切に処理する
      if (process.env.NODE_ENV === 'production') {
        // 本番で SMS が失敗した場合はユーザーレコードを削除する
        if (!対象ユーザー.SMS認証済み) {
          await ユーザー.findByIdAndDelete(対象ユーザー._id);
        }
        return res.status(500).json({
          エラー: '認証コードの送信に失敗しました。電話番号を確認して再度お試しください。',
          詳細: process.env.NODE_ENV === 'development' ? SMS結果.エラー : undefined
        });
      }
      // 開発環境では SMS モックが失敗しても登録を続行する
      console.log('開発モード: SMS送信失敗でも処理を続行');
    }

    res.status(201).json({
      メッセージ: '認証コードを送信しました',
      ユーザーID: 対象ユーザー._id,
      電話番号: 対象ユーザー.電話番号,
      新規ユーザー: true,
      認証要求: true
    });
  } catch (error) {
    console.error('登録エラー:', error);
    // 本番環境ではより具体的なエラーメッセージを提供する
    if (process.env.NODE_ENV === 'production' && error.message) {
      if (error.message.includes('Invalid phone number')) {
        return res.status(400).json({ エラー: '電話番号の形式が正しくありません。国際形式で入力してください（例：+8190XXXXXXXX）。' });
      }
      if (error.message.includes('SMS service not configured')) {
        return res.status(503).json({ エラー: 'SMS サービスが一時的に利用できません。後でもう一度お試しください。' });
      }
    }
    res.status(500).json({
      エラー: '登録中にサーバーエラーが発生しました',
      詳細: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const SMS認証 = async (req, res) => {
  try {
    const 検証エラー = validationResult(req);
    if (!検証エラー.isEmpty()) {
      return res.status(400).json({ エラー一覧: 検証エラー.array() });
    }

    const { ユーザーID, コード } = req.body;

    const 対象ユーザー = await ユーザー.findById(ユーザーID);
    if (!対象ユーザー) {
      return res.status(400).json({ エラー: 'ユーザーが見つかりません' });
    }

    if (対象ユーザー.SMS認証済み) {
      return res.status(400).json({ エラー: '電話番号は既に認証済みです' });
    }

    if (!対象ユーザー.SMSコード || 対象ユーザー.SMSコード !== コード) {
      return res.status(400).json({ エラー: '認証コードが正しくありません' });
    }

    if (new Date() > 対象ユーザー.SMSコード有効期限) {
      return res.status(400).json({ エラー: '認証コードの有効期限が切れています' });
    }

    対象ユーザー.SMS認証済み = true;
    対象ユーザー.SMSコード = undefined;
    対象ユーザー.SMSコード有効期限 = undefined;
    await 対象ユーザー.save();

    const トークン = トークン生成(対象ユーザー._id);
    const リフレッシュトークン = リフレッシュトークン生成(対象ユーザー._id);

    res.json({
      メッセージ: '電話番号の認証が完了しました',
      トークン,
      リフレッシュトークン,
      登録完了: true,
      ユーザー: {
        ID: 対象ユーザー._id,
        名前: 対象ユーザー.名前,
        電話番号: 対象ユーザー.電話番号,
        性別: 対象ユーザー.性別,
        住所: 対象ユーザー.住所,
        プロフィール写真: 対象ユーザー.プロフィール写真,
        自己紹介: 対象ユーザー.自己紹介,
        位置: 対象ユーザー.位置
      }
    });
  } catch (error) {
    console.error('SMS認証エラー:', error);
    res.status(500).json({ エラー: 'SMS認証中にサーバーエラーが発生しました' });
  }
};

const ログイン = async (req, res) => {
  try {
    // const 検証エラー = validationResult(req);
    // if (!検証エラー.isEmpty()) {
    //   return res.status(400).json({ エラー一覧: 検証エラー.array() });
    // }
    const { 電話番号, 緯度, 経度 } = req.body;
    console.log(req.body);

    const 対象ユーザー = await ユーザー.findOne({ 電話番号 });

    // ユーザーが存在するか確認する
    if (!対象ユーザー) {
      console.log(`🚫 未登録の電話番号でのログイン試行: ${電話番号}`);
      return res.status(404).json({
        エラー: 'この電話番号は登録されていません。まず新規登録を行ってください。',
        エラーコード: 'USER_NOT_REGISTERED',
        提案: '新規登録ページから登録を完了してください',
        リダイレクト先: 'register'
      });
    }

    // ユーザーは存在するが SMS 未認証か確認する
    if (!対象ユーザー.SMS認証済み) {
      console.log(`🚫 未認証ユーザーでのログイン試行: ${電話番号}`);
      return res.status(400).json({
        エラー: 'この電話番号は登録されていますが、SMS認証が完了していません。',
        エラーコード: 'SMS_NOT_VERIFIED',
        提案: 'SMS認証を完了してからログインしてください',
        ユーザーID: 対象ユーザー._id,
        リダイレクト先: 'verify-sms'
      });
    }

    const SMSコード = SMSコード生成();
    const SMSコード有効期限 = new Date(Date.now() + 10 * 60 * 1000);

    対象ユーザー.SMSコード = SMSコード;
    対象ユーザー.SMSコード有効期限 = SMSコード有効期限;

    // 位置情報が提供されていれば更新する
    if (緯度 && 経度) {
      対象ユーザー.位置 = {
        type: 'Point',
        coordinates: [parseFloat(経度), parseFloat(緯度)]
      };
    }

    await 対象ユーザー.save();

    const SMS結果 = await 認証コード送信(電話番号, SMSコード);
    if (!SMS結果.成功) {
      console.error(`ログイン時の SMS 送信に失敗しました:`, SMS結果.エラー);
      // 本番環境では SMS 失敗を適切に処理する
      if (process.env.NODE_ENV === 'production') {
        // 失敗時は SMS コードをリセットする
        対象ユーザー.SMSコード = undefined;
        対象ユーザー.SMSコード有効期限 = undefined;
        await 対象ユーザー.save();
        return res.status(500).json({
          エラー: '認証コードの送信に失敗しました。電話番号を確認して再度お試しください。',
          詳細: process.env.NODE_ENV === 'development' ? SMS結果.エラー : undefined
        });
      }
      // 開発環境では SMS モックが失敗してもログインを続行する
      console.log('開発モード: SMS送信失敗でも処理を続行');
    }

    res.json({
      メッセージ: '認証コードを送信しました',
      ユーザーID: 対象ユーザー._id,
      電話番号: 対象ユーザー.電話番号,
      新規ユーザー: false,
      認証要求: true
    });
  } catch (error) {
    console.error('ログインエラー:', error);
    // 本番環境ではより具体的なエラーメッセージを提供する
    if (process.env.NODE_ENV === 'production' && error.message) {
      if (error.message.includes('Invalid phone number')) {
        return res.status(400).json({ エラー: '電話番号の形式が正しくありません。国際形式で入力してください（例：+8190XXXXXXXX）。' });
      }
      if (error.message.includes('SMS service not configured')) {
        return res.status(503).json({ エラー: 'SMS サービスが一時的に利用できません。後でもう一度お試しください。' });
      }
    }
    res.status(500).json({
      エラー: 'ログイン中にサーバーエラーが発生しました',
      詳細: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const ログイン認証 = async (req, res) => {
  try {
    const 検証エラー = validationResult(req);
    if (!検証エラー.isEmpty()) {
      return res.status(400).json({ エラー一覧: 検証エラー.array() });
    }

    const { ユーザーID, コード, 緯度, 経度 } = req.body;

    const 対象ユーザー = await ユーザー.findById(ユーザーID);
    if (!対象ユーザー || !対象ユーザー.SMS認証済み) {
      return res.status(400).json({ エラー: 'ユーザーが見つからないか認証が完了していません' });
    }

    if (!対象ユーザー.SMSコード || 対象ユーザー.SMSコード !== コード) {
      return res.status(400).json({ エラー: '認証コードが正しくありません' });
    }

    if (new Date() > 対象ユーザー.SMSコード有効期限) {
      return res.status(400).json({ エラー: '認証コードの有効期限が切れています' });
    }

    対象ユーザー.SMSコード = undefined;
    対象ユーザー.SMSコード有効期限 = undefined;
    対象ユーザー.最終接続 = new Date();

    // 位置情報が提供されていれば更新する
    if (緯度 && 経度) {
      対象ユーザー.位置 = {
        type: 'Point',
        coordinates: [parseFloat(経度), parseFloat(緯度)]
      };
    }

    await 対象ユーザー.save();

    const トークン = トークン生成(対象ユーザー._id);
    const リフレッシュトークン = リフレッシュトークン生成(対象ユーザー._id);

    res.json({
      メッセージ: 'ログインが完了しました',
      トークン,
      リフレッシュトークン,
      ログイン完了: true,
      ユーザー: {
        ID: 対象ユーザー._id,
        名前: 対象ユーザー.名前,
        電話番号: 対象ユーザー.電話番号,
        性別: 対象ユーザー.性別,
        住所: 対象ユーザー.住所,
        プロフィール写真: 対象ユーザー.プロフィール写真,
        位置: 対象ユーザー.位置,
        自己紹介: 対象ユーザー.自己紹介,
        マッチ数: 対象ユーザー.マッチ数,
        実会数: 対象ユーザー.実会数
      }
    });
  } catch (error) {
    console.error('ログイン認証エラー:', error);
    res.status(500).json({ エラー: 'ログイン認証中にサーバーエラーが発生しました' });
  }
};

const 登録検証 = [
  body('名前').trim().isLength({ min: 2, max: 50 }).withMessage('名前は2文字以上50文字以下で入力してください'),
  body('電話番号').isMobilePhone('any', { strictMode: false }).withMessage('有効な電話番号を入力してください'),
  body('性別').isIn(['male', 'female', 'other']).withMessage('性別を選択してください'),
  body('住所').trim().isLength({ min: 5, max: 200 }).withMessage('住所は5文字以上200文字以下で入力してください'),
  body('緯度').optional().isFloat({ min: -90, max: 90 }).withMessage('有効な緯度を入力してください'),
  body('経度').optional().isFloat({ min: -180, max: 180 }).withMessage('有効な経度を入力してください')
];

const SMS検証 = [
  body('ユーザーID').isMongoId().withMessage('有効なユーザーIDが必要です'),
  body('コード').isLength({ min: 6, max: 6 }).withMessage('6桁のコードを入力してください'),
  body('緯度').optional().isFloat({ min: -90, max: 90 }).withMessage('有効な緯度を入力してください'),
  body('経度').optional().isFloat({ min: -180, max: 180 }).withMessage('有効な経度を入力してください')
];

const ログイン検証 = [
  body('電話番号').isMobilePhone('any', { strictMode: false }).withMessage('有効な電話番号を入力してください'),
  body('緯度').optional().isFloat({ min: -90, max: 90 }).withMessage('有効な緯度を入力してください'),
  body('経度').optional().isFloat({ min: -180, max: 180 }).withMessage('有効な経度を入力してください')
];

// 現在のセッション/トークンを検証する
const セッション検証 = async (req, res) => {
  try {
    const トークン = req.header('Authorization')?.replace('Bearer ', '');

    if (!トークン) {
      return res.status(401).json({
        認証済み: false,
        エラー: 'トークンが提供されていません'
      });
    }

    try {
      const 復号データ = jwt.verify(トークン, process.env.JWT_SECRET);
      const 対象ユーザー = await ユーザー.findById(復号データ.ユーザーID).select('-SMSコード -SMSコード有効期限');

      if (!対象ユーザー) {
        return res.status(401).json({
          認証済み: false,
          エラー: 'ユーザーが見つかりません'
        });
      }

      if (!対象ユーザー.SMS認証済み) {
        return res.status(401).json({
          認証済み: false,
          エラー: '電話番号が認証されていません'
        });
      }

      res.json({
        認証済み: true,
        ユーザー: {
          ID: 対象ユーザー._id,
          名前: 対象ユーザー.名前,
          電話番号: 対象ユーザー.電話番号,
          性別: 対象ユーザー.性別,
          住所: 対象ユーザー.住所,
          プロフィール写真: 対象ユーザー.プロフィール写真,
          自己紹介: 対象ユーザー.自己紹介,
          マッチ数: 対象ユーザー.マッチ数,
          実会数: 対象ユーザー.実会数,
          オンライン状態: 対象ユーザー.オンライン状態,
          最終接続: 対象ユーザー.最終接続
        }
      });
    } catch (error) {
      return res.status(401).json({
        認証済み: false,
        エラー: '無効なトークンです'
      });
    }
  } catch (error) {
    console.error('セッション検証エラー:', error);
    res.status(500).json({
      認証済み: false,
      エラー: 'セッション認証中にサーバーエラーが発生しました'
    });
  }
};

// トークンによる自動ログイン
const 現在ユーザー取得 = async (req, res) => {
  try {
    const トークン = req.header('Authorization')?.replace('Bearer ', '');

    if (!トークン) {
      return res.status(401).json({ エラー: '認証が必要です' });
    }

    const 復号データ = jwt.verify(トークン, process.env.JWT_SECRET);
    const 対象ユーザー = await ユーザー.findById(復号データ.ユーザーID).select('-SMSコード -SMSコード有効期限');

    if (!対象ユーザー || !対象ユーザー.SMS認証済み) {
      return res.status(401).json({ エラー: '無効なユーザーまたは認証が完了していません' });
    }

    res.json({
      ユーザー: {
        ID: 対象ユーザー._id,
        名前: 対象ユーザー.名前,
        電話番号: 対象ユーザー.電話番号,
        性別: 対象ユーザー.性別,
        住所: 対象ユーザー.住所,
        プロフィール写真: 対象ユーザー.プロフィール写真,
        自己紹介: 対象ユーザー.自己紹介,
        マッチ数: 対象ユーザー.マッチ数,
        実会数: 対象ユーザー.実会数,
        オンライン状態: 対象ユーザー.オンライン状態,
        位置: 対象ユーザー.位置,
        最終接続: 対象ユーザー.最終接続
      }
    });
  } catch (error) {
    console.error('現在ユーザー取得エラー:', error);
    res.status(401).json({ エラー: '無効または期限切れのトークンです' });
  }
};

// トークン更新エンドポイント
const トークン更新 = async (req, res) => {
  try {
    const { リフレッシュトークン } = req.body;

    if (!リフレッシュトークン) {
      return res.status(401).json({ エラー: 'リフレッシュトークンが必要です' });
    }

    try {
      const 復号データ = jwt.verify(リフレッシュトークン, process.env.JWT_SECRET);

      if (復号データ.type !== 'refresh') {
        return res.status(401).json({ エラー: '無効なリフレッシュトークンです' });
      }

      const 対象ユーザー = await ユーザー.findById(復号データ.ユーザーID).select('-SMSコード -SMSコード有効期限');

      if (!対象ユーザー || !対象ユーザー.SMS認証済み) {
        return res.status(401).json({ エラー: 'ユーザーが見つからないか認証が完了していません' });
      }

      const 新トークン = トークン生成(対象ユーザー._id);
      const 新リフレッシュトークン = リフレッシュトークン生成(対象ユーザー._id);

      res.json({
        トークン: 新トークン,
        リフレッシュトークン: 新リフレッシュトークン,
        ユーザー: {
          ID: 対象ユーザー._id,
          名前: 対象ユーザー.名前,
          電話番号: 対象ユーザー.電話番号,
          性別: 対象ユーザー.性別,
          住所: 対象ユーザー.住所,
          プロフィール写真: 対象ユーザー.プロフィール写真,
          自己紹介: 対象ユーザー.自己紹介,
          マッチ数: 対象ユーザー.マッチ数,
          実会数: 対象ユーザー.実会数,
          オンライン状態: 対象ユーザー.オンライン状態,
          位置: 対象ユーザー.位置,
          最終接続: 対象ユーザー.最終接続
        }
      });
    } catch (error) {
      return res.status(401).json({ エラー: '無効または期限切れのリフレッシュトークンです' });
    }
  } catch (error) {
    console.error('トークン更新エラー:', error);
    res.status(500).json({ エラー: 'トークン更新中にサーバーエラーが発生しました' });
  }
};
////
module.exports = {
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
};
