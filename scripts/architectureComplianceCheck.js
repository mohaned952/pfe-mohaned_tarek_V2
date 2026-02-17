const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const includeDirs = ['src', 'prisma', 'backend', 'frontend'];
const excludeDirs = new Set(['node_modules', '.git', 'dist', 'coverage']);

const forbiddenPatterns = [
  { label: 'legacy_fingerprint', regex: /fingerprint/i },
  { label: 'legacy_duplicate_submission', regex: /duplicate_of_submission_id/i },
  { label: 'legacy_optimistic_lock', regex: /\boptimistic\b|\bcorrection[_-]?version\b|\bsubmission[_-]?version\b/i },
  { label: 'legacy_node_vm', regex: /\bnode:vm\b|\bvm\.Script\b/ },
  { label: 'legacy_multi_model_fallback', regex: /\bmulti-model\b|\bfallback model\b/i }
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (excludeDirs.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }
    if (/\.(js|cjs|mjs|ts|json|sql|prisma|md|html|css|ya?ml)$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function inspectFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const violations = [];
  for (const pattern of forbiddenPatterns) {
    if (pattern.regex.test(content)) {
      violations.push(pattern.label);
    }
  }
  return violations;
}

const files = includeDirs.flatMap((dir) => walk(path.join(root, dir)));
const errors = [];
for (const filePath of files) {
  const violations = inspectFile(filePath);
  for (const violation of violations) {
    errors.push({
      file: path.relative(root, filePath),
      violation
    });
  }
}

if (errors.length > 0) {
  for (const err of errors) {
    process.stderr.write(`[ARCH-COMPLIANCE] ${err.violation} detected in ${err.file}\n`);
  }
  process.exit(1);
}

process.stdout.write('Architecture compliance checks passed.\n');
