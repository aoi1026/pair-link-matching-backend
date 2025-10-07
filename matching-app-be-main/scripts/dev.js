const { spawn } = require('child_process');
const path = require('path');

console.log('\n🛠️  DEVELOPMENT SERVER STARTUP 🛠️');
console.log('════════════════════════════════════');
console.log(`Time: ${new Date().toISOString()}`);
console.log(`Working Directory: ${process.cwd()}`);
console.log(`Node Version: ${process.version}`);
console.log('════════════════════════════════════\n');

console.log('📋 Starting server with enhanced error logging...\n');

// Set development environment
process.env.NODE_ENV = 'development';

// Start the server
const serverProcess = spawn('node', ['server.js'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'development',
    // Force color output
    FORCE_COLOR: '1'
  }
});

// Handle server process events
serverProcess.on('error', (error) => {
  console.error('\n💥 FAILED TO START SERVER 💥');
  console.error('══════════════════════════════');
  console.error(`Error: ${error.message}`);
  console.error(`Code: ${error.code}`);
  console.error('══════════════════════════════\n');
  process.exit(1);
});

serverProcess.on('exit', (code, signal) => {
  if (code !== 0) {
    console.error('\n💥 SERVER CRASHED 💥');
    console.error('═══════════════════');
    console.error(`Exit Code: ${code}`);
    console.error(`Signal: ${signal}`);
    console.error(`Time: ${new Date().toISOString()}`);
    console.error('═══════════════════\n');
  } else {
    console.log('\n✅ SERVER STOPPED GRACEFULLY ✅');
    console.log(`Time: ${new Date().toISOString()}\n`);
  }
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  serverProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Terminating server...');
  serverProcess.kill('SIGTERM');
});