const prisma = require('../config/prisma');
const { enqueueGrading } = require('./gradingQueueService');
const { AppError } = require('../utils/errors');

async function startSingleCorrection({ submissionId, teacherId, instructions, requestId }) {
  const submission = await prisma.submission.findUnique({ where: { id: submissionId }, include: { student: true } });
  if (!submission) throw new AppError('Submission not found', 404, 'NOT_FOUND');

  const ownerTeacherId = submission.teacherId || submission.student.teacherId;
  if (ownerTeacherId !== teacherId) {
    throw new AppError('You are not allowed to correct this submission', 403, 'FORBIDDEN');
  }

  const normalizedInstructions = String(instructions || '').trim();
  if (normalizedInstructions) {
    await prisma.submission.update({
      where: { id: submissionId },
      data: { correctionContext: normalizedInstructions }
    });
  }

  await enqueueGrading({ submissionId, requestId });
  return { submissionId, status: 'QUEUED' };
}

async function startBulkCorrection({ teacherId, filters = {}, instructions, requestId }) {
  const normalizedInstructions = String(instructions || '').trim();

  const rows = await prisma.submission.findMany({
    where: {
      OR: [{ teacherId }, { student: { is: { teacherId } } }],
      status: { in: ['SUBMITTED', 'DONE', 'FAILED'] }
    },
    include: {
      student: true
    }
  });

  const filteredRows = rows.filter((row) => {
    if (filters.group && row.student?.groupName !== filters.group) return false;
    if (filters.year && row.student?.year !== filters.year) return false;
    if (filters.studentName) {
      const normalized = String(filters.studentName).toLowerCase();
      const studentName = String(row.student?.name || '').toLowerCase();
      if (!studentName.includes(normalized)) return false;
    }
    return true;
  });
  let queued = 0;

  for (const row of filteredRows) {
    if (normalizedInstructions) {
      await prisma.submission.update({
        where: { id: row.id },
        data: { correctionContext: normalizedInstructions }
      });
    }
    await enqueueGrading({ submissionId: row.id, requestId });
    queued += 1;
  }

  return { queued };
}

module.exports = {
  startSingleCorrection,
  startBulkCorrection
};
