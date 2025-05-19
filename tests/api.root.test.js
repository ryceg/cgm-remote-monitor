import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import semver from 'semver';
import instanceFixture from './fixtures/api/instance'; // Renamed for clarity

describe('Root REST API', () => {
  let self = {}; // Changed from this to self, and initialize as object

  // this.timeout(15000); // Vitest default timeout is 5000ms, can be configured in vitest.config.js if needed

  beforeAll(async () => {
    self.instance = await instanceFixture.create({});
    self.app = self.instance.app;
    self.env = self.instance.env;
  });

  afterAll(() => { // Changed from after to afterAll
    self.instance.server.close();
  });

  it('GET /api/versions', async () => {
    let res = await request(self.app)
      .get('/api/versions')
      .expect(200);

    expect(res.body.length).toBeGreaterThanOrEqual(3);
    res.body.forEach(obj => {
      const fields = Object.getOwnPropertyNames(obj);
      expect(fields.sort()).toEqual(['url', 'version']);

      expect(semver.valid(obj.version)).toBeTruthy();
      expect(obj.url.startsWith('/api')).toBe(true);
    });
  });
});

