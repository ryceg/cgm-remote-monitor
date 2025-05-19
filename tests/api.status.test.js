import request from 'supertest';
import lang from '../lib/language'; // Renamed
import { describe, it, expect, beforeAll } from 'vitest';

describe('Status REST api', () => {
  let app; // Defined here to be accessible in tests
  const api = require('../lib/api/');

  beforeAll(async () => { // Changed from before to beforeAll and made async
    delete process.env.API_SECRET;
    process.env.API_SECRET = 'this is my long pass phrase';
    var env = require('../lib/server/env')();
    env.settings.enable = ['careportal', 'rawbg'];
    env.settings.authDefaultRoles = 'readable';
    env.api_secret = 'this is my long pass phrase';
    require('../lib/middleware/')(env); // Assign to wares - removed wares variable, but kept the call as it might have side effects
    app = require('express')(); // Assign to app
    app.enable('api');

    await new Promise(resolve => { // Added promise for async boot
      require('../lib/server/bootevent')(env, lang()).boot(function booted(ctx) {
        app.use('/api', api(env, ctx));
        resolve();
      });
    });
  });

  it('/status.json', async () => { // Made async
    const res = await request(app)
      .get('/api/status.json')
      .expect(200);
    expect(res.body.apiEnabled).toBe(true);
    expect(res.body.careportalEnabled).toBe(true);
    expect(res.body.settings.enable.length).toBe(2);
    expect(res.body.settings.enable).toContain('careportal');
    expect(res.body.settings.enable).toContain('rawbg');
  });

  it('/status.html', async () => { // Made async
    const res = await request(app)
      .get('/api/status.html')
      .expect(200);
    expect(res.type).toBe('text/html');
    expect(res.statusCode).toBe(200);
  });

  it('/status.svg', async () => { // Made async
    const res = await request(app)
      .get('/api/status.svg')
      .expect(302); // Status code is 302 for redirect
    expect(res.statusCode).toBe(302);
  });

  it('/status.txt', async () => { // Made async
    const res = await request(app)
      .get('/api/status.txt')
      .expect(200, 'STATUS OK');
    expect(res.type).toBe('text/plain');
    expect(res.statusCode).toBe(200);
  });


  it('/status.js', async () => { // Made async
    const res = await request(app)
      .get('/api/status.js')
      .expect(200);
    expect(res.type).toBe('application/javascript');
    expect(res.statusCode).toBe(200);
    expect(res.text.startsWith('this.serverSettings =')).toBe(true);
  });

  it('/status.png', async () => { // Made async
    const res = await request(app)
      .get('/api/status.png')
      .expect(302); // Status code is 302 for redirect
    expect(res.headers.location).toBe('http://img.shields.io/badge/Nightscout-OK-green.png');
    expect(res.statusCode).toBe(302);
  });
});

