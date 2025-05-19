import { describe, test, beforeEach, afterAll, expect } from 'vitest';
import _ from 'lodash';
import request from 'supertest';
import getLanguageInstance from '../lib/language';
import _moment from 'moment';
import express from 'express';
import getEnv from '../lib/server/env';
import initBootEvent from '../lib/server/bootevent';
import getDData from '../lib/data/ddata';
import apiHandler from '../lib/api/';
import initMiddleware from '../lib/middleware/';

const languageInstance = getLanguageInstance();

describe('Treatment API', () => {
  let self = {}; // To store context like app, env, ctx

  const api_secret_hash = 'b723e97aa97846eb92d5264f084b2823f57c4aa1';

  beforeEach(async () => {
    process.env.API_SECRET = 'this is my long pass phrase';
    self.env = getEnv();
    self.env.settings.authDefaultRoles = 'readable';
    self.env.settings.enable = ['careportal', 'api'];
    self.wares = initMiddleware(self.env);
    self.app = express();
    self.app.enable('api');

    await new Promise((resolve) => {
      initBootEvent(self.env, languageInstance).boot(function booted(ctx) {
        // Assuming 'boot' calls back with ctx and doesn't have an error param,
        // or errors would throw/be handled by initBootEvent
        self.ctx = ctx;
        self.ctx.ddata = getDData();
        self.app.use('/api', apiHandler(self.env, ctx));
        resolve();
      });
    });
  });

  afterAll(() => {
    // delete process.env.API_SECRET; // Consider if this is needed for test isolation
  });

  test('post single treatments', async () => {
    await new Promise((resolve, reject) => {
      self.ctx.treatments().remove({}, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    const now = (new Date()).toISOString();
    await request(self.app)
      .post('/api/treatments/')
      .set('api-secret', api_secret_hash || '')
      .send({eventType: 'Meal Bolus', created_at: now, carbs: '30', insulin: '2.00', preBolus: '15', glucose: 100, glucoseType: 'Finger', units: 'mg/dl', notes: '<IMG SRC="javascript:alert(\'XSS\');">' })
      .expect(200);

    const list = await new Promise((resolve, reject) => {
      self.ctx.treatments.list({}, (err, items) => {
        if (err) return reject(err);
        resolve(items);
      });
    });

    const sorted = _.sortBy(list, treatment => treatment.created_at);
    expect(sorted.length).toBe(2);
    expect(sorted[0].glucose).toBe(100);
    expect(sorted[0].notes).toBe('<img>');
    expect(sorted[0].eventTime).toBeUndefined();
    expect(sorted[0].insulin).toBe(2);
    expect(sorted[1].carbs).toBe(30);
  });

  /*
  test('saving entry without created_at should fail', async () => {
    await new Promise((resolve, reject) => {
      self.ctx.treatments().remove({ }, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    // supertest's .expect(statusCode) will throw if the status code doesn't match.
    // So, if 422 is received, the await will complete successfully.
    // If a different code (e.g., 200) is received, it will throw, failing the test.
    await request(self.app)
      .post('/api/treatments/')
      .set('api-secret', self.env.api_secret || '') // Note: self.env.api_secret might differ from api_secret_hash
      .send({eventType: 'Meal Bolus', carbs: '30', insulin: '2.00', preBolus: '15', glucose: 100, glucoseType: 'Finger', units: 'mg/dl'})
      .expect(422);
  });
  */

  test('post single treatments in zoned time format', async () => {
    const current_time = Date.now();
    console.log('Testing date with local format: ', _moment(current_time).format("YYYY-MM-DDTHH:mm:ss.SSSZZ"));

    await new Promise((resolve, reject) => {
      self.ctx.treatments().remove({ }, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    await request(self.app)
      .post('/api/treatments/')
      .set('api-secret', api_secret_hash || '')
      .send({eventType: 'Meal Bolus', created_at: _moment(current_time).format("YYYY-MM-DDTHH:mm:ss.SSSZZ"), carbs: '30', insulin: '2.00', glucose: 100, glucoseType: 'Finger', units: 'mg/dl'})
      .expect(200);

    const list = await new Promise((resolve, reject) => {
      self.ctx.treatments.list({}, (err, items) => {
        if (err) return reject(err);
        resolve(items);
      });
    });

    const sorted = _.sortBy(list, treatment => treatment.created_at);
    console.log(sorted);
    expect(sorted.length).toBe(1);
    expect(sorted[0].glucose).toBe(100);
    expect(sorted[0].eventTime).toBeUndefined();
    expect(sorted[0].insulin).toBe(2);
    expect(sorted[0].carbs).toBe(30);
    const zonedTime = _moment(current_time).utc().format("YYYY-MM-DDTHH:mm:ss.SSS") + "Z";
    expect(sorted[0].created_at).toBe(zonedTime);
    expect(sorted[0].utcOffset).toBe(-1 * new Date().getTimezoneOffset());
  });


  test('post a treatment array', async () => {
    await new Promise((resolve, reject) => {
      self.ctx.treatments().remove({ }, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    const now = (new Date()).toISOString();
    await request(self.app)
      .post('/api/treatments/')
      .set('api-secret', api_secret_hash || '')
      .send([
        {eventType: 'BG Check', created_at: now, glucose: 100, preBolus: '0', glucoseType: 'Finger', units: 'mg/dl', notes: ''},
        {eventType: 'Meal Bolus', created_at: now, carbs: '30', insulin: '2.00', preBolus: '15', glucose: 100, glucoseType: 'Finger', units: 'mg/dl'}
      ])
      .expect(200);

    const list = await new Promise((resolve, reject) => {
      self.ctx.treatments.list({}, (err, items) => {
        if (err) return reject(err);
        resolve(items);
      });
    });

    expect(list.length).toBe(3);
    expect(list[0].eventTime).toBeUndefined();
    expect(list[1].eventTime).toBeUndefined();
  });

  test('post a treatment array and dedupe', async () => {
    await new Promise((resolve, reject) => {
      self.ctx.treatments().remove({ }, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    const now = (new Date()).toISOString();
    await request(self.app)
      .post('/api/treatments/')
      .set('api-secret', api_secret_hash || '')
      .send([
        {eventType: 'BG Check', glucose: 100, units: 'mg/dl', created_at: now},
        {eventType: 'BG Check', glucose: 100, units: 'mg/dl', created_at: now},
        {eventType: 'BG Check', glucose: 100, units: 'mg/dl', created_at: now},
        {eventType: 'BG Check', glucose: 100, units: 'mg/dl', created_at: now},
        {eventType: 'BG Check', glucose: 100, units: 'mg/dl', created_at: now},
        {eventType: 'BG Check', glucose: 100, units: 'mg/dl', created_at: now},
        {eventType: 'BG Check', glucose: 100, units: 'mg/dl', created_at: now},
        {eventType: 'BG Check', glucose: 100, units: 'mg/dl', created_at: now},
        {eventType: 'Meal Bolus', created_at: now, carbs: '30', insulin: '2.00', preBolus: '15', glucose: 100, glucoseType: 'Finger', units: 'mg/dl'}
      ])
      .expect(200);

    const list = await new Promise((resolve, reject) => {
      self.ctx.treatments.list({}, (err, items) => {
        if (err) return reject(err);
        resolve(items);
      });
    });

    const sorted = _.sortBy(list, treatment => treatment.created_at);

    if (sorted.length !== 3) {
      console.info('unexpected result length, sorted treatments:', sorted);
    }
    expect(sorted.length).toBe(3);
    expect(sorted[0].glucose).toBe(100);
  });

  test('post a treatment, query, delete, verify gone', async () => {
    console.log('Inserting treatment entry');
    const now = (new Date()).toISOString();

    await request(self.app)
      .post('/api/treatments/')
      .set('api-secret', api_secret_hash || '')
      .send({eventType: 'Meal Bolus', created_at: now, carbs: '99', insulin: '2.00', preBolus: '15', glucose: 100, glucoseType: 'Finger', units: 'mg/dl'})
      .expect(200);

    console.log('Ensuring treatment entry was inserted successfully');
    const getResponse1 = await request(self.app)
      .get('/api/treatments/')
      .query('find[carbs]=99') // supertest handles query object formatting
      .set('api-secret', api_secret_hash || '')
      .expect(200);

    expect(getResponse1.body[0].carbs).toBe(99);

    console.log('Deleting test treatment entry');
    await request(self.app)
      .delete('/api/treatments/')
      .query('find[carbs]=99')
      .set('api-secret', api_secret_hash || '')
      .expect(200);

    console.log('Testing if entry was deleted');
    const getResponse2 = await request(self.app)
      .get('/api/treatments/')
      .query('find[carbs]=99')
      .set('api-secret', api_secret_hash || '')
      .expect(200);

    expect(getResponse2.body.length).toBe(0);
  });
});
