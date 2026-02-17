const githubService = require('../../src/services/githubService');

describe('GithubService retry policy', () => {
  test('isRetryable handles network codes', () => {
    expect(githubService.isRetryable({ code: 'ETIMEDOUT' })).toBe(true);
    expect(githubService.isRetryable({ response: { status: 500 } })).toBe(true);
    expect(githubService.isRetryable({ response: { status: 404 } })).toBe(false);
  });
});
