const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/healthController');

const router = express.Router();

router.get('/live', asyncHandler(controller.live));
router.get('/ready', asyncHandler(controller.ready));
router.get('/metrics', asyncHandler(controller.metrics));

module.exports = router;
