const RepoRetriever = require('./RepoRetriever');
const TestExecutor = require('./TestExecutor');
const FeedbackGenerator = require('./FeedbackGenerator');
const submissionModel = require('../models/submissionModel');
const prisma = require('../config/prisma');
const logger = require('../config/logger');
const { gradingDuration, gradingFailures } = require('../utils/metrics');
const { getSuiteByGroupYear } = require('../services/testSuiteService');
const { generateFeedbackFromTests } = require('../services/aiService');

class WorkflowManager {
  constructor(deps = {}) {
    this.repoRetriever = deps.repoRetriever || new RepoRetriever();
    this.testExecutor = deps.testExecutor || new TestExecutor();
    this.feedbackGenerator = deps.feedbackGenerator || new FeedbackGenerator();
  }

  async runGrading({ submissionId, requestId }) {
    const timer = gradingDuration.startTimer();

    try {
      const submission = await submissionModel.findById(submissionId);
      if (!submission) throw new Error('Submission not found');

      await submissionModel.updateStatus(submissionId, 'PROCESSING');

      const suite = await getSuiteByGroupYear(submission.student.groupName, submission.student.year);
      if (!suite) {
        throw new Error(
          `No active test suite found for group "${submission.student.groupName}" and year "${submission.student.year}"`
        );
      }

      const repoData = await this.repoRetriever.run({ repoUrl: submission.repoUrl });
      const testExecution = await this.testExecutor.run({
        repoData,
        testSuite: suite
      });

      const finalGrade = Number(testExecution.grade || 0);
      const failedTests = testExecution.results.filter((item) => !item.passed).map((item) => item.testName);
      const feedbackNarrative = await generateFeedbackFromTests({
        studentName: submission.student.name,
        finalGrade,
        testSummary: testExecution.summary,
        failedTests,
        requestId
      });
      const evaluationNotes = this.feedbackGenerator.run({
        finalGrade,
        testExecution,
        aiNarrative: feedbackNarrative
      });

      await prisma.testResult.deleteMany({ where: { submissionId: submission.id } });
      if (testExecution.results.length > 0) {
        await prisma.testResult.createMany({
          data: testExecution.results.map((item) => ({
            submissionId: submission.id,
            testName: item.testName,
            testType: item.testType,
            language: item.language || testExecution.language || null,
            functionName: item.functionName || null,
            passed: Boolean(item.passed),
            weight: Number(item.weight || 0),
            scoreEarned: Number(item.scoreEarned || 0),
            durationMs: Number(item.durationMs || 0),
            errorMessage: item.errorMessage || null,
            detailsJson: item.details ? JSON.stringify(item.details) : null
          }))
        });
      }

      await prisma.submission.update({
        where: {
          id: submission.id
        },
        data: {
          status: 'DONE',
          computedGrade: finalGrade,
          evaluationNotes
        }
      });

      timer({ status: 'done' });
      return {
        status: 'DONE',
        grade: finalGrade,
        evaluationNotes
      };
    } catch (error) {
      gradingFailures.inc({ reason: 'workflow_error' });
      timer({ status: 'failed' });
      logger.error({ requestId, submissionId, err: error.message }, 'Workflow grading failed');
      await prisma.submission.updateMany({
        where: { id: submissionId },
        data: {
          status: 'FAILED',
          computedGrade: 0,
          evaluationNotes: `Automated grading failed: ${error.message}`
        }
      });
      return {
        status: 'FAILED',
        grade: 0,
        evaluationNotes: `Automated grading failed: ${error.message}`
      };
    }
  }
}

module.exports = WorkflowManager;
