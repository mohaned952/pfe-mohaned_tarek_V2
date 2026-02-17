const prisma = require('../config/prisma');
const { AppError } = require('../utils/errors');
const { getSuiteByGroupYear } = require('./testSuiteService');

async function loginOrRegisterStudent({ name, studentId }) {
  const normalizedName = String(name || '').trim();
  const studentCode = String(studentId || '').trim();
  if (!normalizedName) throw new AppError('Full name is required', 400, 'VALIDATION_ERROR');
  if (!studentCode) throw new AppError('Student ID is required', 400, 'VALIDATION_ERROR');

  const generatedEmail = `student_${studentCode.toLowerCase()}@local.platform`;

  const byCode = await prisma.student.findMany({
    where: {
      OR: [{ studentCode }, { email: generatedEmail }]
    }
  });

  if (byCode.length > 0) {
    const exactName = byCode.find((row) => String(row.name || '').trim().toLowerCase() === normalizedName.toLowerCase());
    if (!exactName) {
      throw new AppError('Student ID already exists and belongs to another student.', 409, 'CONFLICT');
    }
    return { id: exactName.id, name: exactName.name, student_code: exactName.studentCode };
  }

  const byNameRows = await prisma.student.findMany({
    where: {
      NOT: {
        studentCode: studentCode
      }
    },
    select: {
      id: true,
      name: true
    }
  });
  const existingByName = byNameRows.find((row) => String(row.name || '').trim().toLowerCase() === normalizedName.toLowerCase());

  if (existingByName) {
    throw new AppError('Student name already exists and belongs to another student ID.', 409, 'CONFLICT');
  }

  const created = await prisma.student.create({
    data: {
      name: normalizedName,
      email: generatedEmail,
      groupName: 'UNASSIGNED',
      year: 'UNASSIGNED',
      password: 'password',
      studentCode
    }
  });

  return { id: created.id, name: created.name, student_code: created.studentCode };
}

async function submitRepository({ studentId, teacherId, repoUrl, groupName, year }) {
  const parsedStudentId = Number.parseInt(studentId, 10);
  const parsedTeacherId = Number.parseInt(teacherId, 10);
  const normalizedGroup = String(groupName || '').trim();
  const normalizedYear = String(year || '').trim().toUpperCase();

  if (Number.isNaN(parsedStudentId)) throw new AppError('Invalid student id', 400, 'VALIDATION_ERROR');
  if (!repoUrl || !String(repoUrl).includes('github.com')) throw new AppError('Invalid GitHub URL', 400, 'VALIDATION_ERROR');
  if (Number.isNaN(parsedTeacherId)) throw new AppError('Teacher selection is required', 400, 'VALIDATION_ERROR');
  if (!normalizedGroup) throw new AppError('Group is required', 400, 'VALIDATION_ERROR');
  if (!normalizedYear) throw new AppError('Year/level is required', 400, 'VALIDATION_ERROR');

  const teacher = await prisma.teacher.findUnique({ where: { id: parsedTeacherId } });
  if (!teacher) throw new AppError('Selected teacher does not exist', 400, 'VALIDATION_ERROR');

  const updated = await prisma.student.updateMany({
    where: { id: parsedStudentId },
    data: {
      teacherId: parsedTeacherId,
      groupName: normalizedGroup,
      year: normalizedYear
    }
  });

  if (!updated.count) throw new AppError('Student not found', 404, 'NOT_FOUND');

  const submission = await prisma.submission.create({
    data: {
      studentId: parsedStudentId,
      teacherId: parsedTeacherId,
      repoUrl,
      status: 'SUBMITTED'
    }
  });

  return {
    message: 'Submission received. Waiting for automated evaluation.',
    submissionId: submission.id
  };
}

function mapSubmission(row) {
  return {
    id: row.id,
    repo_url: row.repoUrl,
    submission_date: row.submissionDate,
    status: String(row.status || '').toLowerCase() === 'done' ? 'completed' : String(row.status || '').toLowerCase(),
    grade: row.computedGrade,
    evaluation_notes: row.evaluationNotes,
    teacher_feedback: row.teacherFeedback,
    correction_context: row.correctionContext,
    test_results: (Array.isArray(row.testResults) ? row.testResults : []).map((test) => ({
      id: test.id,
      test_name: test.testName,
      test_type: test.testType,
      language: test.language,
      function_name: test.functionName,
      passed: test.passed,
      weight: test.weight,
      score_earned: test.scoreEarned,
      duration_ms: test.durationMs,
      error_message: test.errorMessage
    }))
  };
}

async function listStudentSubmissions(studentId) {
  const parsedStudentId = Number.parseInt(studentId, 10);
  if (Number.isNaN(parsedStudentId)) throw new AppError('Invalid student id', 400, 'VALIDATION_ERROR');

  const rows = await prisma.submission.findMany({
    where: { studentId: parsedStudentId },
    include: { testResults: true },
    orderBy: { submissionDate: 'desc' }
  });

  return rows.map(mapSubmission);
}

async function listApprovedStudentGrades(studentId) {
  const parsedStudentId = Number.parseInt(studentId, 10);
  if (Number.isNaN(parsedStudentId)) throw new AppError('Invalid student id', 400, 'VALIDATION_ERROR');

  const rows = await prisma.submission.findMany({
    where: {
      studentId: parsedStudentId,
      status: 'APPROVED'
    },
    include: { testResults: true },
    orderBy: { submissionDate: 'desc' }
  });

  return rows.map(mapSubmission);
}

async function getStudentRequirements(studentId) {
  const parsedStudentId = Number.parseInt(studentId, 10);
  if (Number.isNaN(parsedStudentId)) throw new AppError('Invalid student id', 400, 'VALIDATION_ERROR');

  const student = await prisma.student.findUnique({
    where: { id: parsedStudentId },
    select: { groupName: true, year: true }
  });

  if (!student) throw new AppError('Student not found', 404, 'NOT_FOUND');
  const suite = await getSuiteByGroupYear(student.groupName, student.year);
  if (!suite) {
    return {
      groupName: student.groupName,
      year: student.year,
      tests: [],
      requiredFunctions: []
    };
  }

  return {
    groupName: suite.groupName,
    year: suite.year,
    name: suite.name,
    language: suite.definition.language || 'auto',
    requiredFunctions: suite.definition.requiredFunctions || [],
    tests: suite.definition.tests || []
  };
}

module.exports = {
  loginOrRegisterStudent,
  submitRepository,
  listStudentSubmissions,
  listApprovedStudentGrades,
  getStudentRequirements
};
