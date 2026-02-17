const prisma = require('../config/prisma');
const { AppError } = require('../utils/errors');
const { TEACHER_SHARED_PASSWORD } = require('../config/constants');
const { hashPassword } = require('./passwordService');

function assertAdminPassword(password) {
  if (String(password || '').trim() !== TEACHER_SHARED_PASSWORD) {
    throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
  }
}

async function adminLogin({ teacherName, password }) {
  if (String(teacherName || '').trim().toLowerCase() !== 'admin' || String(password || '').trim() !== TEACHER_SHARED_PASSWORD) {
    throw new AppError('Invalid admin credentials', 401, 'UNAUTHORIZED');
  }
  return { ok: true };
}

async function deleteAllStudents({ adminPassword }) {
  assertAdminPassword(adminPassword);
  const deletedSubmissions = await prisma.submission.deleteMany({});
  const deletedStudents = await prisma.student.deleteMany({});
  return {
    message: `Deleted ${deletedStudents.count} student(s) and ${deletedSubmissions.count} submission(s).`,
    deletedStudents: deletedStudents.count,
    deletedSubmissions: deletedSubmissions.count
  };
}

async function createTeacher({ adminPassword, name, password }) {
  assertAdminPassword(adminPassword);
  const normalizedName = String(name || '').trim();
  const normalizedPassword = String(password || '').trim();

  if (!normalizedName || normalizedName.toLowerCase() === 'admin') {
    throw new AppError('Invalid teacher name', 400, 'VALIDATION_ERROR');
  }
  if (!normalizedPassword) {
    throw new AppError('Teacher password is required', 400, 'VALIDATION_ERROR');
  }

  const existing = (await prisma.teacher.findMany()).find(
    (teacher) => String(teacher.name || '').toLowerCase() === normalizedName.toLowerCase()
  );
  if (existing) throw new AppError('Teacher already exists', 409, 'CONFLICT');

  const generatedUsername = `teacher_${Math.random().toString(36).slice(2, 8)}`;
  const created = await prisma.teacher.create({
    data: {
      name: normalizedName,
      email: generatedUsername,
      password: hashPassword(normalizedPassword)
    }
  });

  return { id: created.id, name: normalizedName, username: generatedUsername };
}

async function revealTeacherPassword({ adminPassword, teacherId }) {
  assertAdminPassword(adminPassword);
  const parsedTeacherId = Number.parseInt(teacherId, 10);
  if (Number.isNaN(parsedTeacherId)) throw new AppError('Invalid teacher id', 400, 'VALIDATION_ERROR');

  const teacher = await prisma.teacher.findUnique({ where: { id: parsedTeacherId } });
  if (!teacher) throw new AppError('Teacher not found', 404, 'NOT_FOUND');
  if (String(teacher.name || '').toLowerCase() === 'admin') throw new AppError('Admin password cannot be viewed here', 403, 'FORBIDDEN');
  if (String(teacher.password || '').startsWith('$2')) {
    throw new AppError('Password is hashed and cannot be viewed. Use reset instead.', 409, 'CONFLICT');
  }

  return { password: teacher.password };
}

async function changeTeacherPassword({ adminPassword, teacherId, newPassword }) {
  assertAdminPassword(adminPassword);
  const parsedTeacherId = Number.parseInt(teacherId, 10);
  const normalizedNewPassword = String(newPassword || '').trim();

  if (Number.isNaN(parsedTeacherId)) throw new AppError('Invalid teacher id', 400, 'VALIDATION_ERROR');
  if (!normalizedNewPassword) throw new AppError('New password is required', 400, 'VALIDATION_ERROR');

  const teacher = await prisma.teacher.findUnique({ where: { id: parsedTeacherId } });
  if (!teacher) throw new AppError('Teacher not found', 404, 'NOT_FOUND');
  if (String(teacher.name || '').toLowerCase() === 'admin') throw new AppError('Admin password cannot be changed here', 403, 'FORBIDDEN');

  await prisma.teacher.update({
    where: { id: parsedTeacherId },
    data: { password: hashPassword(normalizedNewPassword) }
  });

  return { message: 'Teacher password updated successfully.' };
}

