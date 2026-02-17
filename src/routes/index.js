const express = require('express');

const authRoutes = require('./auth.routes');
const studentRoutes = require('./student.routes');
const teacherRoutes = require('./teacher.routes');

const router = express.Router();

router.get('/health', (_req, res) => res.json({ ok: true, service: 'pfe-code-correction-platform' }));
router.use('/auth', authRoutes);
router.use('/student', studentRoutes);
router.use('/teacher', teacherRoutes);

module.exports = router;
