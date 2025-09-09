const express = require('express');
const {
  register,
  verifySMS,
  login,
  verifyLogin,
  registerValidation,
  smsValidation,
  loginValidation
} = require('../controllers/authController');

const router = express.Router();

router.post('/register', registerValidation, register);
router.post('/verify-sms', smsValidation, verifySMS);
router.post('/login', loginValidation, login);
router.post('/verify-login', smsValidation, verifyLogin);

module.exports = router;
