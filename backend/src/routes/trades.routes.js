const express = require('express');
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');
const { list, getOne, create, update, remove, importCsv, evaluate } = require('../controllers/trades.controller');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const router = express.Router();

router.use(requireAuth);

router.get('/', list);
router.post('/', create);
router.post('/import', upload.single('file'), importCsv);
router.post('/evaluate', evaluate);
router.get('/:id', getOne);
router.put('/:id', update);
router.delete('/:id', remove);

module.exports = router;
