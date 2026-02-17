const { z } = require('zod');

const startCorrectionSchema = z.object({
  submissionId: z.number().int().positive(),
  teacherId: z.number().int().positive()
});

const bulkCorrectionSchema = z.object({
  teacherId: z.number().int().positive(),
  filters: z
    .object({
      group: z.string().optional().default(''),
      year: z.string().optional().default(''),
      studentName: z.string().optional().default('')
    })
    .optional()
    .default({})
});

module.exports = {
  startCorrectionSchema,
  bulkCorrectionSchema
};
