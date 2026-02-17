const prisma = require('../../src/config/prisma');
const teacherService = require('../../src/services/teacherPortalService');

describe('Grading integrity policy', () => {
  const suffix = Date.now();
  let teacherId;
  let studentId;
  let submissionId;
  const baselineGrade = 13.5;

  beforeAll(async () => {
    const teacher = await prisma.teacher.create({
      data: {
        name: `integrity-teacher-${suffix}`,
        email: `integrity-teacher-${suffix}@local`,
        password: 'hashed-password-placeholder'
      }
    });
    teacherId = teacher.id;

    const student = await prisma.student.create({
      data: {
        name: `integrity-student-${suffix}`,
        email: `integrity-student-${suffix}@local`,
        groupName: 'G-INT',
        year: 'L3',
        password: 'password',
        teacherId
      }
    });
    studentId = student.id;

    const submission = await prisma.submission.create({
      data: {
        studentId,
        teacherId,
        repoUrl: 'https://github.com/example/integrity',
        status: 'DONE',
        computedGrade: baselineGrade,
        evaluationNotes: 'Automated evaluation baseline'
      }
    });
    submissionId = submission.id;
  });

  afterAll(async () => {
    if (submissionId) {
      await prisma.testResult.deleteMany({ where: { submissionId } }).catch(() => null);
      await prisma.submission.deleteMany({ where: { id: submissionId } }).catch(() => null);
    }
    if (studentId) {
      await prisma.student.deleteMany({ where: { id: studentId } }).catch(() => null);
    }
    if (teacherId) {
      await prisma.teacher.deleteMany({ where: { id: teacherId } }).catch(() => null);
    }
    await prisma.$disconnect();
  });

  test('manual grade override is rejected and computed grade remains unchanged', async () => {
    await expect(
      teacherService.approveSubmission({
        submissionId,
        teacherId,
        teacherFeedback: 'Manual override attempt',
        grade: 4
      })
    ).rejects.toThrow('Manual grade override is forbidden');

    const afterRejected = await prisma.submission.findUnique({ where: { id: submissionId } });
    expect(afterRejected.computedGrade).toBe(baselineGrade);
    expect(String(afterRejected.status).toLowerCase()).toBe('done');

    await expect(
      teacherService.approveSubmission({
        submissionId,
        teacherId,
        teacherFeedback: 'Approved without grade override'
      })
    ).resolves.toEqual({ message: 'Grade approved and visible to student.' });

    const afterApproval = await prisma.submission.findUnique({ where: { id: submissionId } });
    expect(afterApproval.computedGrade).toBe(baselineGrade);
    expect(String(afterApproval.status).toLowerCase()).toBe('approved');
  });
});
