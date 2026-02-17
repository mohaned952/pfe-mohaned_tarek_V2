const prisma = require('../config/prisma');

function defaultSuiteFor(language) {
  const lang = String(language || '').toLowerCase();
  if (lang === 'html-css') {
    return {
      language: 'html-css',
      tests: [{ name: 'Uses semantic HTML', pattern: '<main', maxScore: 1 }, { name: 'Includes CSS class usage', pattern: 'class=', maxScore: 1 }]
    };
  }

  if (lang === 'javascript') {
    return {
      language: 'javascript',
      tests: [
        {
          name: 'Exports solve function',
          functionName: 'solve',
          inputs: [],
          expectedOutput: true,
          maxScore: 1
        }
      ]
    };
  }

  return {
    language: lang,
    tests: [{ name: 'Program output check', expectedOutput: '', maxScore: 1 }]
  };
}

async function getActiveSuiteForTeacher({ teacherId, language }) {
  const row = await prisma.testSuite.findFirst({
    where: { ownerId: teacherId, language: String(language || '').toLowerCase(), isActive: true },
    orderBy: { updatedAt: 'desc' }
  });

  if (!row) return defaultSuiteFor(language);
  return JSON.parse(row.definitionJson);
}

async function saveSuite({ teacherId, title, language, definition, groupName = null, year = null }) {
  const data = {
    ownerId: teacherId,
    title: String(title || `${language} Suite`).trim(),
    language: String(language || '').trim().toLowerCase(),
    groupName: groupName ? String(groupName).trim().toUpperCase() : null,
    year: year ? String(year).trim().toUpperCase() : null,
    definitionJson: JSON.stringify(definition),
    isActive: true
  };
  return prisma.testSuite.create({ data });
}

async function listSuites(teacherId) {
  const rows = await prisma.testSuite.findMany({ where: { ownerId: teacherId }, orderBy: { updatedAt: 'desc' } });
  return rows.map((row) => ({ ...row, definition: JSON.parse(row.definitionJson) }));
}

module.exports = {
  getActiveSuiteForTeacher,
  saveSuite,
  listSuites
};
