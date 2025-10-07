const errorHandler = (err, req, res, next) => {
  // Log detailed error information to console
  console.error('\n🚨 ERROR OCCURRED 🚨');
  console.error('═══════════════════');
  console.error(`Time: ${new Date().toISOString()}`);
  console.error(`Method: ${req.method}`);
  console.error(`URL: ${req.originalUrl}`);
  console.error(`IP: ${req.ip}`);
  console.error(`User-Agent: ${req.get('User-Agent')}`);

  if (req.user) {
    console.error(`User ID: ${req.user._id || req.user.id}`);
    console.error(`User: ${req.user.name}`);
  }

  if (req.body && Object.keys(req.body).length > 0) {
    console.error('Request Body:');
    // Don't log sensitive data
    const sanitizedBody = { ...req.body };
    if (sanitizedBody.password) sanitizedBody.password = '[HIDDEN]';
    if (sanitizedBody.code) sanitizedBody.code = '[HIDDEN]';
    if (sanitizedBody.smsCode) sanitizedBody.smsCode = '[HIDDEN]';
    if (sanitizedBody.phoneNumber) {
      // Show only last 4 digits for privacy
      const phone = sanitizedBody.phoneNumber;
      sanitizedBody.phoneNumber = phone.substring(0, phone.length - 4).replace(/./g, '*') + phone.substring(phone.length - 4);
    }
    console.error(JSON.stringify(sanitizedBody, null, 2));
  }

  console.error('\nError Details:');
  console.error(`Name: ${err.name}`);
  console.error(`Message: ${err.message}`);

  if (err.stack) {
    console.error('\nStack Trace:');
    console.error(err.stack);
  }

  // Additional MongoDB/Mongoose specific errors
  if (err.name === 'ValidationError') {
    console.error('\nValidation Errors:');
    Object.keys(err.errors).forEach(key => {
      console.error(`  ${key}: ${err.errors[key].message}`);
    });
  }

  if (err.name === 'CastError') {
    console.error(`\nCast Error: ${err.value} is not a valid ${err.kind} for path '${err.path}'`);
  }

  if (err.code === 11000) {
    console.error('\nDuplicate Key Error:');
    console.error(`Duplicate value for: ${Object.keys(err.keyValue).join(', ')}`);
    console.error(`Value: ${JSON.stringify(err.keyValue)}`);
  }

  console.error('═══════════════════\n');

  // Send error response based on environment
  let error = { ...err };
  error.message = err.message;

  if (err.name === 'CastError') {
    const message = `Resource not found`;
    error = { message };
    return res.status(404).json({ error: message });
  }

  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = { message };
    return res.status(400).json({ error: message });
  }

  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = { message };
    return res.status(400).json({ error: message });
  }

  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = { message };
    return res.status(401).json({ error: message });
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = { message };
    return res.status(401).json({ error: message });
  }

  // Default to 500 server error
  res.status(err.statusCode || 500).json({
    error: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error('\n💥 UNHANDLED PROMISE REJECTION 💥');
  console.error('═══════════════════════════════');
  console.error(`Time: ${new Date().toISOString()}`);
  console.error(`Error: ${err.name}: ${err.message}`);
  if (err.stack) {
    console.error('\nStack Trace:');
    console.error(err.stack);
  }
  console.error('═══════════════════════════════\n');

  // Close server & exit process
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('\n💥 UNCAUGHT EXCEPTION 💥');
  console.error('═══════════════════════════');
  console.error(`Time: ${new Date().toISOString()}`);
  console.error(`Error: ${err.name}: ${err.message}`);
  if (err.stack) {
    console.error('\nStack Trace:');
    console.error(err.stack);
  }
  console.error('═══════════════════════════\n');

  process.exit(1);
});

module.exports = errorHandler;