const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/adminController');

const router = express.Router();

router.post('/admin/login', asyncHandler(controller.login));
router.delete('/admin/students', asyncHandler(controller.deleteAllStudents));
router.post('/admin/teachers', asyncHandler(controller.createTeacher));
router.post('/admin/teachers/:id/reveal-password', asyncHandler(controller.revealPassword));
router.post('/admin/teachers/:id/password', asyncHandler(controller.changePassword));
router.put('/admin/teachers/:id/password', asyncHandler(controller.changePassword));
router.delete('/admin/teachers/:id', asyncHandler(controller.deleteTeacher));
router.get('/admin/analytics/submissions', asyncHandler(controller.analyticsSubmissions));
router.get('/admin/analytics/grades', asyncHandler(controller.analyticsGrades));
router.get('/admin/analytics/agents', asyncHandler(controller.analyticsAgents));

module.exports = router;
