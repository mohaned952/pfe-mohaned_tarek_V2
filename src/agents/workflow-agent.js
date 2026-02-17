const RepoAgent = require('./repo-agent');
const TestAgent = require('./test-agent');
const GradeAgent = require('./grade-agent');
const FeedbackAgent = require('./feedback-agent');

class WorkflowAgent {
  constructor({ repoAgent, testAgent, gradeAgent, feedbackAgent }) {
    this.repoAgent = repoAgent || new RepoAgent();
    this.testAgent = testAgent || new TestAgent();
    this.gradeAgent = gradeAgent || new GradeAgent();
    this.feedbackAgent = feedbackAgent || new FeedbackAgent();
  }

  async gradeSubmission({ submission, suiteDefinition }) {
    const repo = await this.repoAgent.fetchRepository({ repoUrl: submission.repoUrl, branch: submission.repoBranch });
    const results = await this.testAgent.runSuite({
      files: repo.files,
      language: submission.language,
      suiteDefinition
    });
    const totals = this.gradeAgent.compute(results);
    const feedback = this.feedbackAgent.build({ results, totals, language: submission.language });

    return {
      commitSha: null,
      results,
      totals,
      feedback
    };
  }
}

module.exports = WorkflowAgent;
