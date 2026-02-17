const githubService = require('../services/githubService');

class RepoRetriever {
  async run({ repoUrl }) {
    const summary = await githubService.getRepoSummary(repoUrl);
    return {
      ...summary,
      files: Array.isArray(summary.files) ? summary.files : [],
      mergedCode: summary.snippets.map((item) => `FILE: ${item.path}\n${item.snippet}`).join('\n\n---\n\n')
    };
  }
}

module.exports = RepoRetriever;
