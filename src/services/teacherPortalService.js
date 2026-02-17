const prisma = require('../config/prisma');
const { AppError } = require('../utils/errors');
const { verifyPassword } = require('./passwordService');
const { listSuites, parseSuiteContent, upsertSuite } = require('./testSuiteService');
const { startSingleCorrection } = require('./gradingOrchestratorService');

async function loginTeacher({ teacherName, username, password }) {
  const normalizedName = String(teacherName || username || '').trim();
  const normalizedPassword = String(password || '').trim();
  if (!normalizedName) throw new AppError('Teacher name is required', 400, 'VALIDATION_ERROR');
  if (!normalizedPassword) throw new AppError('Password is required', 400, 'VALIDATION_ERROR');

  const teachers = await prisma.teacher.findMany({
    where: { name: normalizedName }
  });
  const teacher = teachers[0] || (await prisma.teacher.findMany()).find((row) => String(row.name || '').toLowerCase() === normalizedName.toLowerCase());
  if (!teacher) throw new AppError('Invalid credentials', 401, 'UNAUTHORIZED');

  const valid = await verifyPassword(normalizedPassword, teacher.password);
  if (!valid) throw new AppError('Invalid credentials', 401, 'UNAUTHORIZED');

  return {
    id: teacher.id,
    name: teacher.name,
    email: teacher.email
  };
}

async function listTeachers() {
  const teachers = await prisma.teacher.findMany({ orderBy: { name: 'asc' } });
  return teachers
    .filter((teacher) => String(teacher.name || '').toLowerCase() !== 'admin')
    .map((teacher) => ({ id: teacher.id, name: teacher.name }));
}

async function listTeacherStudents(teacherId) {
  const parsedTeacherId = Number.parseInt(teacherId, 10);
  if (Number.isNaN(parsedTeacherId)) throw new AppError('Invalid teacher id', 400, 'VALIDATION_ERROR');

  const students = await prisma.student.findMany({
    where: {
      teacherId: parsedTeacherId,
      studentCode: {
        not: null
      }
    },
    include: {
      submissions: true
    },
    orderBy: { name: 'asc' }
  });

  return students
    .filter((student) => String(student.studentCode || '').trim() !== '')
    .map((student) => ({
      id: student.id,
      name: student.name,
      student_code: student.studentCode,
      email: student.email,
      group_name: student.groupName,
      year: student.year,
      submissions_count: student.submissions.length
    }));
}

async function listTeacherSubmissions(teacherId) {
  const parsedTeacherId = Number.parseInt(teacherId, 10);
  if (Number.isNaN(parsedTeacherId)) throw new AppError('Invalid teacher id', 400, 'VALIDATION_ERROR');

  const rows = await prisma.submission.findMany({
    where: {
      OR: [{ teacherId: parsedTeacherId }, { student: { is: { teacherId: parsedTeacherId } } }],
      status: {
        in: ['SUBMITTED', 'DONE', 'PROCESSING', 'FAILED', 'APPROVED']
      }
    },
    include: {
      student: true,
      testResults: true
    },
    orderBy: { submissionDate: 'desc' }
  });

  return rows
    .filter((row) => String(row.student?.studentCode || '').trim() !== '')
    .map((row) => ({
      id: row.id,
      student_id: row.studentId,
      teacher_id: row.teacherId,
      repo_url: row.repoUrl,
      submission_date: row.submissionDate,
      status: String(row.status || '').toLowerCase() === 'done' ? 'completed' : String(row.status || '').toLowerCase(),
      grade: row.computedGrade,
      evaluation_notes: row.evaluationNotes,
      teacher_feedback: row.teacherFeedback,
      correction_context: row.correctionContext,
      test_results: row.testResults.map((result) => ({
        id: result.id,
        test_name: result.testName,
        test_type: result.testType,
        language: result.language,
        function_name: result.functionName,
        passed: result.passed,
        weight: result.weight,
        score_earned: result.scoreEarned,
        duration_ms: result.durationMs,
        error_message: result.errorMessage
      })),
      student_name: row.student.name,
      student_code: row.student.studentCode,
      student_email: row.student.email,
      group_name: row.student.groupName,
      year: row.student.year
    }));
}

async function deleteTeacherStudent(studentId) {
  const parsedStudentId = Number.parseInt(studentId, 10);
  if (Number.isNaN(parsedStudentId)) throw new AppError('Invalid student id', 400, 'VALIDATION_ERROR');

  const student = await prisma.student.findUnique({ where: { id: parsedStudentId } });
  if (!student) throw new AppError('Student not found', 404, 'NOT_FOUND');

  await prisma.submission.deleteMany({ where: { studentId: parsedStudentId } });
  await prisma.student.delete({ where: { id: parsedStudentId } });
  return { message: 'Student and all related submissions deleted successfully.' };
}

