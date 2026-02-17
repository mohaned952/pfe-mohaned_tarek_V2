const express = require('express');

const teacherRoutes = require('./teacherRoutes');
const healthRoutes = require('./healthRoutes');
const studentRoutes = require('./studentRoutes');
const teacherPortalRoutes = require('./teacherPortalRoutes');
const adminRoutes = require('./adminRoutes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/teacher-workflow', teacherRoutes);
router.use('/', studentRoutes);
router.use('/', teacherPortalRoutes);
router.use('/', adminRoutes);

module.exports = router;
