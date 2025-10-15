const express = require('express');
const router = express.Router();
const { requireAuth } = require('./middleware.auth');
const searchController = require('./searchController');

router.get('/search', requireAuth, searchController.searchProfiles);
router.get('/search/users', requireAuth, searchController.searchProfiles);
router.get('/search/suggestions', requireAuth, searchController.searchSuggestions);

module.exports = router;
