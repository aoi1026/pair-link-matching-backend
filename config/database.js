const mongoose = require('mongoose');

const DB接続 = async () => {
  try {
    console.log('🔌 MongoDB に接続中...');

    const 接続 = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/matching-app', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('\n💾 データベース接続成功 💾');
    console.log('═══════════════════════════════════');
    console.log(`📍 ホスト: ${接続.connection.host}`);
    console.log(`🏗️  データベース: ${接続.connection.name}`);
    console.log(`🔗 ポート: ${接続.connection.port}`);
    console.log(`⚡ 接続状態: ${接続.connection.readyState === 1 ? '接続済み' : '未接続'}`);
    console.log('═══════════════════════════════════\n');

    // 接続イベントのリスナー
    接続.connection.on('error', (error) => {
      console.error('\n💥 データベースエラー 💥');
      console.error('══════════════════');
      console.error(`時刻: ${new Date().toISOString()}`);
      console.error(`エラー: ${error.message}`);
      if (error.stack) {
        console.error(`スタック: ${error.stack}`);
      }
      console.error('══════════════════\n');
    });

    接続.connection.on('disconnected', () => {
      console.warn('\n⚠️  データベース切断 ⚠️');
      console.warn(`時刻: ${new Date().toISOString()}`);
      console.warn('再接続を試みています...\n');
    });

    接続.connection.on('reconnected', () => {
      console.log('\n✅ データベース再接続 ✅');
      console.log(`時刻: ${new Date().toISOString()}\n`);
    });

  } catch (error) {
    console.error('\n💥 データベース接続失敗 💥');
    console.error('═══════════════════════════════════');
    console.error(`時刻: ${new Date().toISOString()}`);
    console.error(`エラー: ${error.name}: ${error.message}`);
    console.error(`接続文字列: ${process.env.MONGODB_URI || 'mongodb://localhost:27017/matching-app'}`);

    if (error.stack) {
      console.error('\nスタックトレース:');
      console.error(error.stack);
    }

    if (error.reason) {
      console.error(`\n理由: ${error.reason}`);
    }

    console.error('═══════════════════════════════════\n');
    console.error('💡 トラブルシューティングのヒント:');
    console.error('  1. MongoDB が起動していることを確認してください');
    console.error('  2. .env ファイルの MONGODB_URI を確認してください');
    console.error('  3. ネットワーク接続を確認してください');
    console.error('  4. MongoDB の認証情報を確認してください\n');

    process.exit(1);
  }
};

module.exports = DB接続;
