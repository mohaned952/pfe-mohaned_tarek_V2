const prisma = require('../config/prisma');

async function teacherAnalytics() {
  const [total, completed, avg] = await Promise.all([
    prisma.submission.count(),
    prisma.submission.count({ where: { status: 'COMPLETED' } }),
    prisma.submission.aggregate({ _avg: { grade: true } })
  ]);

  return {
    totalSubmissions: total,
    completedSubmissions: completed,
    averageGrade: Number(avg._avg.grade || 0).toFixed(2)
  };
}

module.exports = { teacherAnalytics };
