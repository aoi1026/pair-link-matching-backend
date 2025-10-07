const { body, query, validationResult } = require('express-validator');
const ユーザー = require('../models/User');

const 近隣ユーザー取得 = async (req, res) => {
  try {
    const 検証エラー = validationResult(req);

    console.log(検証エラー, 検証エラー.isEmpty());


    if (!検証エラー.isEmpty()) {
      console.log('バリデーションエラー:', 検証エラー.array());
      return res.status(400).json({ エラー一覧: 検証エラー.array() });
    }
    const { 緯度, 経度, 半径 = 100000 } = req.query;

    const 現在ユーザー = req.認証ユーザー;

    console.log(`座標 [${経度}, ${緯度}] から ${半径}m 以内のユーザーをユーザー ${現在ユーザー._id} のために検索中`);

    const 近隣ユーザー = await ユーザー.find({
      _id: { $ne: 現在ユーザー._id },
      位置: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(経度), parseFloat(緯度)]
          },
          $maxDistance: parseInt(半径)
        }
      }
    }).select('-SMSコード -SMSコード有効期限');

    console.log(`半径 ${半径}m 以内に ${近隣ユーザー.length} 人のユーザーが見つかりました`);

    // デバッグ用に先頭数件のユーザーをログ出力する
    近隣ユーザー.slice(0, 3).forEach((対象ユーザー, 番号) => {
      console.log(`ユーザー ${番号 + 1}: ${対象ユーザー.名前} 位置 [${対象ユーザー.位置?.coordinates}]`);
    });
    res.json({
      ユーザー一覧: 近隣ユーザー,
      件数: 近隣ユーザー.length
    });
  } catch (error) {
    console.error('近隣ユーザー取得エラー:', error);
    res.status(500).json({ エラー: '近くのユーザーの取得中にサーバーエラーが発生しました' });
  }
};

const 位置更新 = async (req, res) => {
  try {
    const 検証エラー = validationResult(req);
    if (!検証エラー.isEmpty()) {
      return res.status(400).json({ エラー一覧: 検証エラー.array() });
    }

    const { 緯度, 経度 } = req.body;
    const ユーザーID = req.認証ユーザー._id;

    const 対象ユーザー = await ユーザー.findByIdAndUpdate(
      ユーザーID,
      {
        位置: {
          type: 'Point',
          coordinates: [経度, 緯度]
        },
        最終接続: new Date(),
        オンライン状態: true
      },
      { new: true }
    ).select('-SMSコード -SMSコード有効期限');

    req.app.get('io').emit('ユーザー位置更新', {
      ユーザーID: 対象ユーザー._id,
      位置: 対象ユーザー.位置,
      オンライン状態: 対象ユーザー.オンライン状態
    });

    res.json({
      メッセージ: '位置情報を更新しました',
      位置: 対象ユーザー.位置
    });
  } catch (error) {
    console.error('位置更新エラー:', error);
    res.status(500).json({ エラー: '位置情報の更新中にサーバーエラーが発生しました' });
  }
};

const ユーザープロフィール取得 = async (req, res) => {
  try {
    const { id } = req.params;

    const 対象ユーザー = await ユーザー.findById(id).select('-SMSコード -SMSコード有効期限 -電話番号');

    if (!対象ユーザー) {
      return res.status(404).json({ エラー: 'ユーザーが見つかりません' });
    }

    res.json({ ユーザー: 対象ユーザー });
  } catch (error) {
    console.error('ユーザープロフィール取得エラー:', error);
    res.status(500).json({ エラー: 'ユーザープロフィールの取得中にサーバーエラーが発生しました' });
  }
};

