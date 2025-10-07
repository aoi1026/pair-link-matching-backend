const { body, validationResult } = require('express-validator');
const マッチ = require('../models/Match');
const ミーティング = require('../models/Meeting');
const ユーザー = require('../models/User');

const 中間地点計算 = (緯度1, 経度1, 緯度2, 経度2) => {
  const 緯度1ラジアン = 緯度1 * Math.PI / 180;
  const 緯度2ラジアン = 緯度2 * Math.PI / 180;
  const 経度1ラジアン = 経度1 * Math.PI / 180;
  const 経度2ラジアン = 経度2 * Math.PI / 180;

  const 経度差 = 経度2ラジアン - 経度1ラジアン;

  const bX = Math.cos(緯度2ラジアン) * Math.cos(経度差);
  const bY = Math.cos(緯度2ラジアン) * Math.sin(経度差);

  const 中間緯度ラジアン = Math.atan2(
    Math.sin(緯度1ラジアン) + Math.sin(緯度2ラジアン),
    Math.sqrt((Math.cos(緯度1ラジアン) + bX) * (Math.cos(緯度1ラジアン) + bX) + bY * bY)
  );

  const 中間経度ラジアン = 経度1ラジアン + Math.atan2(bY, Math.cos(緯度1ラジアン) + bX);

  return {
    緯度: 中間緯度ラジアン * 180 / Math.PI,
    経度: 中間経度ラジアン * 180 / Math.PI
  };
};

const マッチリクエスト送信 = async (req, res) => {
  try {
    const 検証エラー = validationResult(req);
    if (!検証エラー.isEmpty()) {
      return res.status(400).json({ エラー一覧: 検証エラー.array() });
    }

    const { 対象ユーザーID, 会う理由 } = req.body;
    const リクエスト者ID = req.認証ユーザー._id;
    const 対象相手 = await ユーザー.findById(対象ユーザーID);
    console.log('対象相手========', 対象相手, "リクエスト者=======", req.認証ユーザー);

    if (!対象相手 || !対象相手.オンライン状態) {
      return res.status(404).json({ エラー: '対象ユーザーが見つからないかオフラインです' });
    }

    const 既存マッチ = await マッチ.findOne({
      $or: [
        { リクエスト者ID, 対象ユーザーID, ステータス: 'pending' },
        { リクエスト者ID: 対象ユーザーID, 対象ユーザーID: リクエスト者ID, ステータス: 'pending' }
      ]
    });
    console.log('既存', 既存マッチ);

    if (既存マッチ) {
      return res.status(400).json({ エラー: 'マッチングリクエストは既に存在します' });
    }

    const リクエスト者 = req.認証ユーザー;
    const 中間地点 = 中間地点計算(
      リクエスト者.位置.coordinates[1],
      リクエスト者.位置.coordinates[0],
      対象相手.位置.coordinates[1],
      対象相手.位置.coordinates[0]
    );

    const 対象マッチ = new マッチ({
      リクエスト者ID,
      対象ユーザーID,
      会う理由,
      待ち合わせ地点: {
        type: 'Point',
        coordinates: [中間地点.経度, 中間地点.緯度]
      }
    });

    await 対象マッチ.save();
    // await 対象マッチ.populate(['リクエスト者ID', '対象ユーザーID'], '-SMSコード -SMSコード有効期限');

    req.app.get('io').to(対象相手.ソケットID).emit('新規マッチリクエスト', {
      マッチID: 対象マッチ._id,
      リクエスト者: {
        ID: リクエスト者._id,
        名前: リクエスト者.名前,
        プロフィール写真: リクエスト者.プロフィール写真,
        自己紹介: リクエスト者.自己紹介
      },
      会う理由: 対象マッチ.会う理由,
      待ち合わせ地点: 対象マッチ.待ち合わせ地点
    });

    res.status(201).json({
      メッセージ: 'マッチングリクエストを送信しました',
      マッチ: 対象マッチ
    });
  } catch (error) {
    console.error('マッチリクエスト送信エラー:', error);
    res.status(500).json({ エラー: 'マッチングリクエストの送信中にサーバーエラーが発生しました' });
  }
};

