const { GoogleGenerativeAI } = require('@google/generative-ai');
const env = require('../config/env');
const logger = require('../config/logger');

function buildFeedbackPrompt({ studentName, finalGrade, testSummary, failedTests }) {
  return [
    'You are a teaching assistant writing concise, professional feedback.',
    'Do not assign a grade. Grade is already computed from tests.',
    'Use test outcomes only.',
    '',
    `STUDENT: ${String(studentName || 'Student')}`,
    `FINAL_GRADE: ${Number(finalGrade || 0).toFixed(2)}/20`,
    `TEST_SUMMARY: ${String(testSummary || '')}`,
    `FAILED_TESTS: ${failedTests.length ? failedTests.join(' | ') : 'None'}`,
    '',
    'Return plain text with: strengths, failures, and next steps.'
  ].join('\n');
}

async function generateFeedbackFromTests({ studentName, finalGrade, testSummary, failedTests = [], requestId }) {
  if (!env.GOOGLE_API_KEY) return '';

  const client = new GoogleGenerativeAI(env.GOOGLE_API_KEY);
  const modelName = env.GEMINI_MODEL;
  const prompt = buildFeedbackPrompt({ studentName, finalGrade, testSummary, failedTests });

  try {
    const model = client.getGenerativeModel({ model: modelName });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        topP: 0.9,
        topK: 20
      }
    });
    const text = String(result?.response?.text?.() || '').trim();
    logger.info({ requestId, modelName, responseLength: text.length }, 'Optional feedback generated from tests');
    return text;
  } catch (error) {
    logger.warn({ requestId, modelName, err: error.message }, 'Optional feedback generation failed');
    return '';
  }
}

function getAiHealthStatus() {
  return {
    provider: 'gemini',
    model: env.GEMINI_MODEL,
    configured: Boolean(env.GOOGLE_API_KEY)
  };
}

module.exports = {
  generateFeedbackFromTests,
  getAiHealthStatus
};
