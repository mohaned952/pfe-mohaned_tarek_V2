class GradeAgent {
  compute(results) {
    const totals = results.reduce(
      (acc, item) => ({
        score: acc.score + Number(item.score || 0),
        max: acc.max + Number(item.maxScore || 0),
        passed: acc.passed + (item.passed ? 1 : 0),
        failed: acc.failed + (item.passed ? 0 : 1)
      }),
      { score: 0, max: 0, passed: 0, failed: 0 }
    );

    const grade = totals.max > 0 ? Number(((totals.score / totals.max) * 20).toFixed(2)) : 0;
    return { ...totals, grade };
  }
}

module.exports = GradeAgent;
