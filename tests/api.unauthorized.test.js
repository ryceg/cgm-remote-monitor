import { describe, test, beforeAll, beforeEach, afterEach, afterAll, expect } from 'vitest';
import request from 'supertest';
import load from './fixtures/load';
import getLanguageInstance from '../lib/language';
import express from 'express';
import getEnv from '../lib/server/env';
import initMiddleware from '../lib/middleware/';
import initBootEvent from '../lib/server/bootevent';
import entriesApi from '../lib/api/entries/';
import entriesServer from '../lib/server/entries';

const language = getLanguageInstance();

describe('authed REST api', () => {
  let self = {}; // Using an object to hold context similar to 'this' in Mocha

  // this.timeout(20000); // Vitest has default timeouts or can be configured per test/globally

  beforeAll(async () => {
    const known = 'b723e97aa97846eb92d5264f084b2823f57c4aa1';
    delete process.env.API_SECRET;
    process.env.API_SECRET = 'this is my long pass phrase';
    const env = getEnv();
    env.settings.authDefaultRoles = 'readable';
    self.wares = initMiddleware(env);
    self.archive = null;
    self.app = express();
    self.app.enable('api');
    self.known_key = known;

    await new Promise((resolve, reject) => {
      initBootEvent(env, language).boot(function booted (ctx) {
        self.app.use('/', entriesApi(self.app, self.wares, ctx, env));
        self.archive = entriesServer(env, ctx);
        const creating = load('json');
        self.archive.create(creating, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    });
  });

  beforeEach(async () => {
    const creating = load('json');
    creating.push({type: 'sgv', sgv: 100, date: Date.now()});
    await new Promise((resolve, reject) => {
      self.archive.create(creating, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise((resolve, reject) => {
      self.archive().remove({ }, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise((resolve, reject) => {
      self.archive().remove({ }, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  });

  test('disallow unauthorized POST', async () => {
    const app = self.app;
    const new_entry = {type: 'sgv', sgv: 100, date: Date.now() };
    new_entry.dateString = new Date(new_entry.date).toISOString( );

    const res = await request(app)
      .post('/entries.json?')
      .send([new_entry])
      .expect(401);

    expect(res.body.status).toBe(401);
    expect(res.body.message).toBe('Unauthorized');
    expect(res.body.description).toBeDefined();
  });

  test('/entries/preview', async () => {
    const known_key = self.known_key;
    const res = await request(self.app)
      .post('/entries/preview.json')
      .set('api-secret', known_key)
      .send(load('json'))
      .expect(201);

    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBe(30);
  });

  test('allow authorized POST', async () => {
    const app = self.app;
    const known_key = self.known_key;

    const new_entry = {type: 'sgv', sgv: 100, date: Date.now() };
    new_entry.dateString = new Date(new_entry.date).toISOString( );

    const postRes = await request(app)
      .post('/entries.json?')
      .set('api-secret', known_key)
      .send([new_entry])
      .expect(200);

    expect(postRes.body).toBeInstanceOf(Array);
    expect(postRes.body.length).toBe(1);

    const getRes = await request(app)
      .get('/slice/entries/dateString/sgv/' + new_entry.dateString.split('T')[0] + '.json')
      .expect(200);

    expect(getRes.body).toBeInstanceOf(Array);
    expect(getRes.body.length).toBe(1);

    await request(app)
      .delete('/entries/sgv?find[dateString]=' + new_entry.dateString)
      .set('api-secret', known_key)
      .expect(200);
  });

  test('disallow deletes unauthorized', async () => {
    const app = self.app;

    const getRes1 = await request(app)
      .get('/entries.json?find[dateString][$gte]=2014-07-18')
      .expect(200);

    expect(getRes1.body).toBeInstanceOf(Array);
    expect(getRes1.body.length).toBe(10);

    await request(app)
      .delete('/entries/sgv?find[dateString][$gte]=2014-07-18&find[dateString][$lte]=2014-07-20')
      .expect(401);

    const getRes2 = await request(app)
      .get('/entries/sgv.json?find[dateString][$gte]=2014-07-18&find[dateString][$lte]=2014-07-20')
      .expect(200);

    expect(getRes2.body).toBeInstanceOf(Array);
    expect(getRes2.body.length).toBe(10);
  });

  test('allow deletes when authorized', async () => {
    const app = self.app;

    await request(app)
      .delete('/entries/sgv?find[dateString][$gte]=2014-07-18&find[dateString][$lte]=2014-07-20')
      .set('api-secret', self.known_key)
      .expect(200);

    const getRes = await request(app)
      .get('/entries/sgv.json?find[dateString][$gte]=2014-07-18&find[dateString][$lte]=2014-07-20')
      .expect(200);

    expect(getRes.body).toBeInstanceOf(Array);
    expect(getRes.body.length).toBe(0);
  });
});