async function approveSubmission(payload = {}) {
  const { submissionId, teacherId, teacherFeedback } = payload;
  const parsedSubmissionId = Number.parseInt(submissionId, 10);
  const parsedTeacherId = Number.parseInt(teacherId, 10);

  if (Number.isNaN(parsedSubmissionId)) throw new AppError('Invalid submission id', 400, 'VALIDATION_ERROR');
  if (Number.isNaN(parsedTeacherId)) throw new AppError('Invalid teacher id', 400, 'VALIDATION_ERROR');
  if (Object.prototype.hasOwnProperty.call(payload, 'grade')) {
    throw new AppError('Manual grade override is forbidden. Grade is computed automatically from tests.', 400, 'VALIDATION_ERROR');
  }

  const row = await prisma.submission.findUnique({
    where: { id: parsedSubmissionId },
    include: { student: true }
  });
  if (!row) throw new AppError('Submission not found', 404, 'NOT_FOUND');

  const ownerTeacherId = row.teacherId || row.student.teacherId;
  if (ownerTeacherId !== parsedTeacherId) {
    throw new AppError('You are not allowed to approve this submission', 403, 'FORBIDDEN');
  }

  await prisma.submission.update({
    where: { id: parsedSubmissionId },
    data: {
      status: 'APPROVED',
      teacherFeedback: String(teacherFeedback || '').trim()
    }
  });

  return { message: 'Grade approved and visible to student.' };
}

async function approveBulkSubmissions(payload = {}) {
  const { teacherId, teacherFeedback, filters = {} } = payload;
  const parsedTeacherId = Number.parseInt(teacherId, 10);
  if (Number.isNaN(parsedTeacherId)) throw new AppError('Invalid teacher id', 400, 'VALIDATION_ERROR');

  if (Object.prototype.hasOwnProperty.call(payload, 'grade')) {
    throw new AppError('Manual grade override is forbidden. Grade is computed automatically from tests.', 400, 'VALIDATION_ERROR');
  }

  const rows = await prisma.submission.findMany({
    where: {
      OR: [{ teacherId: parsedTeacherId }, { student: { is: { teacherId: parsedTeacherId } } }],
      status: { in: ['SUBMITTED', 'DONE', 'FAILED'] }
    },
    include: { student: true }
  });

  const normalizedGroup = String(filters.group || '').trim().toLowerCase();
  const normalizedYear = String(filters.year || '').trim().toUpperCase();
  const normalizedName = String(filters.studentName || '').trim().toLowerCase();

  const selected = rows.filter((row) => {
    if (normalizedGroup && String(row.student.groupName || '').toLowerCase() !== normalizedGroup) return false;
    if (normalizedYear && String(row.student.year || '').toUpperCase() !== normalizedYear) return false;
    if (normalizedName && !String(row.student.name || '').toLowerCase().includes(normalizedName)) return false;
    return true;
  });

  for (const row of selected) {
    await prisma.submission.update({
      where: { id: row.id },
      data: {
        status: 'APPROVED',
        teacherFeedback: String(teacherFeedback || '').trim() || row.evaluationNotes || ''
      }
    });
  }

  return {
    message: `Approved ${selected.length} submission(s) for current filters.`,
    approved: selected.length
  };
}

async function startCorrectionForSelected({ teacherId, submissionIds = [], instructions, requestId }) {
  const parsedTeacherId = Number.parseInt(teacherId, 10);
  if (Number.isNaN(parsedTeacherId)) throw new AppError('Invalid teacher id', 400, 'VALIDATION_ERROR');

  const normalizedSubmissionIds = Array.from(
    new Set(
      (Array.isArray(submissionIds) ? submissionIds : [])
        .map((item) => Number.parseInt(item, 10))
        .filter((item) => Number.isInteger(item) && item > 0)
    )
  );
  if (!normalizedSubmissionIds.length) throw new AppError('submissionIds is required', 400, 'VALIDATION_ERROR');

  let queued = 0;
  for (const submissionId of normalizedSubmissionIds) {
    await startSingleCorrection({
      submissionId,
      teacherId: parsedTeacherId,
      instructions,
      requestId
    });
    queued += 1;
  }

  return { message: `Queued ${queued} correction job(s).`, queued };
}

async function getTeacherTestSuites({ teacherId }) {
  const parsedTeacherId = Number.parseInt(teacherId, 10);
  if (Number.isNaN(parsedTeacherId)) throw new AppError('Invalid teacher id', 400, 'VALIDATION_ERROR');
  return listSuites({ teacherId: parsedTeacherId });
}

async function saveTeacherTestSuite({ teacherId, groupName, year, name, definition }) {
  const parsedTeacherId = Number.parseInt(teacherId, 10);
  if (Number.isNaN(parsedTeacherId)) throw new AppError('Invalid teacher id', 400, 'VALIDATION_ERROR');
  return upsertSuite({
    teacherId: parsedTeacherId,
    groupName,
    year,
    name,
    definition
  });
}

async function uploadTeacherTestSuite({ teacherId, groupName, year, name, content, format, language, entrypoint }) {
  const definition = parseSuiteContent({ content, format });
  if (String(language || '').trim()) definition.language = String(language).trim().toLowerCase();
  if (String(entrypoint || '').trim()) definition.entrypoint = String(entrypoint).trim();
  return saveTeacherTestSuite({ teacherId, groupName, year, name, definition });
}

module.exports = {
  loginTeacher,
  listTeachers,
  listTeacherStudents,
  listTeacherSubmissions,
  deleteTeacherStudent,
  approveSubmission,
  approveBulkSubmissions,
  startCorrectionForSelected,
  getTeacherTestSuites,
  saveTeacherTestSuite,
  uploadTeacherTestSuite
};
