const jwt = require('jsonwebtoken');
const ユーザー = require('../models/User');

const ソケットハンドラー = (io) => {
  io.use(async (socket, next) => {
    try {
      const トークン = socket.handshake.auth.token;
      if (!トークン) {
        console.error('\n🔒 ソケット認証エラー 🔒');
        console.error(`時刻: ${new Date().toISOString()}`);
        console.error(`ソケットID: ${socket.id}`);
        console.error(`エラー: トークンが提供されていません`);
        console.error(`IP: ${socket.handshake.address}\n`);
        throw new Error('No token provided');
      }

      const 復号データ = jwt.verify(トークン, process.env.JWT_SECRET);
      const 対象ユーザー = await ユーザー.findById(復号データ.ユーザーID);

      if (!対象ユーザー) {
        console.error('\n🔒 ソケット認証エラー 🔒');
        console.error(`時刻: ${new Date().toISOString()}`);
        console.error(`ソケットID: ${socket.id}`);
        console.error(`エラー: ID ${復号データ.ユーザーID} のユーザーが見つかりません`);
        console.error(`IP: ${socket.handshake.address}\n`);
        throw new Error('User not found');
      }

      socket.ユーザーID = 対象ユーザー._id.toString();
      socket.ユーザー = 対象ユーザー;
      console.log(`🔌 ソケット認証成功: ${対象ユーザー.名前} (${socket.id})`);
      next();
    } catch (error) {
      console.error('\n🔒 ソケット認証失敗 🔒');
      console.error(`時刻: ${new Date().toISOString()}`);
      console.error(`ソケットID: ${socket.id}`);
      console.error(`エラー: ${error.message}`);
      console.error(`IP: ${socket.handshake.address}\n`);
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`🟢 ユーザー接続: ${socket.ユーザー.名前} (${socket.ユーザーID}) ${new Date().toLocaleTimeString()}`);

    await ユーザー.findByIdAndUpdate(socket.ユーザーID, {
      ソケットID: socket.id,
      オンライン状態: true,
      最終接続: new Date()
    });

    socket.broadcast.emit('ユーザーオンライン', {
      ユーザーID: socket.ユーザーID,
      名前: socket.ユーザー.名前,
      位置: socket.ユーザー.位置,
      プロフィール写真: socket.ユーザー.プロフィール写真
    });

    socket.on('位置更新', async (データ) => {
      try {
        const { 緯度, 経度 } = データ;

        const 更新後ユーザー = await ユーザー.findByIdAndUpdate(
          socket.ユーザーID,
          {
            位置: {
              type: 'Point',
              coordinates: [経度, 緯度]
            },
            最終接続: new Date()
          },
          { new: true }
        );

        socket.broadcast.emit('ユーザー位置更新', {
          ユーザーID: socket.ユーザーID,
          位置: 更新後ユーザー.位置,
          タイムスタンプ: new Date()
        });

        socket.emit('位置更新完了', {
          成功: true,
          位置: 更新後ユーザー.位置
        });
      } catch (error) {
        console.error('\n📍 位置更新エラー 📍');
        console.error(`時刻: ${new Date().toISOString()}`);
        console.error(`ユーザー: ${socket.ユーザー.名前} (${socket.ユーザーID})`);
        console.error(`ソケット: ${socket.id}`);
        console.error(`エラー: ${error.message}`);
        if (error.stack) console.error(`スタック: ${error.stack}`);
        console.error('═══════════════════════════════\n');
        socket.emit('error', { メッセージ: 'Failed to update location' });
      }
    });

    socket.on('ルーム参加', (ルームID) => {
      socket.join(ルームID);
      console.log(`ユーザー ${socket.ユーザー.名前} がルームに参加しました: ${ルームID}`);
    });

    socket.on('ルーム退出', (ルームID) => {
      socket.leave(ルームID);
      console.log(`ユーザー ${socket.ユーザー.名前} がルームから退出しました: ${ルームID}`);
    });

    socket.on('メッセージ送信', (データ) => {
      const { ルームID, メッセージ, 対象ユーザーID } = データ;

      socket.to(ルームID).emit('新規メッセージ', {
        送信者ID: socket.ユーザーID,
        送信者名: socket.ユーザー.名前,
        メッセージ,
        タイムスタンプ: new Date()
      });
    });

    socket.on('ミーティング接近', (データ) => {
      const { マッチID, 対象ユーザーID, 距離 } = データ;

      io.emit('ユーザーミーティング接近', {
        マッチID,
        ユーザーID: socket.ユーザーID,
        ユーザー名: socket.ユーザー.名前,
        距離,
        タイムスタンプ: new Date()
      });
    });

    socket.on('位置共有リクエスト', (対象ユーザーID) => {
      const 対象ソケット = [...io.sockets.sockets.values()]
        .find(s => s.ユーザーID === 対象ユーザーID);

      if (対象ソケット) {
        対象ソケット.emit('位置共有要求', {
          リクエスト者ID: socket.ユーザーID,
          リクエスト者名: socket.ユーザー.名前
        });
      }
    });

    socket.on('位置共有', (データ) => {
      const { 対象ユーザーID, 位置, 継続時間 = 300000 } = データ;

      const 対象ソケット = [...io.sockets.sockets.values()]
        .find(s => s.ユーザーID === 対象ユーザーID);

      if (対象ソケット) {
        対象ソケット.emit('位置共有完了', {
          送信者ID: socket.ユーザーID,
          送信者名: socket.ユーザー.名前,
          位置,
          有効期限: new Date(Date.now() + 継続時間)
        });

        setTimeout(() => {
          対象ソケット.emit('位置共有期限切れ', {
            送信者ID: socket.ユーザーID
          });
        }, 継続時間);
      }
    });

    socket.on('ピング', () => {
      socket.emit('ポン', { タイムスタンプ: new Date() });
    });

    socket.on('disconnect', async () => {
      console.log(`🔴 ユーザー切断: ${socket.ユーザー.名前} (${socket.ユーザーID}) ${new Date().toLocaleTimeString()}`);

      try {
        await ユーザー.findByIdAndUpdate(socket.ユーザーID, {
          オンライン状態: false,
          最終接続: new Date(),
          ソケットID: null
        });

        socket.broadcast.emit('ユーザーオフライン', {
          ユーザーID: socket.ユーザーID,
          最終接続: new Date()
        });
      } catch (error) {
        console.error('\n🔴 切断エラー 🔴');
        console.error(`時刻: ${new Date().toISOString()}`);
        console.error(`ユーザー: ${socket.ユーザー.名前} (${socket.ユーザーID})`);
        console.error(`オフライン状態の更新エラー: ${error.message}\n`);
      }
    });

    socket.on('error', (error) => {
      console.error('\n⚡ ソケットエラー ⚡');
      console.error(`時刻: ${new Date().toISOString()}`);
      console.error(`ソケット: ${socket.id}`);
      console.error(`ユーザー: ${socket.ユーザー?.名前 || '不明'} (${socket.ユーザーID || 'IDなし'})`);
      console.error(`エラー: ${error.message || error}`);
      if (error.stack) console.error(`スタック: ${error.stack}`);
      console.error('═══════════════════\n');
    });
  });

  const ピング間隔 = setInterval(() => {
    io.emit('ピング', { タイムスタンプ: new Date() });
  }, 30000);

  io.on('close', () => {
    clearInterval(ピング間隔);
  });
};

module.exports = ソケットハンドラー;
