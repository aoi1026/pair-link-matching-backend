const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const DB接続 = require('./config/database');
const 認証ルート = require('./routes/auth');
const ユーザールート = require('./routes/users');
const マッチングルート = require('./routes/matching');
const マップルート = require('./routes/map');
const ソケットハンドラー = require('./services/socketHandler');
const エラーハンドラー = require('./middleware/errorHandler');

const アプリ = express();
const サーバー = http.createServer(アプリ);
const io = socketIo(サーバー, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["*"],
    credentials: true
  }
});

// 起動時の拡張コンソールログ
console.log('\n🚀 MATCHAPP バックエンドサーバーを起動中 🚀');
console.log('══════════════════════════════════════');
console.log(`環境: ${process.env.NODE_ENV || 'development'}`);
console.log(`時刻: ${new Date().toISOString()}`);
console.log(`Node バージョン: ${process.version}`);
console.log(`プラットフォーム: ${process.platform}`);
console.log('══════════════════════════════════════\n');

// ログ出力付きでデータベースに接続する
DB接続();

アプリ.use(helmet());

// 開発用に強化した Morgan ログ
const morgan形式 = process.env.NODE_ENV === 'production'
  ? 'combined'
  : ':method :url :status :res[content-length] - :response-time ms :date[iso]';

アプリ.use(morgan(morgan形式, {
  stream: {
    write: (メッセージ) => {
      // HTTP ステータスを色分けする
      const ステータス = メッセージ.match(/(\d{3})/)?.[1];
      let 色 = '\x1b[0m'; // デフォルト
      if (ステータス) {
        if (ステータス.startsWith('2')) 色 = '\x1b[32m'; // 2xx は緑
        else if (ステータス.startsWith('3')) 色 = '\x1b[33m'; // 3xx は黄
        else if (ステータス.startsWith('4')) 色 = '\x1b[31m'; // 4xx は赤
        else if (ステータス.startsWith('5')) 色 = '\x1b[35m'; // 5xx はマゼンタ
      }
      console.log(`📡 ${色}${メッセージ.trim()}\x1b[0m`);
    }
  }
}));
アプリ.use(cors({
  origin: "*",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["*"]
}));

const レート制限 = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // 開発ではより寛容に
  message: {
    エラー: 'この IP からのリクエストが多すぎます。後でもう一度お試しください',
    リトライ後: '15分'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.error('\n🚫 レート制限超過 🚫');
    console.error('═══════════════════════════');
    console.error(`時刻: ${new Date().toISOString()}`);
    console.error(`IP: ${req.ip}`);
    console.error(`メソッド: ${req.method}`);
    console.error(`URL: ${req.originalUrl}`);
    console.error(`User-Agent: ${req.get('User-Agent')}`);
    console.error('═══════════════════════════\n');

    res.status(429).json({
      エラー: 'この IP からのリクエストが多すぎます。後でもう一度お試しください',
      リトライ後: '15分'
    });
  }
});
アプリ.use(レート制限);

// 開発用のより緩やかな SMS レート制限
const SMSレート制限 = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分のウィンドウ
  max: process.env.NODE_ENV === 'production' ? 5 : 50, // 本番では5回、開発では50回
  message: {
    エラー: 'SMS リクエストが多すぎます。後でもう一度お試しください',
    リトライ後: '15分'
  },
  standardHeaders: true, // `RateLimit-*` ヘッダーにレート制限情報を返す
  legacyHeaders: false, // `X-RateLimit-*` ヘッダーを無効にする
});

