/* eslint require-atomic-updates: 0 */
import { describe, test, beforeAll, afterAll, beforeEach, afterEach, expect } from 'vitest';

import instance from './fixtures/api3/instance';
import authSubject from './fixtures/api3/authSubject';

describe('API3 DELETE', () => {
  let self = {};

  beforeAll(async () => {
    self.instance = await instance.create({});
    self.app = self.instance.app;
    self.env = self.instance.env;
    self.url = '/api/v3/treatments';

    let authResult = await authSubject(self.instance.ctx.authorization.storage, [
      'delete'
    ], self.instance.app);

    self.subject = authResult.subject;
    self.jwt = authResult.jwt;
    self.cache = self.instance.cacheMonitor;
  });

  afterAll(() => {
    if (self.instance && self.instance.ctx && self.instance.ctx.bus && self.instance.ctx.bus.teardown) {
      self.instance.ctx.bus.teardown();
    }
  });

  beforeEach(() => {
    if (self.cache) self.cache.clear();
  });

  afterEach(() => {
    if (self.cache) expect(self.cache.isEmpty()).toBe(true);
  });

  test('should require authentication', async () => {
    let res = await self.instance.delete(`${self.url}/FAKE_IDENTIFIER`)
      .expect(401);
    expect(res.body.status).toBe(401);
    expect(res.body.message).toBe('Missing or bad access token or JWT');
  });

  test('should not found not existing collection', async () => {
    let res = await self.instance.delete(`/api/v3/NOT_EXIST/FAKE_IDENTIFIER`, self.jwt.delete)
      .expect(404);
    expect(res.body.status).toBe(404);
  });
});

