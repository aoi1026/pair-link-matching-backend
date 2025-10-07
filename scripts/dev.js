const { spawn } = require('child_process');
const path = require('path');

console.log('\n🛠️  開発サーバー起動 🛠️');
console.log('════════════════════════════════════');
console.log(`時刻: ${new Date().toISOString()}`);
console.log(`作業ディレクトリ: ${process.cwd()}`);
console.log(`Node バージョン: ${process.version}`);
console.log('════════════════════════════════════\n');

console.log('📋 拡張エラーログ付きでサーバーを起動中...\n');

// 開発環境を設定する
process.env.NODE_ENV = 'development';

// サーバーを起動する
const サーバープロセス = spawn('node', ['server.js'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'development',
    // カラー出力を強制する
    FORCE_COLOR: '1'
  }
});

// サーバープロセスのイベントを処理する
サーバープロセス.on('error', (error) => {
  console.error('\n💥 サーバーの起動に失敗しました 💥');
  console.error('══════════════════════════════');
  console.error(`エラー: ${error.message}`);
  console.error(`コード: ${error.code}`);
  console.error('══════════════════════════════\n');
  process.exit(1);
});

サーバープロセス.on('exit', (コード, シグナル) => {
  if (コード !== 0) {
    console.error('\n💥 サーバーがクラッシュしました 💥');
    console.error('═══════════════════');
    console.error(`終了コード: ${コード}`);
    console.error(`シグナル: ${シグナル}`);
    console.error(`時刻: ${new Date().toISOString()}`);
    console.error('═══════════════════\n');
  } else {
    console.log('\n✅ サーバーが正常に停止しました ✅');
    console.log(`時刻: ${new Date().toISOString()}\n`);
  }
});

// プロセス終了を処理する
process.on('SIGINT', () => {
  console.log('\n🛑 サーバーをシャットダウン中...');
  サーバープロセス.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 サーバーを終了中...');
  サーバープロセス.kill('SIGTERM');
});
