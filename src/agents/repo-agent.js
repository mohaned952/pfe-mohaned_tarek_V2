const axios = require('axios');
const env = require('../config/env');
const { AppError } = require('../utils/errors');

class RepoAgent {
  constructor() {
    this.client = axios.create({
      baseURL: env.GITHUB_API_URL,
      timeout: 15000,
      headers: {
        Accept: 'application/vnd.github+json',
        ...(env.GITHUB_TOKEN ? { Authorization: `Bearer ${env.GITHUB_TOKEN}` } : {})
      }
    });
  }

  parseRepoUrl(repoUrl) {
    const clean = String(repoUrl || '').replace(/\.git$/i, '').replace(/\/$/, '');
    const match = clean.match(/github\.com\/([^/]+)\/([^/]+)/i);
    if (!match) throw new AppError('Invalid GitHub repository URL', 400);
    return { owner: match[1], repo: match[2] };
  }

  async fetchRepository({ repoUrl, branch = 'main' }) {
    const { owner, repo } = this.parseRepoUrl(repoUrl);
    const tree = await this.client.get(`/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);

    const sourceFiles = (tree.data.tree || [])
      .filter((item) => item.type === 'blob' && /\.(js|cjs|mjs|c|php|java|html|css)$/i.test(item.path))
      .slice(0, 120);

    const files = [];
    for (const item of sourceFiles) {
      try {
        const encoded = item.path.split('/').map((part) => encodeURIComponent(part)).join('/');
        const response = await this.client.get(`/repos/${owner}/${repo}/contents/${encoded}?ref=${encodeURIComponent(branch)}`);
        files.push({
          path: item.path,
          content: Buffer.from(response.data.content || '', 'base64').toString('utf8').slice(0, 100000)
        });
      } catch (_error) {
        // Best effort: keep moving even if one file fails.
      }
    }

    if (!files.length) throw new AppError('No supported source files found in repository', 400);
    return { owner, repo, branch, files };
  }
}

module.exports = RepoAgent;
