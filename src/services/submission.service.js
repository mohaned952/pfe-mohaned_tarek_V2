const prisma = require('../config/prisma');
const WorkflowAgent = require('../agents/workflow-agent');
const { getActiveSuiteForTeacher } = require('./suite.service');

const workflowAgent = new WorkflowAgent({});

async function listTeachers() {
  return prisma.user.findMany({
    where: { role: 'TEACHER' },
    select: { id: true, username: true, email: true },
    orderBy: { username: 'asc' }
  });
}

async function createSubmission({ studentId, teacherId, repoUrl, repoBranch, language }) {
  const normalizedLanguage = String(language || '').trim().toLowerCase();
  if (!String(repoUrl || '').trim()) throw new Error('Repository URL is required');
  if (!['c', 'php', 'javascript', 'java', 'html-css'].includes(normalizedLanguage)) {
    throw new Error('Unsupported language');
  }

  const teacherIdNumber = Number(teacherId);
  if (!Number.isInteger(teacherIdNumber) || teacherIdNumber <= 0) {
    throw new Error('Teacher selection is required');
  }

  const teacher = await prisma.user.findFirst({ where: { id: teacherIdNumber, role: 'TEACHER' } });
  if (!teacher) throw new Error('Selected teacher was not found');

  return prisma.submission.create({
    data: {
      studentId,
      evaluatorId: teacherIdNumber,
      repoUrl: String(repoUrl || '').trim(),
      repoBranch: String(repoBranch || 'main').trim(),
      language: normalizedLanguage,
      status: 'PENDING'
    }
  });
}

async function listStudentSubmissions(studentId) {
  return prisma.submission.findMany({
    where: { studentId },
    include: {
      results: true,
      feedback: true,
      evaluator: { select: { id: true, username: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
}

async function getStudentSubmission({ studentId, submissionId }) {
  return prisma.submission.findFirst({
    where: { id: submissionId, studentId },
    include: { results: true, feedback: true }
  });
}

async function listTeacherSubmissions(teacherId) {
  return prisma.submission.findMany({
    where: { evaluatorId: Number(teacherId) },
    include: {
      student: { select: { id: true, username: true, email: true } },
      evaluator: { select: { id: true, username: true } },
      results: true,
      feedback: true
    },
    orderBy: { createdAt: 'desc' }
  });
}

async function gradeOne({ teacherId, submissionId }) {
  const submission = await prisma.submission.findUnique({ where: { id: submissionId } });
  if (!submission) throw new Error('Submission not found');
  if (submission.evaluatorId && Number(submission.evaluatorId) !== Number(teacherId)) {
    const error = new Error('This submission is assigned to another teacher');
    error.status = 403;
    throw error;
  }

  await prisma.submission.update({
    where: { id: submission.id },
    data: { status: 'PROCESSING', evaluatorId: Number(teacherId) }
  });

  const suite = await getActiveSuiteForTeacher({ teacherId, language: submission.language });
  const graded = await workflowAgent.gradeSubmission({ submission, suiteDefinition: suite });

  await prisma.testResult.deleteMany({ where: { submissionId: submission.id } });
  if (graded.results.length) {
    await prisma.testResult.createMany({
      data: graded.results.map((item) => ({
        submissionId: submission.id,
        name: item.name,
        passed: item.passed,
        score: Number(item.score || 0),
        maxScore: Number(item.maxScore || 0),
        runtimeMs: Number(item.runtimeMs || 0),
        output: item.output,
        error: item.error
      }))
    });
  }

  await prisma.feedback.upsert({
    where: { submissionId: submission.id },
    create: {
      submissionId: submission.id,
      authorId: teacherId,
      summary: graded.feedback.summary,
      strengthsJson: JSON.stringify(graded.feedback.strengths),
      improvementsJson: JSON.stringify(graded.feedback.improvements)
    },
    update: {
      authorId: teacherId,
      summary: graded.feedback.summary,
      strengthsJson: JSON.stringify(graded.feedback.strengths),
      improvementsJson: JSON.stringify(graded.feedback.improvements)
    }
  });

  return prisma.submission.update({
    where: { id: submission.id },
    data: {
      status: 'COMPLETED',
      grade: graded.totals.grade,
      evaluatorId: teacherId,
      commitSha: graded.commitSha || null
    },
    include: {
      results: true,
      feedback: true,
      student: { select: { id: true, username: true, email: true } }
    }
  });
}

module.exports = {
  listTeachers,
  createSubmission,
  listStudentSubmissions,
  getStudentSubmission,
  listTeacherSubmissions,
  gradeOne
};
