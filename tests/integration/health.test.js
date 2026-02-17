const request = require('supertest');
const { createApp } = require('../../src/app');

describe('Health routes', () => {
  const app = createApp();

  test('GET /api/health/live', async () => {
    const response = await request(app).get('/api/health/live');
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
