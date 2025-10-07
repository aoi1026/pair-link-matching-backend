const express = require('express');
const { auth } = require('../middleware/auth');
const {
  sendMatchRequest,
  respondToMatch,
  getMatchHistory,
  confirmMeeting,
  matchRequestValidation,
  matchResponseValidation,
  meetingConfirmValidation
} = require('../controllers/matchingController');

const router = express.Router();

router.post('/request', matchRequestValidation, sendMatchRequest);
router.post('/respond', matchResponseValidation, respondToMatch);
router.get('/history', getMatchHistory);
router.post('/confirm-meeting', auth, meetingConfirmValidation, confirmMeeting);

module.exports = router;