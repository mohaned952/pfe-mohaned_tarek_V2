const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const env = require('../config/env');

const LANGUAGE_EXTENSIONS = {
  javascript: ['.js', '.cjs', '.mjs'],
  java: ['.java'],
  c: ['.c'],
  php: ['.php']
};

const DOCKER_IMAGES = {
  javascript: 'node:20-bookworm-slim',
  java: 'eclipse-temurin:17-jdk',
  c: 'gcc:13',
  php: 'php:8.3-cli'
};

function deepEqual(left, right) {
  if (left === right) return true;
  if (typeof left !== typeof right) return false;
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return false;
    return left.every((item, index) => deepEqual(item, right[index]));
  }
  if (left && right && typeof left === 'object') {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) return false;
    return leftKeys.every((key) => deepEqual(left[key], right[key]));
  }
  return false;
}

function normalizeLanguage(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (['js', 'node', 'nodejs', 'javascript'].includes(raw)) return 'javascript';
  if (['java'].includes(raw)) return 'java';
  if (['c'].includes(raw)) return 'c';
  if (['php'].includes(raw)) return 'php';
  return '';
}

function serializeError(error) {
  if (!error) return 'Unknown error';
  return String(error.message || error);
}

function sanitizeRelativePath(rawPath) {
  const normalized = path.normalize(String(rawPath || '')).replace(/\\/g, '/');
  if (!normalized || normalized.startsWith('..') || path.isAbsolute(normalized)) {
    return null;
  }
  return normalized;
}

function commandFromShellString(rawCommand) {
  const line = String(rawCommand || '').trim();
  if (!line) return null;
  const parts = line.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  if (!parts.length) return null;
  const command = parts[0].replace(/^"|"$/g, '');
  const args = parts.slice(1).map((item) => item.replace(/^"|"$/g, ''));
  return { command, args };
}

class TestExecutor {
  constructor() {
    this.executionMode = String(env.TEST_EXECUTION_MODE || 'local').trim().toLowerCase();
    this.languageRuntimeChecked = new Set();
  }

