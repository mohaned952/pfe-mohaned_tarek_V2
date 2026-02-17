const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/studentController');

const router = express.Router();

router.post('/student/login', asyncHandler(controller.login));
router.post('/student/submit', asyncHandler(controller.submit));
router.get('/student/submissions/:studentId', asyncHandler(controller.submissions));
router.get('/student/grade/:studentId', asyncHandler(controller.approvedGrades));
router.get('/student/requirements/:studentId', asyncHandler(controller.requirements));

module.exports = router;
