const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');

    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/matching-app', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('\n💾 DATABASE CONNECTION SUCCESS 💾');
    console.log('═══════════════════════════════════');
    console.log(`📍 Host: ${conn.connection.host}`);
    console.log(`🏗️  Database: ${conn.connection.name}`);
    console.log(`🔗 Port: ${conn.connection.port}`);
    console.log(`⚡ Ready State: ${conn.connection.readyState === 1 ? 'Connected' : 'Not Connected'}`);
    console.log('═══════════════════════════════════\n');

    // Connection event listeners
    conn.connection.on('error', (error) => {
      console.error('\n💥 DATABASE ERROR 💥');
      console.error('══════════════════');
      console.error(`Time: ${new Date().toISOString()}`);
      console.error(`Error: ${error.message}`);
      if (error.stack) {
        console.error(`Stack: ${error.stack}`);
      }
      console.error('══════════════════\n');
    });

    conn.connection.on('disconnected', () => {
      console.warn('\n⚠️  DATABASE DISCONNECTED ⚠️');
      console.warn(`Time: ${new Date().toISOString()}`);
      console.warn('Attempting to reconnect...\n');
    });

    conn.connection.on('reconnected', () => {
      console.log('\n✅ DATABASE RECONNECTED ✅');
      console.log(`Time: ${new Date().toISOString()}\n`);
    });

  } catch (error) {
    console.error('\n💥 DATABASE CONNECTION FAILED 💥');
    console.error('═══════════════════════════════════');
    console.error(`Time: ${new Date().toISOString()}`);
    console.error(`Error: ${error.name}: ${error.message}`);
    console.error(`Connection String: ${process.env.MONGODB_URI || 'mongodb://localhost:27017/matching-app'}`);

    if (error.stack) {
      console.error('\nStack Trace:');
      console.error(error.stack);
    }

    if (error.reason) {
      console.error(`\nReason: ${error.reason}`);
    }

    console.error('═══════════════════════════════════\n');
    console.error('💡 Troubleshooting tips:');
    console.error('  1. Make sure MongoDB is running');
    console.error('  2. Check MONGODB_URI in .env file');
    console.error('  3. Verify network connectivity');
    console.error('  4. Check MongoDB auth credentials\n');

    process.exit(1);
  }
};

module.exports = connectDB;