const プロフィール更新 = async (req, res) => {
  try {
    // const 検証エラー = validationResult(req);
    // if (!検証エラー.isEmpty()) {
    //   return res.status(400).json({ エラー一覧: 検証エラー.array() });
    // }

    const { 名前, 自己紹介, プロフィール写真, 住所 } = req.body;
    const ユーザーID = req.body.ユーザーID;
    console.log('ユーザーID=========', ユーザーID);

    const 更新データ = {};
    if (名前) 更新データ.名前 = 名前;
    if (自己紹介 !== undefined) 更新データ.自己紹介 = 自己紹介;
    if (プロフィール写真) 更新データ.プロフィール写真 = プロフィール写真;
    if (住所) 更新データ.住所 = 住所;

    const 対象ユーザー = await ユーザー.findByIdAndUpdate(
      ユーザーID,
      更新データ,
      { new: true }
    ).select('-SMSコード -SMSコード有効期限');

    res.json({
      メッセージ: 'プロフィールを更新しました',
      ユーザー: 対象ユーザー
    });
  } catch (error) {
    console.error('プロフィール更新エラー:', error);
    res.status(500).json({ エラー: 'プロフィールの更新中にサーバーエラーが発生しました' });
  }
};

const オンライン状態設定 = async (req, res) => {
  try {
    const { オンライン状態 } = req.body;
    const ユーザーID = req.認証ユーザー._id;

    const 対象ユーザー = await ユーザー.findByIdAndUpdate(
      ユーザーID,
      {
        オンライン状態,
        最終接続: new Date(),
        ...(オンライン状態 ? {} : { ソケットID: null })
      },
      { new: true }
    ).select('-SMSコード -SMSコード有効期限');

    req.app.get('io').emit('ユーザー状態更新', {
      ユーザーID: 対象ユーザー._id,
      オンライン状態: 対象ユーザー.オンライン状態,
      最終接続: 対象ユーザー.最終接続
    });

    res.json({
      メッセージ: 'ステータスを更新しました',
      オンライン状態: 対象ユーザー.オンライン状態
    });
  } catch (error) {
    console.error('オンライン状態設定エラー:', error);
    res.status(500).json({ エラー: 'ステータスの更新中にサーバーエラーが発生しました' });
  }
};

const 全ユーザー取得 = async (req, res) => {
  try {
    const ユーザー一覧 = await ユーザー.find({})
      .select('名前 性別 位置 電話番号 オンライン状態 プロフィール写真 自己紹介 住所 マッチ数 実会数 最終接続')
      .sort({ createdAt: -1 });

    res.json({
      ユーザー一覧,
      件数: ユーザー一覧.length
    });
  } catch (error) {
    console.error('全ユーザー取得エラー:', error);
    res.status(500).json({ エラー: 'ユーザー一覧の取得中にサーバーエラーが発生しました' });
  }
};

const 近隣ユーザー検証 = [
  query('緯度').isFloat({ min: -90, max: 90 }).withMessage('有効な緯度が必要です'),
  query('経度').isFloat({ min: -180, max: 180 }).withMessage('有効な経度が必要です'),
  query('半径').optional().isInt({ min: 100, max: 200000 }).withMessage('半径は100メートルから200,000メートルの範囲で入力してください')
];

const 位置検証 = [
  body('緯度').isFloat({ min: -90, max: 90 }).withMessage('有効な緯度が必要です'),
  body('経度').isFloat({ min: -180, max: 180 }).withMessage('有効な経度が必要です')
];

const プロフィール検証 = [
  body('名前').optional().trim().isLength({ min: 2, max: 50 }).withMessage('名前は2文字以上50文字以下で入力してください'),
  body('自己紹介').optional().isLength({ max: 500 }).withMessage('自己紹介は500文字以下で入力してください'),
  body('プロフィール写真').optional().isURL().withMessage('有効な写真URLを入力してください'),
  body('住所').optional().trim().isLength({ min: 5, max: 200 }).withMessage('住所は5文字以上200文字以下で入力してください')
];

module.exports = {
  近隣ユーザー取得,
  位置更新,
  ユーザープロフィール取得,
  プロフィール更新,
  オンライン状態設定,
  全ユーザー取得,
  近隣ユーザー検証,
  位置検証,
  プロフィール検証
};
