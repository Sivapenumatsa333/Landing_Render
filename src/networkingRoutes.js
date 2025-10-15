// networkingRoutes.js - UPDATED
const express = require('express');
const router = express.Router();
const { requireAuth } = require('./middleware.auth');
const networkingController = require('./networkingController');

router.post('/connections/request', requireAuth, networkingController.sendConnectionRequest);
router.post('/connections/accept', requireAuth, networkingController.acceptConnectionRequest);
router.post('/connections/reject', requireAuth, networkingController.rejectConnectionRequest);
router.post('/connections/withdraw', requireAuth, networkingController.withdrawConnectionRequest);
router.get('/connections/pending', requireAuth, networkingController.getPendingRequests);
router.get('/connections/my', requireAuth, networkingController.getUserConnections);
router.get('/connections/status/:otherUserId', requireAuth, networkingController.checkConnectionStatus);
router.delete('/connections/remove', requireAuth, networkingController.removeConnection);
router.get('/connections/suggestions', requireAuth, networkingController.getConnectionSuggestions);

module.exports = router;
