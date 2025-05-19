import { describe, test, beforeAll, afterAll, expect } from 'vitest';
import request from 'supertest';

import testConst from './fixtures/api3/const.json';
import instance from './fixtures/api3/instance';
import apiConst from '../lib/api3/const.json';
import software from '../package.json';

describe('Basic REST API3', () => {
  let self = {}; // Using an object to hold context

  // this.timeout(15000); // Vitest default timeout or configure globally/per-test

  beforeAll(async () => {
    self.instance = await instance.create({});
    self.app = self.instance.app;
    self.env = self.instance.env;
  });

  afterAll(() => { // Removed async as teardown is not async
    if (self.instance && self.instance.ctx && self.instance.ctx.bus && self.instance.ctx.bus.teardown) {
      self.instance.ctx.bus.teardown();
    }
  });

  test('GET /version', async () => {
    const res = await request(self.app)
      .get('/api/v3/version')
      .expect(200);

    const result = res.body.result;

    expect(res.body.status).toBe(200);
    expect(result.version).toBe(software.version);
    expect(result.apiVersion).toBe(apiConst.API3_VERSION);
    expect(result.srvDate).toBeGreaterThanOrEqual(testConst.YEAR_2019);
    expect(result.srvDate).toBeLessThanOrEqual(testConst.YEAR_2050);
  });
});