async function deleteTeacher({ adminPassword, teacherId }) {
  assertAdminPassword(adminPassword);
  const parsedTeacherId = Number.parseInt(teacherId, 10);
  if (Number.isNaN(parsedTeacherId)) throw new AppError('Invalid teacher id', 400, 'VALIDATION_ERROR');

  const teacher = await prisma.teacher.findUnique({ where: { id: parsedTeacherId } });
  if (!teacher) throw new AppError('Teacher not found', 404, 'NOT_FOUND');
  if (String(teacher.name || '').toLowerCase() === 'admin') throw new AppError('Admin account cannot be deleted', 403, 'FORBIDDEN');

  await prisma.student.updateMany({ where: { teacherId: parsedTeacherId }, data: { teacherId: null } });
  await prisma.submission.updateMany({ where: { teacherId: parsedTeacherId }, data: { teacherId: null } });
  await prisma.teacher.delete({ where: { id: parsedTeacherId } });

  return { message: 'Teacher deleted successfully.' };
}

function normalizeBucketDate(date, interval) {
  const dt = new Date(date);
  if (interval === 'monthly') {
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  if (interval === 'weekly') {
    const day = dt.getUTCDay() || 7;
    const monday = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate() - day + 1));
    return monday.toISOString().slice(0, 10);
  }
  return dt.toISOString().slice(0, 10);
}

async function getSubmissionTrends({ adminPassword, interval = 'daily' }) {
  assertAdminPassword(adminPassword);
  const allowed = ['daily', 'weekly', 'monthly'];
  const normalized = allowed.includes(String(interval).toLowerCase()) ? String(interval).toLowerCase() : 'daily';
  const rows = await prisma.submission.findMany({
    select: { submissionDate: true }
  });

  const map = new Map();
  for (const row of rows) {
    const key = normalizeBucketDate(row.submissionDate, normalized);
    map.set(key, (map.get(key) || 0) + 1);
  }

  return Array.from(map.entries())
    .map(([period, count]) => ({ period, count }))
    .sort((a, b) => String(a.period).localeCompare(String(b.period)));
}

async function getGradeDistribution({ adminPassword }) {
  assertAdminPassword(adminPassword);
  const rows = await prisma.submission.findMany({
    where: { computedGrade: { not: null } },
    select: { computedGrade: true }
  });

  const bins = Array.from({ length: 10 }).map((_, idx) => ({
    range: `${idx * 2}-${idx * 2 + 2}`,
    count: 0
  }));

  for (const row of rows) {
    const grade = Number(row.computedGrade || 0);
    const index = Math.min(9, Math.max(0, Math.floor(grade / 2)));
    bins[index].count += 1;
  }

  return bins;
}

async function getAgentMetrics({ adminPassword }) {
  assertAdminPassword(adminPassword);

  const [submissions, testResults] = await Promise.all([
    prisma.submission.findMany({
      select: {
        status: true
      }
    }),
    prisma.testResult.findMany({
      select: { passed: true }
    })
  ]);

  const reposProcessed = submissions.filter((row) => ['DONE', 'FAILED', 'APPROVED'].includes(String(row.status))).length;
  const testsPassed = testResults.filter((row) => row.passed).length;
  const testsFailed = testResults.filter((row) => !row.passed).length;

  return {
    reposProcessed,
    testsPassed,
    testsFailed
  };
}

module.exports = {
  adminLogin,
  deleteAllStudents,
  createTeacher,
  revealTeacherPassword,
  changeTeacherPassword,
  deleteTeacher,
  getSubmissionTrends,
  getGradeDistribution,
  getAgentMetrics
};