const マッチ応答 = async (req, res) => {
  try {
    const 検証エラー = validationResult(req);
    if (!検証エラー.isEmpty()) {
      return res.status(400).json({ エラー一覧: 検証エラー.array() });
    }

    const { マッチID, 応答 } = req.body;
    const ユーザーID = req.認証ユーザー._id;

    const 対象マッチ = await マッチ.findById(マッチID).populate(['リクエスト者ID', '対象ユーザーID'], '-SMSコード -SMSコード有効期限');

    if (!対象マッチ) {
      return res.status(404).json({ エラー: 'マッチが見つかりません' });
    }

    if (対象マッチ.対象ユーザーID._id.toString() !== ユーザーID.toString()) {
      return res.status(403).json({ エラー: 'このマッチに応答する権限がありません' });
    }

    if (対象マッチ.ステータス !== 'pending') {
      return res.status(400).json({ エラー: 'マッチは既に応答済みです' });
    }

    対象マッチ.ステータス = 応答;
    await 対象マッチ.save();

    if (応答 === 'accepted') {
      await ユーザー.findByIdAndUpdate(対象マッチ.リクエスト者ID._id, { $inc: { マッチ数: 1 } });
      await ユーザー.findByIdAndUpdate(対象マッチ.対象ユーザーID._id, { $inc: { マッチ数: 1 } });

      const 対象ミーティング = new ミーティング({
        マッチID: 対象マッチ._id,
        予定時刻: new Date(Date.now() + 30 * 60 * 1000)
      });
      await 対象ミーティング.save();

      req.app.get('io').to(対象マッチ.リクエスト者ID.ソケットID).emit('マッチ承認', {
        マッチID: 対象マッチ._id,
        対象ユーザー: {
          ID: 対象マッチ.対象ユーザーID._id,
          名前: 対象マッチ.対象ユーザーID.名前,
          プロフィール写真: 対象マッチ.対象ユーザーID.プロフィール写真
        },
        待ち合わせ地点: 対象マッチ.待ち合わせ地点,
        ミーティングID: 対象ミーティング._id,
        予定時刻: 対象ミーティング.予定時刻
      });

      req.app.get('io').to(対象マッチ.対象ユーザーID.ソケットID).emit('マッチ確定', {
        マッチID: 対象マッチ._id,
        リクエスト者: {
          ID: 対象マッチ.リクエスト者ID._id,
          名前: 対象マッチ.リクエスト者ID.名前,
          プロフィール写真: 対象マッチ.リクエスト者ID.プロフィール写真
        },
        待ち合わせ地点: 対象マッチ.待ち合わせ地点,
        ミーティングID: 対象ミーティング._id,
        予定時刻: 対象ミーティング.予定時刻
      });
    } else {
      req.app.get('io').to(対象マッチ.リクエスト者ID.ソケットID).emit('マッチ拒否', {
        マッチID: 対象マッチ._id,
        対象ユーザーID: 対象マッチ.対象ユーザーID._id
      });
    }

    res.json({
      メッセージ: `マッチを${応答 === 'accepted' ? '承認' : '拒否'}しました`,
      マッチ: 対象マッチ
    });
  } catch (error) {
    console.error('マッチ応答エラー:', error);
    res.status(500).json({ エラー: 'マッチの応答中にサーバーエラーが発生しました' });
  }
};

const マッチ履歴取得 = async (req, res) => {
  try {
    const ユーザーID = req.認証ユーザー._id;
    const { ページ = 1, 取得件数 = 10, ステータス } = req.query;

    const 絞り込み = {
      $or: [
        { リクエスト者ID: ユーザーID },
        { 対象ユーザーID: ユーザーID }
      ]
    };

    if (ステータス) {
      絞り込み.ステータス = ステータス;
    }

    const マッチ一覧 = await マッチ.find(絞り込み)
      .populate(['リクエスト者ID', '対象ユーザーID'], '-SMSコード -SMSコード有効期限')
      .sort({ createdAt: -1 })
      .limit(取得件数 * 1)
      .skip((ページ - 1) * 取得件数);

    const 合計 = await マッチ.countDocuments(絞り込み);

    res.json({
      マッチ一覧,
      総ページ数: Math.ceil(合計 / 取得件数),
      現在ページ: ページ,
      合計
    });
  } catch (error) {
    console.error('マッチ履歴取得エラー:', error);
    res.status(500).json({ エラー: 'マッチ履歴の取得中にサーバーエラーが発生しました' });
  }
};

