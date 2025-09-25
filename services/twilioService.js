const twilio = require('twilio');

// Initialize Twilio client only in production with valid credentials
let client;
if (process.env.NODE_ENV === 'production' && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  try {
    client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    console.log('✅ Twilio client initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Twilio client:', error.message);
  }
}

const sendSMS = async (phoneNumber, message) => {
  // Check if we're in production mode
  if (process.env.NODE_ENV !== 'production') {
    console.log(`📱 [DEV MODE] SMS to ${phoneNumber}: ${message}`);
    return { success: true, messageId: 'dev-mock-id', mode: 'development' };
  }

  // Check if Twilio client is properly initialized
  if (!client) {
    console.error('❌ Twilio client not initialized. Check your TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables.');
    throw new Error('SMS service not configured properly');
  }

  // Check if phone number is configured
  if (!process.env.TWILIO_PHONE_NUMBER) {
    console.error('❌ TWILIO_PHONE_NUMBER not configured in environment variables');
    throw new Error('SMS sender phone number not configured');
  }

  try {
    console.log(`📤 Sending SMS to ${phoneNumber}...`);
    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber
    });
    console.log(`✅ SMS sent successfully. SID: ${result.sid}`);
    return { success: true, messageId: result.sid, mode: 'production' };
  } catch (error) {
    console.error('❌ SMS Error:', error.message);
    console.error('Error details:', {
      status: error.status,
      code: error.code,
      moreInfo: error.moreInfo
    });

    // Provide specific error messages for common issues
    if (error.code === 20003) {
      throw new Error('Invalid Twilio credentials. Please check your TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.');
    }
    if (error.code === 21211) {
      throw new Error(`Invalid phone number format: ${phoneNumber}. Please use international format (e.g., +1234567890).`);
    }
    if (error.code === 21608) {
      throw new Error('The Twilio phone number is not verified or not capable of sending SMS.');
    }

    throw error;
  }
};

const generateSMSCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendVerificationCode = async (phoneNumber, code) => {
  // Development mode - log to console
  if (process.env.NODE_ENV !== 'production') {
    console.log(`🔐 [DEV MODE] Verification code for ${phoneNumber}: ${code}`);
    return { success: true, messageId: 'dev-mock-id', mode: 'development' };
  }

  // Production mode - send real SMS
  const message = `Your verification code for MatchApp is: ${code}. This code will expire in 10 minutes. Do not share this code with anyone.`;

  try {
    const result = await sendSMS(phoneNumber, message);
    return result;
  } catch (error) {
    console.error(`Failed to send verification code to ${phoneNumber}:`, error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendSMS,
  generateSMSCode,
  sendVerificationCode
};