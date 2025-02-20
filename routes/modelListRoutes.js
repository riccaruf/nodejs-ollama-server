const express = require('express');
const router = express.Router();
const { processModelList } = require('../controllers/modelsController');

router.get('/', processModelList);

module.exports = router;
