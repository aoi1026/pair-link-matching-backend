const { validationResult, query, body } = require('express-validator');
const { マップ用ユーザー取得, ユーザー位置取得, ユーザー位置更新 } = require('../services/mapService');

/**
 * 近隣ユーザーを含むマップデータを取得する
 */
const マップデータ取得 = async (req, res) => {
  try {
    const 検証エラー = validationResult(req);
    if (!検証エラー.isEmpty()) {
      return res.status(400).json({ エラー一覧: 検証エラー.array() });
    }

    const { 緯度, 経度, 半径 = 50000 } = req.query; // デフォルトは半径50km
    const 現在ユーザー = req.認証ユーザー;

    console.log(`🗺️ ${現在ユーザー.名前} からマップデータがリクエストされました`);

    const マップデータ = await マップ用ユーザー取得(現在ユーザー, 緯度, 経度, 半径);

    res.json({
      成功: true,
      データ: マップデータ,
      メッセージ: `${マップデータ.件数}人のユーザーが見つかりました`
    });

  } catch (error) {
    console.error('マップデータ取得エラー:', error);
    res.status(500).json({
      成功: false,
      エラー: 'マップデータの取得でエラーが発生しました'
    });
  }
};

/**
 * マップ中心表示用に現在ユーザーの位置を取得する
 */
const 現在地取得 = async (req, res) => {
  try {
    const ユーザーID = req.認証ユーザー._id;

    console.log(`📍 ユーザー ${ユーザーID} の現在地がリクエストされました`);

    const 位置 = await ユーザー位置取得(ユーザーID);

    res.json({
      成功: true,
      位置,
      メッセージ: '現在地を取得しました'
    });

  } catch (error) {
    console.error('現在地取得エラー:', error);
    res.status(500).json({
      成功: false,
      エラー: '現在地の取得でエラーが発生しました',
      フォールバック: {
        緯度: 35.6762, // フォールバックとしての東京の座標
        経度: 139.6503,
        住所: '東京, 日本'
      }
    });
  }
};

/**
 * マップからユーザーの位置を更新する
 */
const マップ位置更新 = async (req, res) => {
  try {
    const 検証エラー = validationResult(req);
    if (!検証エラー.isEmpty()) {
      return res.status(400).json({ エラー一覧: 検証エラー.array() });
    }

    const { 緯度, 経度, 住所 } = req.body;
    const ユーザーID = req.認証ユーザー._id;

    console.log(`📍 ユーザー ${ユーザーID} のマップからの位置更新`);

    const 更新後位置 = await ユーザー位置更新(ユーザーID, 緯度, 経度, 住所);

    // 接続中のソケットに位置更新をブロードキャストする
    const io = req.app.get('io');
    if (io) {
      io.emit('ユーザー位置更新', {
        ユーザーID,
        位置: {
          緯度: 更新後位置.緯度,
          経度: 更新後位置.経度
        },
        タイムスタンプ: new Date()
      });
    }

    res.json({
      成功: true,
      位置: 更新後位置,
      メッセージ: '位置情報を更新しました'
    });

  } catch (error) {
    console.error('マップ位置更新エラー:', error);
    res.status(500).json({
      成功: false,
      エラー: '位置情報の更新でエラーが発生しました'
    });
  }
};

/**
 * マップの構成と設定を取得する
 */
const マップ設定取得 = async (req, res) => {
  try {
    const 設定 = {
      デフォルト中心: {
        緯度: 35.6762, // 東京
        経度: 139.6503
      },
      デフォルトズーム: 12,
      最大半径: 200000, // 最大検索半径 200km
      最小半径: 1000,   // 最小検索半径 1km
      マーカースタイル: {
        male: {
          色: '#4A90E2',
          アイコン: '👨',
          サイズ: 'medium'
        },
        female: {
          色: '#E24A90',
          アイコン: '👩',
          サイズ: 'medium'
        },
        other: {
          色: '#50C878',
          アイコン: '🧑',
          サイズ: 'medium'
        }
      },
      マップ設定: {
        交通表示: false,
        交通機関表示: false,
        クラスタリング有効: true,
        クラスタ半径: 50,
        最大クラスタ半径: 100
      },
      半径オプション: [
        { ラベル: '1km', 値: 1000 },
        { ラベル: '5km', 値: 5000 },
        { ラベル: '10km', 値: 10000 },
        { ラベル: '25km', 値: 25000 },
        { ラベル: '50km', 値: 50000 },
        { ラベル: '100km', 値: 100000 }
      ]
    };

    res.json({
      成功: true,
      設定,
      メッセージ: 'マップ設定を取得しました'
    });

  } catch (error) {
    console.error('マップ設定取得エラー:', error);
    res.status(500).json({
      成功: false,
      エラー: 'マップ設定の取得でエラーが発生しました'
    });
  }
};

// バリデーションミドルウェア
const マップデータ検証 = [
  query('緯度').isFloat({ min: -90, max: 90 }).withMessage('有効な緯度が必要です'),
  query('経度').isFloat({ min: -180, max: 180 }).withMessage('有効な経度が必要です'),
  query('半径').optional().isInt({ min: 1000, max: 200000 }).withMessage('半径は1000m〜200000mの範囲で入力してください')
];

const 位置更新検証 = [
  body('緯度').isFloat({ min: -90, max: 90 }).withMessage('有効な緯度が必要です'),
  body('経度').isFloat({ min: -180, max: 180 }).withMessage('有効な経度が必要です'),
  body('住所').optional().isString().isLength({ max: 255 }).withMessage('住所は255文字以下で入力してください')
];

module.exports = {
  マップデータ取得,
  現在地取得,
  マップ位置更新,
  マップ設定取得,
  マップデータ検証,
  位置更新検証
};
