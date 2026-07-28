const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { list, create, update, remove } = require('../controllers/rules.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/', list);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);

module.exports = router;