// その他の認証エンドポイント用の別レート制限（より緩やか）
const 認証レート制限 = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // 認証エンドポイントはより多くのリクエストを許可
  message: {
    エラー: '認証リクエストが多すぎます。後でもう一度お試しください',
    リトライ後: '15分'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

アプリ.use(express.json({ limit: '10mb' }));
アプリ.use(express.urlencoded({ extended: true }));

アプリ.set('io', io);

// 日本語のルートパスを照合できるよう、URLエンコードされたパスをデコードする
アプリ.use((req, res, next) => {
  try { req.url = decodeURI(req.url); } catch (e) { /* 不正なエンコードはそのまま通す */ }
  next();
});

// 認証ルートごとに異なるレート制限を適用する
アプリ.use('/api/認証', 認証レート制限, 認証ルート);
アプリ.use('/api/ユーザー', ユーザールート);
アプリ.use('/api/マッチング', マッチングルート);
アプリ.use('/api/マップ', マップルート);

アプリ.get('/api/ヘルス', (req, res) => {
  res.json({
    状態: 'OK',
    メッセージ: 'サーバーは稼働中です',
    環境: process.env.NODE_ENV || 'development',
    タイムスタンプ: new Date().toISOString()
  });
});

// 開発用のデバッグエンドポイント
if (process.env.NODE_ENV !== 'production') {
  アプリ.get('/api/デバッグ/認証フロー', (req, res) => {
    res.json({
      認証フロー: {
        登録: {
          ステップ1: 'POST /api/認証/登録 - ユーザーIDを返し、SMS認証が必要',
          ステップ2: 'POST /api/認証/SMS認証 - SMS認証後にトークンを返す'
        },
        ログイン: {
          ステップ1: 'POST /api/認証/ログイン - ユーザーIDを返し、SMS認証が必要',
          ステップ2: 'POST /api/認証/ログイン認証 - SMS認証後にトークンを返す'
        },
        備考: '登録とログインの両方で、認証トークンを取得するには SMS 認証が必要です'
      }
    });
  });

  アプリ.get('/api/デバッグ/レート制限', (req, res) => {
    res.json({
      レート制限: {
        全般: {
          windowMs: '15分',
          max: process.env.NODE_ENV === 'production' ? 100 : 1000,
          現在値: 'レスポンスの RateLimit-Remaining ヘッダーを確認してください'
        },
        認証: {
          windowMs: '15分',
          max: process.env.NODE_ENV === 'production' ? 100 : 1000,
          適用対象: 'すべての /api/認証/* ルート'
        },
        SMS: {
          windowMs: '1時間',
          max: process.env.NODE_ENV === 'production' ? 5 : 20,
          適用対象: '/api/認証/登録 と /api/認証/ログイン のみ',
          キー: 'IP + 電話番号'
        }
      },
      ヘッダー: {
        'RateLimit-Limit': '許可される最大リクエスト数',
        'RateLimit-Remaining': '現在のウィンドウで残っているリクエスト数',
        'RateLimit-Reset': 'レート制限がリセットされる時刻'
      },
      トラブルシューティング: {
        429: 'Too Many Requests - レート制限がリセットされるまで待つ',
        解決策: '一定時間待つか、開発環境ではサーバーを再起動する'
      }
    });
  });

  // ユーザー登録状態を確認するデバッグエンドポイント
  アプリ.post('/api/デバッグ/ユーザー確認', async (req, res) => {
    try {
      const { 電話番号 } = req.body;
      if (!電話番号) {
        return res.status(400).json({ エラー: '電話番号が必要です' });
      }

      const ユーザーモデル = require('./models/User');
      const 対象ユーザー = await ユーザーモデル.findOne({ 電話番号 }).select('-SMSコード -SMSコード有効期限');

      if (!対象ユーザー) {
        return res.json({
          存在: false,
          状態: 'NOT_REGISTERED',
          メッセージ: 'ユーザーはデータベースに存在しません',
          アクション: 'ユーザーはまず登録する必要があります'
        });
      }

      res.json({
        存在: true,
        状態: 対象ユーザー.SMS認証済み ? 'FULLY_REGISTERED' : 'PENDING_SMS_VERIFICATION',
        ユーザー: {
          ID: 対象ユーザー._id,
          名前: 対象ユーザー.名前,
          電話番号: 対象ユーザー.電話番号,
          SMS認証済み: 対象ユーザー.SMS認証済み,
          作成日時: 対象ユーザー.createdAt
        },
        アクション: 対象ユーザー.SMS認証済み ? '通常どおりログインできます' : 'SMS認証を完了する必要があります'
      });
    } catch (error) {
      console.error('デバッグ用ユーザー確認エラー:', error);
      res.status(500).json({ エラー: 'ユーザー確認中にサーバーエラーが発生しました' });
    }
  });
}

// エラーハンドリングミドルウェアを追加する（必ず最後に置く）
アプリ.use(エラーハンドラー);

ソケットハンドラー(io);

const ポート = process.env.PORT || 5000;
サーバー.listen(ポート, () => {
  console.log('\n✅ サーバーの起動に成功しました ✅');
  console.log('═══════════════════════════════');
  console.log(`🌐 サーバーはポート ${ポート} で稼働中`);
  console.log(`📍 ローカル URL: http://localhost:${ポート}`);
  console.log(`🔍 ヘルスチェック: http://localhost:${ポート}/api/ヘルス`);
  console.log(`📊 デバッグ情報: http://localhost:${ポート}/api/デバッグ/認証フロー`);
  console.log(`⏰ 起動時刻: ${new Date().toLocaleString()}`);
  console.log('═══════════════════════════════\n');

  console.log('📋 利用可能な API ルート:');
  console.log('  認証:');
  console.log('    POST /api/認証/登録');
  console.log('    POST /api/認証/SMS認証');
  console.log('    POST /api/認証/ログイン');
  console.log('    POST /api/認証/ログイン認証');
  console.log('    GET  /api/認証/セッション検証');
  console.log('    GET  /api/認証/現在ユーザー');
  console.log('    POST /api/認証/トークン更新');
  console.log('  ユーザー:');
  console.log('    GET  /api/ユーザー/近隣');
  console.log('    GET  /api/ユーザー/全件');
  console.log('    POST /api/ユーザー/位置更新');
  console.log('    GET  /api/ユーザー/プロフィール/:id');
  console.log('    PUT  /api/ユーザー/プロフィール');
  console.log('    POST /api/ユーザー/状態');
  console.log('  マッチング:');
  console.log('    POST /api/マッチング/リクエスト');
  console.log('    POST /api/マッチング/応答');
  console.log('    GET  /api/マッチング/履歴');
  console.log('    POST /api/マッチング/ミーティング確認');
  console.log('  マップ:');
  console.log('    GET  /api/マップ/設定');
  console.log('    GET  /api/マップ/データ');
  console.log('    GET  /api/マップ/現在地');
  console.log('    POST /api/マップ/現在地');
  console.log('\n🎯 リクエストを受け付ける準備ができました！\n');
});
