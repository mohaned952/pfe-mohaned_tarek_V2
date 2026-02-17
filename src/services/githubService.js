const axios = require('axios');
const env = require('../config/env');

class GithubService {
  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.github.com',
      timeout: 15000,
      headers: {
        ...(env.GITHUB_TOKEN ? { Authorization: `token ${env.GITHUB_TOKEN}` } : {}),
        Accept: 'application/vnd.github.v3+json'
      }
    });
  }

  isRetryable(error) {
    const status = error?.response?.status;
    const code = String(error?.code || '').toUpperCase();
    return status === 429 || status >= 500 || ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND'].includes(code);
  }

  async withRetry(fn, retries = 3) {
    let failure = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await fn();
      } catch (error) {
        failure = error;
        if (attempt >= retries || !this.isRetryable(error)) throw error;
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
    throw failure;
  }

  parseRepoUrl(repoUrl) {
    const clean = String(repoUrl || '').replace(/\.git$/i, '').replace(/\/$/, '');
    const match = clean.match(/github\.com\/([^/]+)\/([^/]+)/i);
    if (!match) throw new Error('Invalid GitHub repository URL');
    return { owner: match[1], repo: match[2] };
  }

  async getRepoSummary(repoUrl) {
    const { owner, repo } = this.parseRepoUrl(repoUrl);
    const repoMeta = await this.withRetry(() => this.client.get(`/repos/${owner}/${repo}`));
    const branch = repoMeta.data.default_branch || 'main';
    const tree = await this.withRetry(() => this.client.get(`/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`));

    const sourceFiles = (tree.data.tree || [])
      .filter((entry) => entry.type === 'blob' && /\.(js|ts|java|c|go|rs|php|cs|sql|html|css)$/i.test(entry.path))
      .slice(0, 60);

    const snippets = [];
    const files = [];
    for (const file of sourceFiles) {
      try {
        const encodedPath = file.path.split('/').map((chunk) => encodeURIComponent(chunk)).join('/');
        const data = await this.withRetry(() => this.client.get(`/repos/${owner}/${repo}/contents/${encodedPath}`));
        const content = Buffer.from(data.data.content || '', 'base64').toString('utf8').slice(0, 8000);
        snippets.push({ path: file.path, snippet: content });
        files.push({ path: file.path, content });
      } catch (_error) {
        // best-effort
      }
    }

    return {
      owner,
      repo,
      defaultBranch: branch,
      snippets,
      files
    };
  }
}

module.exports = new GithubService();
