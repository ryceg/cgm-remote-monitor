import { describe, test, beforeAll, expect } from 'vitest';
import request from 'supertest';
import getLanguageInstance from '../lib/language';
import express from 'express';
import getEnv from '../lib/server/env';
import initMiddleware from '../lib/middleware/';
import initBootEvent from '../lib/server/bootevent';
import apiHandler from '../lib/api/';

const language = getLanguageInstance();

describe('Verifyauth REST api', () => {
  let self = {}; // Using an object to hold context

  const known = 'b723e97aa97846eb92d5264f084b2823f57c4aa1';

  beforeAll(async () => {
    delete process.env.API_SECRET;
    process.env.API_SECRET = 'this is my long pass phrase';
    self.env = getEnv();
    self.env.settings.authDefaultRoles = 'denied';
    self.wares = initMiddleware(self.env);
    self.app = express();
    self.app.enable('api');

    await new Promise((resolve, reject) => {
      initBootEvent(self.env, language).boot(function booted (ctx) {
        // Assuming boot calls back with ctx and doesn't have an error param,
        // or errors would throw/be handled by initBootEvent
        if (!ctx) return reject(new Error('Boot event context is missing'));
        self.app.use('/api', apiHandler(self.env, ctx));
        resolve();
      });
    });
  });

  test('/verifyauth should return UNAUTHORIZED', async () => {
    const res = await request(self.app)
      .get('/api/verifyauth')
      .expect(200);
    // The original test checked res.body.message.message
    // Adjust if the structure is different or if there was a typo in the original test
    expect(res.body.message.message).toBe('UNAUTHORIZED');
  });

  test('/verifyauth should return OK', async () => {
    const res = await request(self.app)
      .get('/api/verifyauth')
      .set('api-secret', known || '') // known is defined, so || '' is likely redundant but kept for consistency
      .expect(200);
    // The original test checked res.body.message.message
    expect(res.body.message.message).toBe('OK');
  });
});