  detectLanguage(files = [], testSuite = {}) {
    const suiteLanguage = normalizeLanguage(testSuite?.definition?.language);
    if (suiteLanguage) return suiteLanguage;

    const counts = { javascript: 0, java: 0, c: 0, php: 0 };
    for (const file of files) {
      const ext = path.extname(String(file.path || '')).toLowerCase();
      if (LANGUAGE_EXTENSIONS.javascript.includes(ext)) counts.javascript += 1;
      if (LANGUAGE_EXTENSIONS.java.includes(ext)) counts.java += 1;
      if (LANGUAGE_EXTENSIONS.c.includes(ext)) counts.c += 1;
      if (LANGUAGE_EXTENSIONS.php.includes(ext)) counts.php += 1;
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[1] > 0 ? sorted[0][0] : 'javascript';
  }

  async createWorkspace(files = []) {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'pfe-exec-'));
    for (const file of files) {
      const relativePath = sanitizeRelativePath(file.path);
      if (!relativePath) continue;
      const absolutePath = path.join(workspace, relativePath);
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, String(file.content || ''), 'utf8');
    }
    return workspace;
  }

  resolveEntrypoint(language, files = [], test = {}, testSuite = {}) {
    const candidates = [test.entrypoint, testSuite?.definition?.entrypoint]
      .map((item) => sanitizeRelativePath(item))
      .filter(Boolean);

    for (const candidate of candidates) {
      if (files.some((file) => sanitizeRelativePath(file.path) === candidate)) {
        return candidate;
      }
    }

    const extensions = LANGUAGE_EXTENSIONS[language] || [];
    const fallback = files.find((file) => extensions.includes(path.extname(String(file.path || '')).toLowerCase()));
    return fallback ? sanitizeRelativePath(fallback.path) : null;
  }

  runLocalCommand({ command, args, cwd, timeoutMs, stdin }) {
    return new Promise((resolve) => {
      const startedAt = process.hrtime.bigint();
      let stdout = '';
      let stderr = '';
      let settled = false;

      const child = spawn(command, args, { cwd, shell: false });
      if (stdin !== undefined && stdin !== null) {
        child.stdin.write(String(stdin));
        child.stdin.end();
      }
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          child.kill('SIGKILL');
          const durationMs = Number((process.hrtime.bigint() - startedAt) / 1000000n);
          resolve({ code: 124, stdout, stderr: `${stderr}\nExecution timed out after ${timeoutMs}ms`, durationMs });
        }
      }, timeoutMs);

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      child.on('error', (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        const durationMs = Number((process.hrtime.bigint() - startedAt) / 1000000n);
        resolve({ code: 1, stdout, stderr: `${stderr}\n${serializeError(error)}`, durationMs });
      });
      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        const durationMs = Number((process.hrtime.bigint() - startedAt) / 1000000n);
        resolve({ code: Number(code || 0), stdout, stderr, durationMs });
      });
    });
  }

  async commandExists(command) {
    const isWindows = process.platform === 'win32';
    const result = await this.runLocalCommand(
      isWindows
        ? {
            command: 'where',
            args: [command],
            cwd: process.cwd(),
            timeoutMs: 1500
          }
        : {
            command: 'sh',
            args: ['-c', `command -v ${command}`],
            cwd: process.cwd(),
            timeoutMs: 1500
          }
    );
    return result.code === 0;
  }

  async ensureLocalLanguageRuntime(language) {
    if (this.executionMode !== 'local') return;
    if (this.languageRuntimeChecked.has(language)) return;

    const oneOfByLanguage = {
      javascript: ['node'],
      java: ['javac', 'java'],
      c: ['gcc'],
      php: ['php']
    };

    const required = oneOfByLanguage[language] || [];
    let available = false;
    for (const tool of required) {
      // For Java we require both compiler and runtime. For others, at least one supported compiler/runtime.
      if (language === 'java') {
        const hasJavac = await this.commandExists('javac');
        const hasJava = await this.commandExists('java');
        available = hasJavac && hasJava;
        break;
      }
      if (await this.commandExists(tool)) {
        available = true;
        break;
      }
    }

    if (!available) {
      const toolLabel = language === 'java' ? 'javac + java' : required.join(' or ');
      throw new Error(
        `Runtime toolchain missing for language "${language}". Required: ${toolLabel}. ` +
          'Install required tools in app/worker container image or switch to docker execution mode.'
      );
    }

    this.languageRuntimeChecked.add(language);
  }

  async runCommand({ language, command, args, cwd, timeoutMs, stdin }) {
    if (this.executionMode !== 'docker') {
      return this.runLocalCommand({ command, args, cwd, timeoutMs, stdin });
    }

    const image = DOCKER_IMAGES[language];
    if (!image) {
      return { code: 1, stdout: '', stderr: `No docker image configured for language ${language}`, durationMs: 0 };
    }

    const dockerArgs = [
      'run',
      '--rm',
      '-i',
      '-v',
      `${cwd}:/workspace`,
      '-w',
      '/workspace',
      image,
      command,
      ...args
    ];
    return this.runLocalCommand({ command: 'docker', args: dockerArgs, cwd, timeoutMs, stdin });
  }

  stdinFromTest(test = {}) {
    if (test.stdin !== undefined && test.stdin !== null) return String(test.stdin);
    if (Array.isArray(test.inputs) && test.inputs.length > 0) {
      return `${test.inputs.map((item) => String(item)).join('\n')}\n`;
    }
    return '';
  }

  async ensureCCompiled({ workspace, files, testSuite, test, runtimeContext }) {
    if (runtimeContext?.cBinaryPath) {
      return { ok: true, binaryPath: runtimeContext.cBinaryPath };
    }
    if (runtimeContext?.cBuildError) {
      return { ok: false, error: runtimeContext.cBuildError };
    }

    const entrypoint = this.resolveEntrypoint('c', files, test, testSuite);
    if (!entrypoint) {
      const missing = 'No C entrypoint found (.c file).';
      runtimeContext.cBuildError = missing;
      return { ok: false, error: missing };
    }

    const binaryPath = path.join(workspace, 'main');
    const compile = await this.runCommand({
      language: 'c',
      command: 'gcc',
      args: [entrypoint, '-o', binaryPath],
      cwd: workspace,
      timeoutMs: Number(test.timeoutMs || 4000)
    });
    if (compile.code !== 0) {
      const message = String(compile.stderr || compile.stdout || 'C compilation failed').trim();
      runtimeContext.cBuildError = message;
      return { ok: false, error: message };
    }

    runtimeContext.cBinaryPath = binaryPath;
    return { ok: true, binaryPath };
  }

  async executeCTest({ workspace, files, testSuite, test, runtimeContext }) {
    const compiled = await this.ensureCCompiled({ workspace, files, testSuite, test, runtimeContext });
    if (!compiled.ok) {
      return { code: 1, stdout: '', stderr: compiled.error };
    }

    if (this.executionMode === 'docker') {
      return this.runCommand({
        language: 'c',
        command: './main',
        args: [],
        cwd: workspace,
        timeoutMs: Number(test.timeoutMs || 4000),
        stdin: this.stdinFromTest(test)
      });
    }

    return this.runLocalCommand({
      command: compiled.binaryPath,
      args: [],
      cwd: workspace,
      timeoutMs: Number(test.timeoutMs || 4000),
      stdin: this.stdinFromTest(test)
    });
  }

  async executePhpTest({ workspace, files, testSuite, test }) {
    const entrypoint = this.resolveEntrypoint('php', files, test, testSuite);
    if (!entrypoint) {
      return { code: 1, stdout: '', stderr: 'No PHP entrypoint found (.php file).' };
    }
    return this.runCommand({
      language: 'php',
      command: 'php',
      args: [entrypoint],
      cwd: workspace,
      timeoutMs: Number(test.timeoutMs || 4000),
      stdin: this.stdinFromTest(test)
    });
  }

  buildJsHarness({ entrypoint, functionName, inputs, expectedOutput }) {
    return `
const target = require('./${entrypoint}');
const fn = target?.['${functionName}'] || target?.default?.['${functionName}'] || (typeof target === 'function' ? target : null);
if (typeof fn !== 'function') {
  console.error(JSON.stringify({ passed: false, errorMessage: 'Function not found: ${functionName}' }));
  process.exit(2);
}
const deepEqual = ${deepEqual.toString()};
Promise.resolve(fn(...${JSON.stringify(inputs || [])}))
  .then((actualOutput) => {
    const expectedOutput = ${JSON.stringify(expectedOutput)};
    const passed = deepEqual(actualOutput, expectedOutput);
    console.log(JSON.stringify({ passed, actualOutput, expectedOutput }));
    process.exit(passed ? 0 : 3);
  })
  .catch((error) => {
    console.error(JSON.stringify({ passed: false, errorMessage: String(error && error.message ? error.message : error) }));
    process.exit(4);
  });
`;
  }

  async executeFunctionTest({ workspace, language, entrypoint, test }) {
    if (!entrypoint) {
      return { code: 1, stdout: '', stderr: `No ${language} entrypoint found for function test` };
    }

    const harnessFile = '__pfe_harness.js';
    const harnessPath = path.join(workspace, harnessFile);
    const source = this.buildJsHarness({
      entrypoint,
      functionName: test.functionName,
      inputs: test.inputs,
      expectedOutput: test.expectedOutput
    });
    await fs.writeFile(harnessPath, source, 'utf8');

    return this.runCommand({
      language,
      command: 'node',
      args: [harnessFile],
      cwd: workspace,
      timeoutMs: Number(test.timeoutMs || 2000)
    });
  }

  async executeCommandTest({ workspace, language, test }) {
    const parsed = commandFromShellString(test.command || test.code);
    if (!parsed) {
      return { code: 1, stdout: '', stderr: 'Missing executable command for this language test' };
    }
    return this.runCommand({
      language,
      command: parsed.command,
      args: parsed.args,
      cwd: workspace,
      timeoutMs: Number(test.timeoutMs || 3000),
      stdin: this.stdinFromTest(test)
    });
  }

  parseRunnerOutput(result) {
    const stdout = String(result.stdout || '').trim();
    const stderr = String(result.stderr || '').trim();
    const lines = stdout.split('\n').map((line) => line.trim()).filter(Boolean);
    const last = lines.length ? lines[lines.length - 1] : '';
    try {
      return { payload: JSON.parse(last), stderr };
    } catch (_error) {
      return { payload: null, stderr };
    }
  }

  async executeSingleTest({ language, workspace, files, testSuite, test, runtimeContext }) {
    const weight = Number(test.weight || 1);
    const entrypoint = this.resolveEntrypoint(language, files, test, testSuite);
    const startedAt = process.hrtime.bigint();
    const base = {
      testName: test.name,
      testType: test.type || 'unit',
      functionName: test.functionName || null,
      language,
      passed: false,
      weight,
      scoreEarned: 0,
      durationMs: 0,
      errorMessage: null,
      details: null
    };

    try {
      let execution;
      if (language === 'javascript' && test.functionName) {
        execution = await this.executeFunctionTest({ workspace, language, entrypoint, test });
      } else if (language === 'c') {
        const hasCustomCommand = String(test.command || test.code || '').trim().length > 0;
        execution = hasCustomCommand
          ? await this.executeCommandTest({ workspace, language, test })
          : await this.executeCTest({ workspace, files, testSuite, test, runtimeContext });
      } else if (language === 'php') {
        execution = await this.executePhpTest({ workspace, files, testSuite, test });
      } else {
        execution = await this.executeCommandTest({ workspace, language, test });
      }

      const parsed = this.parseRunnerOutput(execution);
      const genericExpected = test.expectedOutput;
      const genericActual = String(execution.stdout || '').trim();
      const genericPassed =
        genericExpected === null || genericExpected === undefined
          ? execution.code === 0
          : deepEqual(genericActual, String(genericExpected));

      if (parsed.payload && typeof parsed.payload === 'object' && parsed.payload.passed !== undefined) {
        base.passed = Boolean(parsed.payload.passed);
        base.details = {
          expectedOutput: parsed.payload.expectedOutput ?? genericExpected,
          actualOutput: parsed.payload.actualOutput ?? genericActual
        };
        if (!base.passed) {
          base.errorMessage = parsed.payload.errorMessage || parsed.stderr || 'Assertion failed';
        }
      } else {
        base.passed = genericPassed;
        base.details = { expectedOutput: genericExpected, actualOutput: genericActual };
        if (!base.passed) {
          base.errorMessage = parsed.stderr || `Command exited with code ${execution.code}`;
        }
      }

      base.scoreEarned = base.passed ? weight : 0;
    } catch (error) {
      base.errorMessage = serializeError(error);
      base.scoreEarned = 0;
    } finally {
      base.durationMs = Number((process.hrtime.bigint() - startedAt) / 1000000n);
    }

    return base;
  }

  async run({ repoData, testSuite }) {
    const files = Array.isArray(repoData?.files) ? repoData.files : [];
    const tests = Array.isArray(testSuite?.definition?.tests) ? testSuite.definition.tests : [];
    if (!tests.length) {
      return {
        passed: false,
        summary: 'No tests configured for this group/year.',
        language: '',
        results: [],
        totals: { passed: 0, failed: 0, weight: 0, score: 0 },
        grade: 0
      };
    }

    const language = this.detectLanguage(files, testSuite);
    await this.ensureLocalLanguageRuntime(language);
    const workspace = await this.createWorkspace(files);
    const runtimeContext = {};
    try {
      const results = [];
      for (const test of tests) {
        // Keep single-test execution deterministic and isolate side effects by running sequentially.
        // This also avoids cross-language toolchain contention in constrained environments.
        const one = await this.executeSingleTest({ language, workspace, files, testSuite, test, runtimeContext });
        results.push(one);
      }

      const totals = results.reduce(
        (acc, item) => ({
          passed: acc.passed + (item.passed ? 1 : 0),
          failed: acc.failed + (item.passed ? 0 : 1),
          weight: acc.weight + Number(item.weight || 0),
          score: acc.score + Number(item.scoreEarned || 0)
        }),
        { passed: 0, failed: 0, weight: 0, score: 0 }
      );

      const grade = totals.weight > 0 ? Number(((totals.score / totals.weight) * 20).toFixed(2)) : 0;
      return {
        passed: totals.failed === 0,
        summary: `${totals.passed}/${results.length} tests passed (${language})`,
        language,
        results,
        totals,
        grade
      };
    } finally {
      if (runtimeContext.cBinaryPath) {
        await fs.rm(runtimeContext.cBinaryPath, { force: true }).catch(() => null);
      }
      await fs.rm(workspace, { recursive: true, force: true }).catch(() => null);
    }
  }
}

module.exports = TestExecutor;
