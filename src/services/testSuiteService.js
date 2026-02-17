const prisma = require('../config/prisma');
const { AppError } = require('../utils/errors');

function normalizeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePrimitive(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  const text = String(value).trim();
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (!Number.isNaN(Number(text)) && text !== '') return Number(text);
  return text;
}

function parseSimpleYaml(yamlText) {
  const lines = String(yamlText || '')
    .replace(/\t/g, '  ')
    .split(/\r?\n/);

  const root = {};
  const stack = [{ indent: -1, value: root }];
  const scalar = (value) => normalizePrimitive(value);

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i];
    if (!rawLine || /^\s*#/.test(rawLine)) continue;
    const indent = rawLine.match(/^\s*/)[0].length;
    const line = rawLine.trim();
    if (!line) continue;

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1].value;

    if (line.startsWith('- ')) {
      const item = line.slice(2).trim();
      if (!Array.isArray(parent)) {
        throw new Error('YAML list item found under non-list parent');
      }
      if (item.includes(':')) {
        const [key, ...rest] = item.split(':');
        const obj = {};
        obj[key.trim()] = scalar(rest.join(':').trim());
        parent.push(obj);
        stack.push({ indent, value: obj });
      } else {
        parent.push(scalar(item));
      }
      continue;
    }

    const [rawKey, ...rest] = line.split(':');
    const key = rawKey.trim();
    const rightSide = rest.join(':').trim();

    if (rightSide === '') {
      const nextIsList = lines
        .slice(i + 1)
        .find((candidate) => String(candidate || '').trim() !== '' && !/^\s*#/.test(candidate));
      const makeList = nextIsList ? nextIsList.trim().startsWith('- ') : false;
      const container = makeList ? [] : {};
      if (Array.isArray(parent)) {
        const obj = { [key]: container };
        parent.push(obj);
        stack.push({ indent, value: container });
      } else {
        parent[key] = container;
        stack.push({ indent, value: container });
      }
    } else if (Array.isArray(parent)) {
      const obj = { [key]: scalar(rightSide) };
      parent.push(obj);
      stack.push({ indent, value: obj });
    } else {
      parent[key] = scalar(rightSide);
    }
  }

  return root;
}

function parseSuiteContent({ content, format }) {
  const normalizedContent = String(content || '').trim();
  if (!normalizedContent) {
    throw new AppError('Test suite content is required', 400, 'VALIDATION_ERROR');
  }

  const normalizedFormat = String(format || '').trim().toLowerCase();
  if (normalizedFormat === 'yaml' || normalizedFormat === 'yml') {
    return parseSimpleYaml(normalizedContent);
  }

  try {
    return JSON.parse(normalizedContent);
  } catch (_error) {
    try {
      return parseSimpleYaml(normalizedContent);
    } catch (yamlError) {
      throw new AppError(`Invalid test suite format: ${yamlError.message}`, 400, 'VALIDATION_ERROR');
    }
  }
}

function normalizeTest(rawTest = {}, index = 0) {
  const name = String(rawTest.name || `Test ${index + 1}`).trim();
  const type = String(rawTest.type || 'unit').trim().toLowerCase() === 'integration' ? 'integration' : 'unit';
  const functionName = rawTest.functionName ? String(rawTest.functionName).trim() : null;
  const timeoutMs = Math.max(100, normalizeNumber(rawTest.timeoutMs, 2000));
  const weight = Math.max(0, normalizeNumber(rawTest.weight, 1));

  return {
    name,
    type,
    functionName,
    inputs: Array.isArray(rawTest.inputs) ? rawTest.inputs : [],
    expectedOutput: rawTest.expectedOutput === undefined ? null : rawTest.expectedOutput,
    timeoutMs,
    weight,
    code: rawTest.code ? String(rawTest.code) : '',
    command: rawTest.command ? String(rawTest.command) : '',
    entrypoint: rawTest.entrypoint ? String(rawTest.entrypoint) : ''
  };
}

