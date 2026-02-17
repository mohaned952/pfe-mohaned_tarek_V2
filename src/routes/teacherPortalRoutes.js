const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/teacherPortalController');

const router = express.Router();

router.post('/teacher/login', asyncHandler(controller.login));
router.get('/teacher/list', asyncHandler(controller.list));
router.get('/teacher/students', asyncHandler(controller.students));
router.get('/teacher/submissions', asyncHandler(controller.submissions));
router.delete('/teacher/students/:id', asyncHandler(controller.deleteStudent));
router.post('/teacher/approve', asyncHandler(controller.approve));
router.post('/teacher/approve-bulk', asyncHandler(controller.approveBulk));
router.post('/teacher/start-correction', asyncHandler(controller.startCorrection));
router.post('/teacher/start-correction-bulk', asyncHandler(controller.startCorrectionBulk));
router.post('/teacher/start-correction-selected', asyncHandler(controller.startCorrectionSelected));
router.get('/teacher/test-suites', asyncHandler(controller.listTestSuites));
router.post('/teacher/test-suites', asyncHandler(controller.saveTestSuite));
router.post('/teacher/test-suites/upload', asyncHandler(controller.uploadTestSuite));

module.exports = router;
