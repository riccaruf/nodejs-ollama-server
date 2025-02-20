const express = require('express');
const router = express.Router();
const { processFitnessSupport } = require('../controllers/fitnessController');

router.post('/', processFitnessSupport);

module.exports = router;
