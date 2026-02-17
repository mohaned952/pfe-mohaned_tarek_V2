class FeedbackAgent {
  build({ results, totals, language }) {
    const failed = results.filter((item) => !item.passed);
    const strengths = results.filter((item) => item.passed).slice(0, 5).map((item) => `${item.name} passed`);
    const improvements = failed.slice(0, 5).map((item) => `${item.name}: ${item.error || 'Needs correction'}`);

    const summary = failed.length
      ? `${totals.passed}/${results.length} tests passed in ${language}. Focus on failed checks before resubmitting.`
      : `Excellent work: all ${results.length} tests passed in ${language}.`;

    return {
      summary,
      strengths,
      improvements
    };
  }
}

module.exports = FeedbackAgent;
