const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

const SUPPORTED_LANGUAGES = new Set(['javascript', 'c', 'php', 'java', 'html-css']);

function normalizeLanguage(input) {
  const raw = String(input || '').trim().toLowerCase();
  if (['js', 'javascript', 'node'].includes(raw)) return 'javascript';
  if (raw === 'c') return 'c';
  if (raw === 'php') return 'php';
  if (raw === 'java') return 'java';
  if (['html', 'css', 'html-css', 'frontend'].includes(raw)) return 'html-css';
  return '';
}

function resolveFile(files, preferredPath, fallbackExt) {
  if (preferredPath) {
    const found = files.find((f) => f.path === preferredPath);
    if (found) return found.path;
  }
  const candidate = files.find((f) => fallbackExt.some((ext) => f.path.toLowerCase().endsWith(ext)));
  return candidate ? candidate.path : null;
}

function run(command, args, cwd, timeoutMs, stdin = null) {
  return new Promise((resolve) => {
    const start = Date.now();
    const child = spawn(command, args, { cwd, shell: false });
    let stdout = '';
    let stderr = '';
    let closed = false;

    const timer = setTimeout(() => {
      if (closed) return;
      closed = true;
      child.kill('SIGKILL');
      resolve({ code: 124, stdout, stderr: `Execution timed out after ${timeoutMs}ms`, runtimeMs: Date.now() - start });
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('error', (error) => {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      resolve({ code: 1, stdout, stderr: String(error.message || error), runtimeMs: Date.now() - start });
    });

    child.on('close', (code) => {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      resolve({ code: Number(code || 0), stdout, stderr, runtimeMs: Date.now() - start });
    });

    if (stdin !== null && stdin !== undefined) {
      child.stdin.write(String(stdin));
      child.stdin.end();
    }
  });
}

class TestAgent {
  async createWorkspace(files) {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'pfe-sandbox-'));
    for (const file of files) {
      const safePath = path.normalize(file.path).replace(/^([.][.][/\\])+/, '');
      const target = path.join(workspace, safePath);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, file.content, 'utf8');
    }
    return workspace;
  }

  async runSuite({ files, language, suiteDefinition }) {
    const normalizedLanguage = normalizeLanguage(language || suiteDefinition.language);
    if (!SUPPORTED_LANGUAGES.has(normalizedLanguage)) {
      throw new Error(`Unsupported language: ${language}`);
    }

    const tests = Array.isArray(suiteDefinition.tests) ? suiteDefinition.tests : [];
    if (!tests.length) throw new Error('No tests configured');

    const workspace = await this.createWorkspace(files);
    const results = [];

    try {
      for (const test of tests) {
        const one = await this.executeTest({ workspace, files, language: normalizedLanguage, test, suiteDefinition });
        results.push(one);
      }
      return results;
    } finally {
      await fs.rm(workspace, { recursive: true, force: true }).catch(() => null);
    }
  }

  async executeTest({ workspace, files, language, test, suiteDefinition }) {
    const maxScore = Number(test.maxScore || test.weight || 1);
    const timeoutMs = Math.max(200, Number(test.timeoutMs || 3000));

    if (language === 'html-css') {
      const source = files.map((f) => f.content).join('\n');
      const pattern = String(test.pattern || test.contains || '').trim();
      const passed = pattern ? source.includes(pattern) : false;
      return {
        name: String(test.name || 'HTML/CSS rule'),
        passed,
        score: passed ? maxScore : 0,
        maxScore,
        runtimeMs: 0,
        output: passed ? `Pattern found: ${pattern}` : null,
        error: passed ? null : `Pattern not found: ${pattern}`
      };
    }

    if (language === 'javascript' && test.functionName) {
      const entrypoint = resolveFile(files, test.entrypoint || suiteDefinition.entrypoint, ['.js', '.cjs', '.mjs']);
      if (!entrypoint) return { name: test.name, passed: false, score: 0, maxScore, runtimeMs: 0, output: null, error: 'JS entrypoint not found' };
      const harness = path.join(workspace, '__harness.js');
      const payload = JSON.stringify({
        functionName: test.functionName,
        inputs: test.inputs || [],
        expectedOutput: test.expectedOutput
      });

      await fs.writeFile(
        harness,
        `const target=require('./${entrypoint.replace(/\\/g, '/')}');\nconst p=${payload};\nconst fn=target[p.functionName]||target.default?.[p.functionName]||(typeof target==='function'?target:null);\nif(typeof fn!=='function'){console.error('Function not found');process.exit(2);}\nPromise.resolve(fn(...p.inputs)).then((actual)=>{const pass=JSON.stringify(actual)===JSON.stringify(p.expectedOutput);console.log(JSON.stringify({pass,actual}));process.exit(pass?0:3);}).catch((e)=>{console.error(String(e&&e.message?e.message:e));process.exit(4);});`,
        'utf8'
      );
      const result = await run('node', ['__harness.js'], workspace, timeoutMs);
      const passed = result.code === 0;
      return {
        name: String(test.name || 'JavaScript test'),
        passed,
        score: passed ? maxScore : 0,
        maxScore,
        runtimeMs: result.runtimeMs,
        output: result.stdout.trim() || null,
        error: passed ? null : result.stderr.trim() || `Exit code ${result.code}`
      };
    }

    if (language === 'c') {
      const entrypoint = resolveFile(files, test.entrypoint || suiteDefinition.entrypoint, ['.c']);
      if (!entrypoint) return { name: test.name, passed: false, score: 0, maxScore, runtimeMs: 0, output: null, error: 'C entrypoint not found' };
      const compiled = await run('gcc', [entrypoint, '-o', 'main'], workspace, timeoutMs);
      if (compiled.code !== 0) {
        return { name: String(test.name || 'C test'), passed: false, score: 0, maxScore, runtimeMs: compiled.runtimeMs, output: null, error: compiled.stderr.trim() || 'Compilation failed' };
      }
      const executed = await run(process.platform === 'win32' ? 'main.exe' : './main', [], workspace, timeoutMs, test.stdin || null);
      const passed = String(executed.stdout || '').trim() === String(test.expectedOutput || '').trim();
      return {
        name: String(test.name || 'C test'),
        passed,
        score: passed ? maxScore : 0,
        maxScore,
        runtimeMs: executed.runtimeMs,
        output: executed.stdout.trim() || null,
        error: passed ? null : executed.stderr.trim() || 'Unexpected output'
      };
    }

    if (language === 'php') {
      const entrypoint = resolveFile(files, test.entrypoint || suiteDefinition.entrypoint, ['.php']);
      if (!entrypoint) return { name: test.name, passed: false, score: 0, maxScore, runtimeMs: 0, output: null, error: 'PHP entrypoint not found' };
      const executed = await run('php', [entrypoint], workspace, timeoutMs, test.stdin || null);
      const passed = String(executed.stdout || '').trim() === String(test.expectedOutput || '').trim();
      return {
        name: String(test.name || 'PHP test'),
        passed,
        score: passed ? maxScore : 0,
        maxScore,
        runtimeMs: executed.runtimeMs,
        output: executed.stdout.trim() || null,
        error: passed ? null : executed.stderr.trim() || 'Unexpected output'
      };
    }

    const entrypoint = resolveFile(files, test.entrypoint || suiteDefinition.entrypoint, ['.java']);
    if (!entrypoint) return { name: test.name, passed: false, score: 0, maxScore, runtimeMs: 0, output: null, error: 'Java entrypoint not found' };
    const compile = await run('javac', [entrypoint], workspace, timeoutMs);
    if (compile.code !== 0) {
      return { name: String(test.name || 'Java test'), passed: false, score: 0, maxScore, runtimeMs: compile.runtimeMs, output: null, error: compile.stderr.trim() || 'Compilation failed' };
    }

    const className = path.basename(entrypoint, '.java');
    const execute = await run('java', ['-cp', path.dirname(entrypoint), className], workspace, timeoutMs, test.stdin || null);
    const passed = String(execute.stdout || '').trim() === String(test.expectedOutput || '').trim();

    return {
      name: String(test.name || 'Java test'),
      passed,
      score: passed ? maxScore : 0,
      maxScore,
      runtimeMs: execute.runtimeMs,
      output: execute.stdout.trim() || null,
      error: passed ? null : execute.stderr.trim() || 'Unexpected output'
    };
  }
}

module.exports = TestAgent;