function normalizeSuiteDefinition(rawDefinition = {}) {
  const tests = Array.isArray(rawDefinition.tests) ? rawDefinition.tests : [];
  const normalizedTests = tests.map((item, index) => normalizeTest(item, index)).filter((item) => item.weight > 0);

  if (!normalizedTests.length) {
    throw new AppError('Test suite must contain at least one weighted test', 400, 'VALIDATION_ERROR');
  }

  return {
    language: rawDefinition.language ? String(rawDefinition.language).trim().toLowerCase() : '',
    entrypoint: rawDefinition.entrypoint ? String(rawDefinition.entrypoint).trim() : '',
    requiredFunctions: Array.isArray(rawDefinition.requiredFunctions)
      ? rawDefinition.requiredFunctions.map((item) => String(item).trim()).filter(Boolean)
      : normalizedTests.map((item) => item.functionName).filter(Boolean),
    tests: normalizedTests
  };
}

async function upsertSuite({
  groupName,
  year,
  name = 'Default Suite',
  teacherId = null,
  definition
}) {
  const normalizedGroup = String(groupName || '').trim().toUpperCase();
  const normalizedYear = String(year || '').trim().toUpperCase();
  if (!normalizedGroup || !normalizedYear) {
    throw new AppError('Group and year are required', 400, 'VALIDATION_ERROR');
  }

  const normalizedDefinition = normalizeSuiteDefinition(definition);

  const suite = await prisma.testSuite.upsert({
    where: {
      groupName_year: {
        groupName: normalizedGroup,
        year: normalizedYear
      }
    },
    update: {
      name: String(name || 'Default Suite').trim(),
      teacherId: teacherId || null,
      definitionJson: JSON.stringify(normalizedDefinition),
      isActive: true
    },
    create: {
      groupName: normalizedGroup,
      year: normalizedYear,
      name: String(name || 'Default Suite').trim(),
      teacherId: teacherId || null,
      definitionJson: JSON.stringify(normalizedDefinition),
      isActive: true
    }
  });

  return {
    id: suite.id,
    groupName: suite.groupName,
    year: suite.year,
    name: suite.name,
    isActive: suite.isActive,
    definition: normalizedDefinition
  };
}

async function getSuiteByGroupYear(groupName, year) {
  const normalizedGroup = String(groupName || '').trim().toUpperCase();
  const normalizedYear = String(year || '').trim().toUpperCase();
  let suite = await prisma.testSuite.findFirst({
    where: {
      groupName: normalizedGroup,
      year: normalizedYear,
      isActive: true
    }
  });

  // Backward-compatible lookup for pre-normalization records (e.g. "g1" vs "G1").
  if (!suite) {
    const candidates = await prisma.testSuite.findMany({
      where: {
        year: normalizedYear,
        isActive: true
      }
    });
    suite = candidates.find((row) => String(row.groupName || '').trim().toUpperCase() === normalizedGroup) || null;
  }

  if (!suite) return null;
  return {
    id: suite.id,
    groupName: suite.groupName,
    year: suite.year,
    name: suite.name,
    definition: normalizeSuiteDefinition(JSON.parse(suite.definitionJson || '{}'))
  };
}

async function listSuites({ teacherId } = {}) {
  const where = {};
  if (teacherId) where.teacherId = Number(teacherId);
  const rows = await prisma.testSuite.findMany({
    where,
    orderBy: [{ year: 'asc' }, { groupName: 'asc' }]
  });
  return rows.map((row) => ({
    id: row.id,
    groupName: row.groupName,
    year: row.year,
    name: row.name,
    isActive: row.isActive,
    definition: normalizeSuiteDefinition(JSON.parse(row.definitionJson || '{}'))
  }));
}

module.exports = {
  parseSuiteContent,
  normalizeSuiteDefinition,
  getSuiteByGroupYear,
  upsertSuite,
  listSuites
};
