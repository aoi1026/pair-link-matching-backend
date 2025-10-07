const mongoose = require('mongoose');
const ユーザー = require('../models/User');
require('dotenv').config();

// MongoDB に接続する
const DB接続 = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/matching-app', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('シード用に MongoDB へ接続しました');
  } catch (error) {
    console.error('MongoDB 接続エラー:', error);
    process.exit(1);
  }
};

// 指定半径内のランダムな座標を生成する関数
const ランダム位置生成 = (中心緯度, 中心経度, 半径km) => {
  // 半径をキロメートルから度に変換する
  const 半径度 = 半径km / 111.32;

  // ランダムな角度と距離を生成する
  const u = Math.random();
  const v = Math.random();
  const w = 半径度 * Math.sqrt(u);
  const t = 2 * Math.PI * v;

  // オフセットを計算する
  const x = w * Math.cos(t);
  const y = w * Math.sin(t);

  // 緯度のスケーリングを調整する
  const 新緯度 = 中心緯度 + y;
  const 新経度 = 中心経度 + (x / Math.cos(中心緯度 * Math.PI / 180));

  return {
    緯度: 新緯度,
    経度: 新経度
  };
};

// テストユーザーのデータ
const テストユーザー作成 = (中心緯度, 中心経度) => {
  const テストユーザー一覧 = [
    {
      名前: 'Emma Johnson',
      電話番号: '+1234567891',
      性別: 'female',
      住所: '123 Park Street, Downtown',
      自己紹介: 'Love hiking and outdoor adventures. Looking for someone to explore the city with!',
      プロフィール写真: 'https://randomuser.me/api/portraits/women/1.jpg',
      オンライン状態: true,
      マッチ数: 15,
      実会数: 3,
      SMS認証済み: true
    },
    {
      名前: 'Michael Chen',
      電話番号: '+1234567892',
      性別: 'male',
      住所: '456 Main Avenue, Riverside',
      自己紹介: 'Coffee enthusiast and bookworm. Let\'s grab a latte and discuss our favorite novels!',
      プロフィール写真: 'https://randomuser.me/api/portraits/men/2.jpg',
      オンライン状態: true,
      マッチ数: 8,
      実会数: 2,
      SMS認証済み: true
    },
    {
      名前: 'Sophie Martinez',
      電話番号: '+1234567893',
      性別: 'female',
      住所: '789 Oak Boulevard, Westside',
      自己紹介: 'Yoga instructor and foodie. Always up for trying new restaurants!',
      プロフィール写真: 'https://randomuser.me/api/portraits/women/3.jpg',
      オンライン状態: false,
      マッチ数: 22,
      実会数: 5,
      SMS認証済み: true,
      最終接続: new Date(Date.now() - 3600000) // 1時間前
    },
    {
      名前: 'David Wilson',
      電話番号: '+1234567894',
      性別: 'male',
      住所: '321 Elm Street, North District',
      自己紹介: 'Musician and artist. Looking for someone who appreciates creativity and good music.',
      プロフィール写真: 'https://randomuser.me/api/portraits/men/4.jpg',
      オンライン状態: true,
      マッチ数: 12,
      実会数: 4,
      SMS認証済み: true
    },
    {
      名前: 'Olivia Thompson',
      電話番号: '+1234567895',
      性別: 'female',
      住所: '654 Pine Road, East End',
      自己紹介: 'Travel blogger and photographer. Let\'s capture some memories together!',
      プロフィール写真: 'https://randomuser.me/api/portraits/women/5.jpg',
      オンライン状態: false,
      マッチ数: 30,
      実会数: 7,
      SMS認証済み: true,
      最終接続: new Date(Date.now() - 7200000) // 2時間前
    }
  ];

  // 半径10km以内にランダムな位置を付与する
  return テストユーザー一覧.map(ユーザー情報 => {
    const 位置 = ランダム位置生成(中心緯度, 中心経度, 8); // 8km以内
    return {
      ...ユーザー情報,
      位置: {
        type: 'Point',
        coordinates: [位置.経度, 位置.緯度]
      }
    };
  });
};

const ユーザー投入 = async () => {
  try {
    await DB接続();

    // デフォルトの中心位置（実際の位置に変更できます）
    // サンプルの位置を使用 - 実際の位置に座標を更新してください
    const 中心緯度 = 40.7128; // 例: ニューヨーク市の緯度
    const 中心経度 = -74.0060; // 例: ニューヨーク市の経度

    console.log(`位置 ${中心緯度}, ${中心経度} 周辺にテストユーザーを作成中`);

    // 既存のテストユーザーを削除する
    await ユーザー.deleteMany({
      電話番号: { $in: ['+1234567891', '+1234567892', '+1234567893', '+1234567894', '+1234567895'] }
    });
    console.log('既存のテストユーザーを削除しました');

    // 新しいテストユーザーを作成する
    const テストユーザー一覧 = テストユーザー作成(中心緯度, 中心経度);

    for (const テストユーザー of テストユーザー一覧) {
      const 対象ユーザー = new ユーザー(テストユーザー);
      await 対象ユーザー.save();
      console.log(`ユーザーを作成しました: ${対象ユーザー.名前} 位置 ${対象ユーザー.位置.coordinates}`);
    }

    console.log('テストユーザーの作成に成功しました！');

    // 全ユーザーを表示する
    const 全ユーザー = await ユーザー.find({}).select('名前 位置 オンライン状態');
    console.log('\nデータベース内の全ユーザー:');
    全ユーザー.forEach(対象ユーザー => {
      console.log(`- ${対象ユーザー.名前}: ${対象ユーザー.位置.coordinates} (${対象ユーザー.オンライン状態 ? 'オンライン' : 'オフライン'})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('ユーザーのシード中にエラーが発生しました:', error);
    process.exit(1);
  }
};

// シード関数を実行する
ユーザー投入();