const ミーティング確認 = async (req, res) => {
  try {
    const { ミーティングID } = req.body;
    const ユーザーID = req.認証ユーザー._id;

    const 対象ミーティング = await ミーティング.findById(ミーティングID).populate({
      path: 'マッチID',
      populate: {
        path: 'リクエスト者ID 対象ユーザーID',
        select: '-SMSコード -SMSコード有効期限'
      }
    });

    if (!対象ミーティング) {
      return res.status(404).json({ エラー: 'ミーティングが見つかりません' });
    }

    const 対象マッチ = 対象ミーティング.マッチID;
    const リクエスト者か = 対象マッチ.リクエスト者ID._id.toString() === ユーザーID.toString();
    const 対象者か = 対象マッチ.対象ユーザーID._id.toString() === ユーザーID.toString();

    if (!リクエスト者か && !対象者か) {
      return res.status(403).json({ エラー: 'このミーティングを確認する権限がありません' });
    }

    if (リクエスト者か) {
      対象ミーティング.リクエスト者確認済み = true;
    }
    if (対象者か) {
      対象ミーティング.対象者確認済み = true;
    }

    対象ミーティング.両者確認済み = 対象ミーティング.リクエスト者確認済み && 対象ミーティング.対象者確認済み;

    if (対象ミーティング.両者確認済み && !対象ミーティング.実会時刻) {
      対象ミーティング.実会時刻 = new Date();
      対象ミーティング.会合成功 = true;

      await ユーザー.findByIdAndUpdate(対象マッチ.リクエスト者ID._id, { $inc: { 実会数: 1 } });
      await ユーザー.findByIdAndUpdate(対象マッチ.対象ユーザーID._id, { $inc: { 実会数: 1 } });
    }

    await 対象ミーティング.save();

    const 相手ユーザーID = リクエスト者か ? 対象マッチ.対象ユーザーID._id : 対象マッチ.リクエスト者ID._id;
    const 相手ユーザー = await ユーザー.findById(相手ユーザーID);

    if (相手ユーザー && 相手ユーザー.ソケットID) {
      req.app.get('io').to(相手ユーザー.ソケットID).emit('ミーティング確認', {
        ミーティングID: 対象ミーティング._id,
        確認者: req.認証ユーザー.名前,
        両者確認済み: 対象ミーティング.両者確認済み
      });
    }

    res.json({
      メッセージ: 'ミーティングを確認しました',
      ミーティング: {
        ID: 対象ミーティング._id,
        両者確認済み: 対象ミーティング.両者確認済み,
        実会時刻: 対象ミーティング.実会時刻,
        会合成功: 対象ミーティング.会合成功
      }
    });
  } catch (error) {
    console.error('ミーティング確認エラー:', error);
    res.status(500).json({ エラー: 'ミーティングの確認中にサーバーエラーが発生しました' });
  }
};

const マッチリクエスト検証 = [
  body('対象ユーザーID').isMongoId().withMessage('有効な対象ユーザーIDが必要です'),
  body('会う理由').trim().isLength({ min: 5, max: 200 }).withMessage('ミーティングの理由は5文字以上200文字以下で入力してください')
];

const マッチ応答検証 = [
  body('マッチID').isMongoId().withMessage('有効なマッチIDが必要です'),
  body('応答').isIn(['accepted', 'rejected']).withMessage('応答は承認または拒否である必要があります')
];

const ミーティング確認検証 = [
  body('ミーティングID').isMongoId().withMessage('有効なミーティングIDが必要です')
];

module.exports = {
  マッチリクエスト送信,
  マッチ応答,
  マッチ履歴取得,
  ミーティング確認,
  マッチリクエスト検証,
  マッチ応答検証,
  ミーティング確認検証
};
