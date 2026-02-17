const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { startCorrectionSchema, bulkCorrectionSchema } = require('../utils/schemas');
const { requireRole } = require('../middleware/rbac');
const controller = require('../controllers/teacherController');

const router = express.Router();

router.post('/start-correction', requireRole(['teacher', 'admin']), validate(startCorrectionSchema), asyncHandler(controller.startCorrection));
router.post('/start-correction-bulk', requireRole(['teacher', 'admin']), validate(bulkCorrectionSchema), asyncHandler(controller.startBulk));

module.exports = router;
