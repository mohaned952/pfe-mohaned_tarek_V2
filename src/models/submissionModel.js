const prisma = require('../config/prisma');

const submissionModel = {
  async findById(submissionId) {
    return prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        student: true
      }
    });
  },

  async updateStatus(id, status) {
    await prisma.submission.update({
      where: { id },
      data: { status }
    });
    return 1;
  }
};

module.exports = submissionModel;
