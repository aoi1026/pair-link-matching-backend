const エラーハンドラー = (err, req, res, next) => {
  // 詳細なエラー情報をコンソールに出力する
  console.error('\n🚨 エラーが発生しました 🚨');
  console.error('═══════════════════');
  console.error(`時刻: ${new Date().toISOString()}`);
  console.error(`メソッド: ${req.method}`);
  console.error(`URL: ${req.originalUrl}`);
  console.error(`IP: ${req.ip}`);
  console.error(`User-Agent: ${req.get('User-Agent')}`);

  if (req.認証ユーザー) {
    console.error(`ユーザーID: ${req.認証ユーザー._id || req.認証ユーザー.id}`);
    console.error(`ユーザー: ${req.認証ユーザー.名前}`);
  }

  if (req.body && Object.keys(req.body).length > 0) {
    console.error('リクエストボディ:');
    // 機微な情報はログに残さない
    const マスク済みボディ = { ...req.body };
    if (マスク済みボディ.パスワード) マスク済みボディ.パスワード = '[非表示]';
    if (マスク済みボディ.コード) マスク済みボディ.コード = '[非表示]';
    if (マスク済みボディ.SMSコード) マスク済みボディ.SMSコード = '[非表示]';
    if (マスク済みボディ.電話番号) {
      // プライバシー保護のため下4桁のみ表示する
      const 電話 = マスク済みボディ.電話番号;
      マスク済みボディ.電話番号 = 電話.substring(0, 電話.length - 4).replace(/./g, '*') + 電話.substring(電話.length - 4);
    }
    console.error(JSON.stringify(マスク済みボディ, null, 2));
  }

  console.error('\nエラー詳細:');
  console.error(`名称: ${err.name}`);
  console.error(`メッセージ: ${err.message}`);

  if (err.stack) {
    console.error('\nスタックトレース:');
    console.error(err.stack);
  }

  // MongoDB / Mongoose 固有のエラー
  if (err.name === 'ValidationError') {
    console.error('\nバリデーションエラー:');
    Object.keys(err.errors).forEach(key => {
      console.error(`  ${key}: ${err.errors[key].message}`);
    });
  }

  if (err.name === 'CastError') {
    console.error(`\nキャストエラー: ${err.value} はパス '${err.path}' に対して有効な ${err.kind} ではありません`);
  }

  if (err.code === 11000) {
    console.error('\n重複キーエラー:');
    console.error(`重複した値: ${Object.keys(err.keyValue).join(', ')}`);
    console.error(`値: ${JSON.stringify(err.keyValue)}`);
  }

  console.error('═══════════════════\n');

  // 環境に応じてエラーレスポンスを返す
  let エラー情報 = { ...err };
  エラー情報.message = err.message;

  if (err.name === 'CastError') {
    const メッセージ = `リソースが見つかりません`;
    エラー情報 = { メッセージ };
    return res.status(404).json({ エラー: メッセージ });
  }

  if (err.code === 11000) {
    const メッセージ = '重複した値が入力されました';
    エラー情報 = { メッセージ };
    return res.status(400).json({ エラー: メッセージ });
  }

  if (err.name === 'ValidationError') {
    const メッセージ = Object.values(err.errors).map(val => val.message).join(', ');
    エラー情報 = { メッセージ };
    return res.status(400).json({ エラー: メッセージ });
  }

  if (err.name === 'JsonWebTokenError') {
    const メッセージ = '無効なトークンです';
    エラー情報 = { メッセージ };
    return res.status(401).json({ エラー: メッセージ });
  }

  if (err.name === 'TokenExpiredError') {
    const メッセージ = 'トークンの有効期限が切れています';
    エラー情報 = { メッセージ };
    return res.status(401).json({ エラー: メッセージ });
  }

  // デフォルトは 500 サーバーエラー
  res.status(err.statusCode || 500).json({
    エラー: エラー情報.message || 'サーバーエラー',
    ...(process.env.NODE_ENV === 'development' && { スタック: err.stack })
  });
};

// 未処理の Promise リジェクションを処理する
process.on('unhandledRejection', (err, promise) => {
  console.error('\n💥 未処理の PROMISE リジェクション 💥');
  console.error('═══════════════════════════════');
  console.error(`時刻: ${new Date().toISOString()}`);
  console.error(`エラー: ${err.name}: ${err.message}`);
  if (err.stack) {
    console.error('\nスタックトレース:');
    console.error(err.stack);
  }
  console.error('═══════════════════════════════\n');

  // サーバーを終了してプロセスを停止する
  process.exit(1);
});

// 捕捉されなかった例外を処理する
process.on('uncaughtException', (err) => {
  console.error('\n💥 捕捉されなかった例外 💥');
  console.error('═══════════════════════════');
  console.error(`時刻: ${new Date().toISOString()}`);
  console.error(`エラー: ${err.name}: ${err.message}`);
  if (err.stack) {
    console.error('\nスタックトレース:');
    console.error(err.stack);
  }
  console.error('═══════════════════════════\n');

  process.exit(1);
});

module.exports = エラーハンドラー;
