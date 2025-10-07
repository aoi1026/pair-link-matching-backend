const twilio = require('twilio');

// 本番環境かつ有効な認証情報がある場合のみ Twilio クライアントを初期化する
let クライアント;
if (process.env.NODE_ENV === 'production' && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  try {
    クライアント = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    console.log('✅ Twilio クライアントの初期化に成功しました');
  } catch (error) {
    console.error('❌ Twilio クライアントの初期化に失敗しました:', error.message);
  }
}

const SMS送信 = async (電話番号, メッセージ) => {
  // 本番モードかどうかを確認する
  if (process.env.NODE_ENV !== 'production') {
    console.log(`📱 [開発モード] ${電話番号} への SMS: ${メッセージ}`);
    return { 成功: true, メッセージID: 'dev-mock-id', モード: 'development' };
  }

  // Twilio クライアントが正しく初期化されているか確認する
  if (!クライアント) {
    console.error('❌ Twilio クライアントが初期化されていません。TWILIO_ACCOUNT_SID と TWILIO_AUTH_TOKEN の環境変数を確認してください。');
    throw new Error('SMS service not configured properly');
  }

  // 送信元電話番号が設定されているか確認する
  if (!process.env.TWILIO_PHONE_NUMBER) {
    console.error('❌ 環境変数に TWILIO_PHONE_NUMBER が設定されていません');
    throw new Error('SMS sender phone number not configured');
  }

  try {
    console.log(`📤 ${電話番号} へ SMS を送信中...`);
    const 結果 = await クライアント.messages.create({
      body: メッセージ,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: 電話番号
    });
    console.log(`✅ SMS の送信に成功しました。SID: ${結果.sid}`);
    return { 成功: true, メッセージID: 結果.sid, モード: 'production' };
  } catch (error) {
    console.error('❌ SMS エラー:', error.message);
    console.error('エラー詳細:', {
      status: error.status,
      code: error.code,
      moreInfo: error.moreInfo
    });

    // よくある問題に対する具体的なエラーメッセージを提供する
    if (error.code === 20003) {
      throw new Error('Invalid Twilio credentials. Please check your TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.');
    }
    if (error.code === 21211) {
      throw new Error(`Invalid phone number format: ${電話番号}. Please use international format (e.g., +1234567890).`);
    }
    if (error.code === 21608) {
      throw new Error('The Twilio phone number is not verified or not capable of sending SMS.');
    }

    throw error;
  }
};

const SMSコード生成 = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const 認証コード送信 = async (電話番号, コード) => {
  // 開発モード - コンソールに出力する
  if (process.env.NODE_ENV !== 'production') {
    console.log(`🔐 [開発モード] ${電話番号} の認証コード: ${コード}`);
    return { 成功: true, メッセージID: 'dev-mock-id', モード: 'development' };
  }

  // 本番モード - 実際の SMS を送信する
  const メッセージ = `MatchApp の認証コードは ${コード} です。このコードは10分間有効です。このコードは誰にも教えないでください。`;

  try {
    const 結果 = await SMS送信(電話番号, メッセージ);
    return 結果;
  } catch (error) {
    console.error(`${電話番号} への認証コード送信に失敗しました:`, error.message);
    return { 成功: false, エラー: error.message };
  }
};

module.exports = {
  SMS送信,
  SMSコード生成,
  認証コード送信
};
