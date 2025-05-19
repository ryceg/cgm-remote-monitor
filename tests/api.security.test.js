/* eslint require-atomic-updates: 0 */
import request from 'supertest';
import lang from '../lib/language'; // Renamed
import { describe, it, expect, beforeAll } from 'vitest'; // Removed vi
import jwt from 'jsonwebtoken';
import authSubjectFixture from './fixtures/api3/authSubject'; // Renamed

describe('Security of REST API V1', () => {
  let self = {}; // Changed from this to self
  // const instance = require('./fixtures/api3/instance'); // This seems unused in the original before block

  // this.timeout(30000); // Vitest default timeout is 5000ms, can be configured in vitest.config.js if needed

  var known = 'b723e97aa97846eb92d5264f084b2823f57c4aa1';

  beforeAll(async () => { // Changed from before to beforeAll and made async
    var api = require('../lib/api/');
    delete process.env.API_SECRET;
    process.env.API_SECRET = 'this is my long pass phrase';
    self.env = require('../lib/server/env')();
    self.env.settings.authDefaultRoles = 'denied';
    self.wares = require('../lib/middleware/')(self.env); // Corrected: this.wares to self.wares
    self.app = require('express')();
    self.app.enable('api');
    await new Promise(resolve => { // Removed async from executor
      require('../lib/server/bootevent')(self.env, lang()).boot(async function booted(ctx) { // kept async here as it uses await
        self.app.use('/api/v1', api(self.env, ctx));
        self.app.use('/api/v2/authorization', ctx.authorization.endpoints);
        let authResult = await authSubjectFixture(ctx.authorization.storage);
        self.subject = authResult.subject;
        self.token = authResult.accessToken;
        resolve();
      });
    });
  });

  it('Should fail on false token', async () => { // Made async
    const res = await request(self.app)
      .get('/api/v2/authorization/request/12345')
      .expect(401);
    console.log(res.error);
    expect(res.error.status).toBe(401);
  });

  it('Data load should fail unauthenticated', async () => { // Made async
    const res = await request(self.app)
      .get('/api/v1/entries.json')
      .expect(401);
    console.log(res.error);
    expect(res.error.status).toBe(401);
  });

  it('Should return a JWT on token', async () => { // Made async
    const now = Math.round(Date.now() / 1000) - 1;
    const res = await request(self.app)
      .get('/api/v2/authorization/request/' + self.token.read)
      .expect(200);
    const decodedToken = jwt.decode(res.body.token);
    expect(decodedToken.accessToken).toBe(self.token.read);
    expect(decodedToken.iat).toBeGreaterThanOrEqual(now);
    expect(decodedToken.exp).toBeGreaterThan(decodedToken.iat);
  });

  it('Should return a JWT with default roles on broken role token', async () => { // Made async
    const now = Math.round(Date.now() / 1000) - 1;
    const res = await request(self.app)
      .get('/api/v2/authorization/request/' + self.token.noneSubject)
      .expect(200);
    const decodedToken = jwt.decode(res.body.token);
    expect(decodedToken.accessToken).toBe(self.token.noneSubject);
    expect(decodedToken.iat).toBeGreaterThanOrEqual(now);
    expect(decodedToken.exp).toBeGreaterThan(decodedToken.iat);
  });

  it('Data load should succeed with API SECRET', async () => { // Made async
    await request(self.app)
      .get('/api/v1/entries.json')
      .set('api-secret', known)
      .expect(200);
  });

  it('Data load should succeed with GET token', async () => { // Made async
    await request(self.app)
      .get('/api/v1/entries.json?token=' + self.token.read)
      .expect(200);
  });

  it('Data load should succeed with token in place of a secret', async () => { // Made async
    await request(self.app)
      .get('/api/v1/entries.json')
      .set('api-secret', self.token.read)
      .expect(200);
  });

  it('Data load should succeed with a bearer token', async () => { // Made async
    const res = await request(self.app)
      .get('/api/v2/authorization/request/' + self.token.read)
      .expect(200);
    const token = res.body.token;
    await request(self.app)
      .get('/api/v1/entries.json')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
  });

  it('Data load fail succeed with a false bearer token', async () => { // Made async
    await request(self.app)
      .get('/api/v1/entries.json')
      .set('Authorization', 'Bearer 1234567890')
      .expect(401);
  });

  it('/verifyauth should return OK for Bearer tokens', async () => { // Made async
    const res1 = await request(self.app)
      .get('/api/v2/authorization/request/' + self.token.adminAll)
      .expect(200);
    const token = res1.body.token;
    const res2 = await request(self.app)
      .get('/api/v1/verifyauth')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(res2.body.message.message).toBe('OK');
    expect(res2.body.message.isAdmin).toBe(true);
  });

});
