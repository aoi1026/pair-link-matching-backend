const mongoose = require('mongoose');
const ユーザー = require('../models/User');
require('dotenv').config();

// リアルなテスト用の東京エリアの座標
const 東京中心 = { 緯度: 35.6762, 経度: 139.6503 };

const マップユーザー一覧 = [
  {
    名前: "田中太郎",
    電話番号: "+81901234567",
    性別: "male",
    住所: "東京都渋谷区",
    位置: {
      type: 'Point',
      coordinates: [139.6503, 35.6762] // 渋谷
    },
    プロフィール写真: "https://randomuser.me/api/portraits/men/1.jpg",
    自己紹介: "こんにちは！映画と読書が好きです。",
    SMS認証済み: true,
    オンライン状態: true,
    マッチ数: 3,
    実会数: 1
  },
  {
    名前: "佐藤花子",
    電話番号: "+81901234568",
    性別: "female",
    住所: "東京都新宿区",
    位置: {
      type: 'Point',
      coordinates: [139.7036, 35.6938] // 新宿
    },
    プロフィール写真: "https://randomuser.me/api/portraits/women/1.jpg",
    自己紹介: "カフェ巡りとヨガが趣味です♪",
    SMS認証済み: true,
    オンライン状態: true,
    マッチ数: 5,
    実会数: 2
  },
  {
    名前: "鈴木一郎",
    電話番号: "+81901234569",
    性別: "male",
    住所: "東京都港区",
    位置: {
      type: 'Point',
      coordinates: [139.7525, 35.6654] // 六本木
    },
    プロフィール写真: "https://randomuser.me/api/portraits/men/2.jpg",
    自己紹介: "IT関係の仕事をしています。よろしくお願いします！",
    SMS認証済み: true,
    オンライン状態: false,
    マッチ数: 2,
    実会数: 0,
    最終接続: new Date(Date.now() - 1000 * 60 * 30) // 30分前
  },
  {
    名前: "高橋美咲",
    電話番号: "+81901234570",
    性別: "female",
    住所: "東京都品川区",
    位置: {
      type: 'Point',
      coordinates: [139.7281, 35.6284] // 品川
    },
    プロフィール写真: "https://randomuser.me/api/portraits/women/2.jpg",
    自己紹介: "料理と旅行が大好きです！",
    SMS認証済み: true,
    オンライン状態: true,
    マッチ数: 7,
    実会数: 3
  },
  {
    名前: "伊藤健太",
    電話番号: "+81901234571",
    性別: "male",
    住所: "東京都台東区",
    位置: {
      type: 'Point',
      coordinates: [139.7786, 35.7123] // 上野
    },
    プロフィール写真: "https://randomuser.me/api/portraits/men/3.jpg",
    自己紹介: "スポーツ全般好きです。一緒に運動しませんか？",
    SMS認証済み: true,
    オンライン状態: true,
    マッチ数: 4,
    実会数: 2
  },
  {
    名前: "山田由美",
    電話番号: "+81901234572",
    性別: "female",
    住所: "東京都文京区",
    位置: {
      type: 'Point',
      coordinates: [139.7513, 35.7089] // 文京
    },
    プロフィール写真: "https://randomuser.me/api/portraits/women/3.jpg",
    自己紹介: "アートと音楽が好きな会社員です。",
    SMS認証済み: true,
    オンライン状態: false,
    マッチ数: 6,
    実会数: 1,
    最終接続: new Date(Date.now() - 1000 * 60 * 60 * 2) // 2時間前
  },
  {
    名前: "中村雄大",
    電話番号: "+81901234573",
    性別: "male",
    住所: "東京都目黒区",
    位置: {
      type: 'Point',
      coordinates: [139.6983, 35.6333] // 目黒
    },
    プロフィール写真: "https://randomuser.me/api/portraits/men/4.jpg",
    自己紹介: "ゲームとアニメが趣味です！同じ趣味の人と話したいです。",
    SMS認証済み: true,
    オンライン状態: true,
    マッチ数: 1,
    実会数: 0
  },
  {
    名前: "小林さくら",
    電話番号: "+81901234574",
    性別: "female",
    住所: "東京都世田谷区",
    位置: {
      type: 'Point',
      coordinates: [139.6503, 35.6464] // 世田谷
    },
    プロフィール写真: "https://randomuser.me/api/portraits/women/4.jpg",
    自己紹介: "犬と散歩するのが日課です🐕",
    SMS認証済み: true,
    オンライン状態: true,
    マッチ数: 8,
    実会数: 4
  },
  {
    名前: "加藤翔太",
    電話番号: "+81901234575",
    性別: "male",
    住所: "東京都江戸川区",
    位置: {
      type: 'Point',
      coordinates: [139.8686, 35.7068] // 江戸川
    },
    プロフィール写真: "https://randomuser.me/api/portraits/men/5.jpg",
    自己紹介: "釣りとキャンプが趣味のアウトドア派です！",
    SMS認証済み: true,
    オンライン状態: false,
    マッチ数: 3,
    実会数: 1,
    最終接続: new Date(Date.now() - 1000 * 60 * 15) // 15分前
  },
  {
    名前: "松本あい",
    電話番号: "+81901234576",
    性別: "female",
    住所: "東京都杉並区",
    位置: {
      type: 'Point',
      coordinates: [139.6365, 35.7003] // 杉並
    },
    プロフィール写真: "https://randomuser.me/api/portraits/women/5.jpg",
    自己紹介: "カラオケとダンスが好きです♪",
    SMS認証済み: true,
    オンライン状態: true,
    マッチ数: 9,
    実会数: 5
  }
];

const マップユーザー投入 = async () => {
  try {
    console.log('🗺️ マップユーザーのシードを開始...');

    // データベースに接続する
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/matching-app');
    console.log('💾 データベースに接続しました');

    // 既存のマップテストユーザーを削除する
    await ユーザー.deleteMany({
      電話番号: { $regex: /^\+81901234/ }
    });
    console.log('🗑️ 既存のマップテストユーザーを削除しました');

    // 新しいマップユーザーを挿入する
    const 投入ユーザー = await ユーザー.insertMany(マップユーザー一覧);
    console.log(`✅ ${投入ユーザー.length} 件のマップテストユーザーを挿入しました`);

    // 検証用にユーザーの位置をログ出力する
    console.log('\n📍 ユーザーの位置:');
    投入ユーザー.forEach((対象ユーザー, 番号) => {
      const [経度, 緯度] = 対象ユーザー.位置.coordinates;
      console.log(`${番号 + 1}. ${対象ユーザー.名前}: [${経度}, ${緯度}] - ${対象ユーザー.住所}`);
    });

    console.log('\n🎯 マップのシードが正常に完了しました！');
    console.log('これらのユーザーでマップ機能をテストできます。');
    console.log('\nテスト用 API エンドポイント:');
    console.log('- GET /api/マップ/設定');
    console.log('- GET /api/マップ/データ?緯度=35.6762&経度=139.6503&半径=50000');
    console.log('- GET /api/マップ/現在地 (認証が必要)');
    console.log('- POST /api/マップ/現在地 (認証が必要)');

  } catch (error) {
    console.error('❌ マップシードエラー:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 データベースから切断しました');
    process.exit(0);
  }
};

// 直接呼び出された場合に実行する
if (require.main === module) {
  マップユーザー投入();
}

module.exports = { マップユーザー投入, マップユーザー一覧 };
