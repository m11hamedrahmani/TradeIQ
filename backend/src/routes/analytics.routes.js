const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { dashboard } = require('../controllers/analytics.controller');

const router = express.Router();

router.use(requireAuth);
router.get('/dashboard', dashboard);

module.exports = router;
