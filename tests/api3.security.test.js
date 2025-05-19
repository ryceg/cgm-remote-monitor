/* eslint require-atomic-updates: 0 */
import request from 'supertest';
import * as apiConst from '../lib/api3/const.json';
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { create as createInstance } from './fixtures/api3/instance';
import createAuthSubject from './fixtures/api3/authSubject';

describe('Security of REST API3', { timeout: 30000 }, () => {
  let http;
  let https;
  let jwt;

  beforeAll(async () => {
    http = await createInstance({ useHttps: false });
    https = await createInstance({ });

    let authResult = await createAuthSubject(https.ctx.authorization.storage, [
      'denied',
      'read',
      'delete'
    ], https.app);
    jwt = authResult.jwt;
  });

  afterAll(() => {
    http.ctx.bus.teardown();
    https.ctx.bus.teardown();
  });

  it('should require token', async () => {
    const res = await request(https.baseUrl)
      .get('/api/v3/test')
      .expect(401);

    expect(res.body.status).toBe(401);
    expect(res.body.message).toBe(apiConst.MSG.HTTP_401_MISSING_OR_BAD_TOKEN);
  });

  it('should require valid token', async () => {
    const res = await request(https.baseUrl)
      .get('/api/v3/test')
      .set('Authorization', 'Bearer invalid_token')
      .expect(401);

    expect(res.body.status).toBe(401);
    expect(res.body.message).toBe(apiConst.MSG.HTTP_401_BAD_TOKEN);
  });

  it('should deny subject denied', async () => {
    const res = await request(https.baseUrl)
      .get('/api/v3/test')
      .set('Authorization', `Bearer ${jwt.denied}`)
      .expect(403);

    expect(res.body.status).toBe(403);
    expect(res.body.message).toBe(apiConst.MSG.HTTP_403_MISSING_PERMISSION.replace('{0}', 'api:entries:read'));
  });

  it('should allow subject with read permission', async () => {
    await request(https.baseUrl)
      .get('/api/v3/test')
      .set('Authorization', `Bearer ${jwt.read}`)
      .expect(200);
  });
});
