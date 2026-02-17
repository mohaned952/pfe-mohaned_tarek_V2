class FeedbackGenerator {
  run({ finalGrade, testExecution, aiNarrative }) {
    const failedTests = (Array.isArray(testExecution?.results) ? testExecution.results : []).filter((item) => !item.passed);
    return [
      'Automated Test Evaluation',
      '=========================',
      `Final Grade: ${Number(finalGrade || 0).toFixed(2)}/20`,
      `Tests Passed: ${Number(testExecution?.totals?.passed || 0)}`,
      `Tests Failed: ${Number(testExecution?.totals?.failed || 0)}`,
      '',
      'Failed Tests:',
      failedTests.length
        ? failedTests.map((item, index) => `${index + 1}. ${item.testName} (${item.errorMessage || 'assertion failed'})`).join('\n')
        : 'No failed tests.',
      '',
      'Detailed Feedback:',
      String(aiNarrative || '').trim() || 'No narrative generated. Review failed tests above.'
    ].join('\n');
  }
}

module.exports = FeedbackGenerator;
