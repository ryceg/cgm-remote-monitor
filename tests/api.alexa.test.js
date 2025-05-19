import fs from 'fs';
import request from 'supertest';
import lang from '../lib/language';
import bodyParser from 'body-parser';
import { describe, it, expect, beforeAll, vi } from 'vitest';

describe('Alexa REST api', () => {
  const apiRoot = require('../lib/api/root');
  const api = require('../lib/api/');
  let app;
  let wares;

  beforeAll(async () => {
    delete process.env.API_SECRET;
    process.env.API_SECRET = 'this is my long pass phrase';
    var env = require('../lib/server/env')();
    env.settings.enable = ['alexa'];
    env.settings.authDefaultRoles = 'readable';
    env.api_secret = 'this is my long pass phrase';
    wares = require('../lib/middleware/')(env);
    app = require('express')();
    app.enable('api');

    await new Promise(resolve => {
      require('../lib/server/bootevent')(env, lang(fs)).boot(function booted(ctx) {
        app.use('/api', bodyParser({
          limit: 1048576 * 50
        }), apiRoot(env, ctx));

        app.use('/api/v1', bodyParser({
          limit: 1048576 * 50
        }), api(env, ctx));
        resolve();
      });
    });
  });

  it('Launch Request', async () => {
    const response = await request(app)
      .post('/api/v1/alexa')
      .send({
        "request": {
          "type": "LaunchRequest",
          "locale": "en-US"
        }
      })
      .expect(200);

    const launchText = 'What would you like to check on Nightscout?';

    expect(response.body.response.outputSpeech.text).toBe(launchText);
    expect(response.body.response.reprompt.outputSpeech.text).toBe(launchText);
    expect(response.body.response.shouldEndSession).toBe(false);
  });

  it('Launch Request With Intent', async () => {
    const response = await request(app)
      .post('/api/v1/alexa')
      .send({
        "request": {
          "type": "LaunchRequest",
          "locale": "en-US",
          "intent": {
            "name": "UNKNOWN"
          }
        }
      })
      .expect(200);

    const unknownIntentText = 'I\\\'m sorry, I don\\\'t know what you\\\'re asking for.';

    expect(response.body.response.outputSpeech.text).toBe(unknownIntentText);
    expect(response.body.response.shouldEndSession).toBe(true);
  });

  it('Session Ended', async () => {
    await request(app)
      .post('/api/v1/alexa')
      .send({
        "request": {
          "type": "SessionEndedRequest",
          "locale": "en-US"
        }
      })
      .expect(200);
  });
});

