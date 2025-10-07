const ユーザー = require('../models/User');

/**
 * ハバーサイン公式を用いて2点間の距離をメートル単位で計算する
 * @param {number} 緯度1 - 1点目の緯度
 * @param {number} 経度1 - 1点目の経度
 * @param {number} 緯度2 - 2点目の緯度
 * @param {number} 経度2 - 2点目の経度
 * @returns {number} メートル単位の距離
 */
const 距離計算 = (緯度1, 経度1, 緯度2, 経度2) => {
  const 地球半径 = 6371000; // 地球の半径（メートル）
  const 緯度差 = (緯度2 - 緯度1) * Math.PI / 180;
  const 経度差 = (経度2 - 経度1) * Math.PI / 180;
  const ハバーサイン =
    Math.sin(緯度差/2) * Math.sin(緯度差/2) +
    Math.cos(緯度1 * Math.PI / 180) * Math.cos(緯度2 * Math.PI / 180) *
    Math.sin(経度差/2) * Math.sin(経度差/2);
  const 中心角 = 2 * Math.atan2(Math.sqrt(ハバーサイン), Math.sqrt(1-ハバーサイン));
  return 地球半径 * 中心角;
};

/**
 * マップ表示用に位置情報付きのユーザーを取得する
 * @param {Object} 現在ユーザー - リクエスト元のユーザー
 * @param {number} 緯度 - 中心の緯度
 * @param {number} 経度 - 中心の経度
 * @param {number} 半径 - 検索半径（メートル）
 * @returns {Promise<Array>} マップデータ付きユーザーの配列
 */
const マップ用ユーザー取得 = async (現在ユーザー, 緯度, 経度, 半径 = 100000) => {
  try {
    console.log(`🗺️ ${現在ユーザー.名前} 用のマップデータを取得中`);
    console.log(`📍 中心: [${経度}, ${緯度}], 半径: ${半径}m`);

    // 近隣ユーザーを検索する
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
      },
      オンライン状態: true // マップにはオンラインのユーザーのみ表示する
    }).select('名前 性別 位置 プロフィール写真 自己紹介 オンライン状態 最終接続 マッチ数');

    // ユーザーにマップ固有のデータを付与する
    const マップユーザー = 近隣ユーザー.map(ユーザー情報 => {
      const 距離 = 距離計算(
        緯度, 経度,
        ユーザー情報.位置.coordinates[1], ユーザー情報.位置.coordinates[0]
      );

      return {
        ID: ユーザー情報._id,
        名前: ユーザー情報.名前,
        性別: ユーザー情報.性別,
        プロフィール写真: ユーザー情報.プロフィール写真 || デフォルトアバター取得(ユーザー情報.性別),
        自己紹介: ユーザー情報.自己紹介 || 'こんにちは！',
        位置: {
          緯度: ユーザー情報.位置.coordinates[1],
          経度: ユーザー情報.位置.coordinates[0]
        },
        距離: Math.round(距離),
        オンライン状態: ユーザー情報.オンライン状態,
        最終接続: ユーザー情報.最終接続,
        マッチ数: ユーザー情報.マッチ数,
        // マップマーカーのプロパティを追加する
        マーカー: {
          色: マーカー色取得(ユーザー情報.性別),
          アイコン: マーカーアイコン取得(ユーザー情報.性別),
          サイズ: ユーザー情報.オンライン状態 ? 'large' : 'medium'
        }
      };
    });

    console.log(`📊 マップ表示用に ${マップユーザー.length} 人のユーザーが見つかりました`);

    return {
      ユーザー一覧: マップユーザー,
      中心: { 緯度: parseFloat(緯度), 経度: parseFloat(経度) },
      半径: parseInt(半径),
      件数: マップユーザー.length
    };

  } catch (error) {
    console.error('マップサービスエラー:', error);
    throw error;
  }
};

/**
 * 性別に応じたデフォルトアバターを取得する
 * @param {string} 性別 - ユーザーの性別
 * @returns {string} アバターURL
 */
const デフォルトアバター取得 = (性別) => {
  const アバターマップ = {
    male: 'https://randomuser.me/api/portraits/men/0.jpg',
    female: 'https://randomuser.me/api/portraits/women/0.jpg',
    other: 'https://randomuser.me/api/portraits/lego/0.jpg'
  };
  return アバターマップ[性別] || アバターマップ.other;
};

/**
 * 性別に応じたマーカー色を取得する
 * @param {string} 性別 - ユーザーの性別
 * @returns {string} 16進数のカラーコード
 */
const マーカー色取得 = (性別) => {
  const カラーマップ = {
    male: '#4A90E2',    // 青
    female: '#E24A90',  // ピンク
    other: '#50C878'    // 緑
  };
  return カラーマップ[性別] || カラーマップ.other;
};

/**
 * 性別に応じたマーカーアイコンを取得する
 * @param {string} 性別 - ユーザーの性別
 * @returns {string} アイコン識別子
 */
const マーカーアイコン取得 = (性別) => {
  const アイコンマップ = {
    male: 'male',
    female: 'female',
    other: 'person'
  };
  return アイコンマップ[性別] || アイコンマップ.other;
};

/**
 * マップ中心表示用にユーザーの現在地を取得する
 * @param {string} ユーザーID - ユーザーID
 * @returns {Promise<Object>} ユーザーの位置
 */
const ユーザー位置取得 = async (ユーザーID) => {
  try {
    const 対象ユーザー = await ユーザー.findById(ユーザーID).select('位置 住所');

    if (!対象ユーザー || !対象ユーザー.位置 || !対象ユーザー.位置.coordinates) {
      throw new Error('User location not found');
    }

    return {
      緯度: 対象ユーザー.位置.coordinates[1],
      経度: 対象ユーザー.位置.coordinates[0],
      住所: 対象ユーザー.住所
    };
  } catch (error) {
    console.error('ユーザー位置取得エラー:', error);
    throw error;
  }
};

/**
 * マップからユーザーの位置を更新する
 * @param {string} ユーザーID - ユーザーID
 * @param {number} 緯度 - 緯度
 * @param {number} 経度 - 経度
 * @param {string} 住所 - 任意の住所
 * @returns {Promise<Object>} 更新後の位置
 */
const ユーザー位置更新 = async (ユーザーID, 緯度, 経度, 住所 = null) => {
  try {
    console.log(`📍 ユーザー ${ユーザーID} の位置を更新中: [${経度}, ${緯度}]`);

    const 更新データ = {
      位置: {
        type: 'Point',
        coordinates: [parseFloat(経度), parseFloat(緯度)]
      },
      最終接続: new Date()
    };

    if (住所) {
      更新データ.住所 = 住所;
    }

    const 対象ユーザー = await ユーザー.findByIdAndUpdate(
      ユーザーID,
      更新データ,
      { new: true }
    ).select('位置 住所 名前');

    console.log(`✅ ${対象ユーザー.名前} の位置を更新しました`);

    return {
      緯度: 対象ユーザー.位置.coordinates[1],
      経度: 対象ユーザー.位置.coordinates[0],
      住所: 対象ユーザー.住所
    };
  } catch (error) {
    console.error('ユーザー位置更新エラー:', error);
    throw error;
  }
};

module.exports = {
  マップ用ユーザー取得,
  距離計算,
  ユーザー位置取得,
  ユーザー位置更新,
  デフォルトアバター取得,
  マーカー色取得,
  マーカーアイコン取得
};
