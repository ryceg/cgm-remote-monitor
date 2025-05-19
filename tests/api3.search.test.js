/* eslint require-atomic-updates: 0 */

'use strict';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('API3 SEARCH', { timeout: 15000 }, function() {
  const self = this
    , testConst = require('./fixtures/api3/const.json')
    , instance = require('./fixtures/api3/instance')
    , authSubject = require('./fixtures/api3/authSubject')
    , opTools = require('../lib/api3/shared/operationTools')
    ;

  self.docs = testConst.SAMPLE_ENTRIES;


  /**
   * Get document detail for futher processing
   */
  self.get = async function get (identifier) { // Removed done callback, using async/await
    const res = await self.instance.get(`${self.url}/${identifier}`, self.jwt.read)
      .expect(200);
    return res.body;
  };


  /**
   * Create given document in a promise
   */
  self.create = async (doc) => { // Simplified to async function
    doc.identifier = opTools.calculateIdentifier(doc);
    await self.instance.post(`${self.url}`, self.jwt.all)
      .send(doc)
      .expect(201); // Assuming 201 is the correct status for post
    return self.get(doc.identifier); // use await with the modified get function
  };


  beforeAll(async () => {
    self.testStarted = new Date();
    self.instance = await instance.create({});

    self.app = self.instance.app;
    self.env = self.instance.env;
    self.url = '/api/v3/entries';

    let authResult = await authSubject(self.instance.ctx.authorization.storage, [
      'read',
      'all'
    ], self.instance.app);

    self.subject = authResult.subject;
    self.jwt = authResult.jwt;
    self.urlTest = `${self.url}?srvModified$gte=${self.testStarted.getTime()}`;

    const promises = testConst.SAMPLE_ENTRIES.map(doc => self.create(doc));
    self.docs = await Promise.all(promises);
  });


  afterAll(() => {
    self.instance.ctx.bus.teardown();
  });


  it('should require authentication', async () => {
    let res = await self.instance.get(self.url)
      .expect(401);

    expect(res.body.status).toBe(401);
    expect(res.body.message).toBe('Missing or bad access token or JWT');
    expect(res.body.result).toBeUndefined();
  });


  it('should not found not existing collection', async () => {
    let res = await self.instance.get(`/api/v3/NOT_EXIST`, self.jwt.read)
      .send(self.validDoc) // self.validDoc is not defined in this file, assuming it might be a typo or from another context
      .expect(404);

    expect(res.body.status).toBe(404);
    expect(res.body.result).toBeUndefined();
  });


  it('should found at least 10 documents', async () => {
    let res = await self.instance.get(self.url, self.jwt.read)
      .expect(200);

    expect(res.body.status).toBe(200);
    expect(res.body.result.length).toBeGreaterThanOrEqual(self.docs.length);
  });


  it('should found at least 10 documents from test start', async () => {
    let res = await self.instance.get(self.urlTest, self.jwt.read)
      .expect(200);

    expect(res.body.status).toBe(200);
    expect(res.body.result.length).toBeGreaterThanOrEqual(self.docs.length);
  });


  it('should reject invalid limit - not a number', async () => {
    let res = await self.instance.get(`${self.url}?limit=INVALID`, self.jwt.read)
      .expect(400);

    expect(res.body.status).toBe(400);
    expect(res.body.message).toBe('Parameter limit out of tolerance');
    expect(res.body.result).toBeUndefined();
  });


  it('should reject invalid limit - negative number', async () => {
    let res = await self.instance.get(`${self.url}?limit=-1`, self.jwt.read)
      .expect(400);

    expect(res.body.status).toBe(400);
    expect(res.body.message).toBe('Parameter limit out of tolerance');
    expect(res.body.result).toBeUndefined();
  });


  it('should reject invalid limit - zero', async () => {
    let res = await self.instance.get(`${self.url}?limit=0`, self.jwt.read)
      .expect(400);

    expect(res.body.status).toBe(400);
    expect(res.body.message).toBe('Parameter limit out of tolerance');
    expect(res.body.result).toBeUndefined();
  });


  it('should accept valid limit', async () => {
    let res = await self.instance.get(`${self.url}?limit=3`, self.jwt.read)
      .expect(200);

    expect(res.body.status).toBe(200);
    expect(res.body.result.length).toBe(3);
  });


  it('should reject invalid skip - not a number', async () => {
    let res = await self.instance.get(`${self.url}?skip=INVALID`, self.jwt.read)
      .expect(400);

    expect(res.body.status).toBe(400);
    expect(res.body.message).toBe('Parameter skip out of tolerance');
    expect(res.body.result).toBeUndefined();
  });


  it('should reject invalid skip - negative number', async () => {
    let res = await self.instance.get(`${self.url}?skip=-5`, self.jwt.read)
      .expect(400);

    expect(res.body.status).toBe(400);
    expect(res.body.message).toBe('Parameter skip out of tolerance');
    expect(res.body.result).toBeUndefined();
  });


  it('should reject both sort and sort$desc', async () => {
    let res = await self.instance.get(`${self.url}?sort=date&sort$desc=created_at`, self.jwt.read)
      .expect(400);

    expect(res.body.status).toBe(400);
    expect(res.body.message).toBe('Parameters sort and sort_desc cannot be combined');
    expect(res.body.result).toBeUndefined();
  });


  it('should sort well by date field', async () => {
    let res = await self.instance.get(`${self.urlTest}&sort=date`, self.jwt.read)
      .expect(200);

    expect(res.body.status).toBe(200);
    const ascending = res.body.result;
    const length = ascending.length;
    expect(length).toBeGreaterThanOrEqual(self.docs.length);

    res = await self.instance.get(`${self.urlTest}&sort$desc=date`, self.jwt.read)
      .expect(200);

    expect(res.body.status).toBe(200);
    const descending = res.body.result;
    expect(descending.length).toBe(length);

    for (let i in ascending) {
      expect(ascending[i]).toEqual(descending[length - i - 1]);

      if (i > 0) {
        expect(ascending[i - 1].date).toBeLessThanOrEqual(ascending[i].date);
      }
    }
  });


  it('should skip documents', async () => {
    let res = await self.instance.get(`${self.url}?sort=date&limit=8`, self.jwt.read)
      .expect(200);

    expect(res.body.status).toBe(200);
    const fullDocs = res.body.result;
    expect(fullDocs.length).toBe(8);

    res = await self.instance.get(`${self.url}?sort=date&skip=3&limit=5`, self.jwt.read)
      .expect(200);

    expect(res.body.status).toBe(200);
    const skipDocs = res.body.result;
    expect(skipDocs.length).toBe(5);

    for (let i = 0; i < 3; i++) {
      expect(skipDocs[i]).toEqual(fullDocs[i + 3]);
    }
  });


  it('should project selected fields', async () => {
    let res = await self.instance.get(`${self.url}?fields=date,app,subject`, self.jwt.read)
      .expect(200);

    expect(res.body.status).toBe(200);
    res.body.result.forEach(doc => {
      const docFields = Object.getOwnPropertyNames(doc);
      expect(docFields.sort()).toEqual(['app', 'date', 'subject']);
    });
  });


  it('should project all fields', async () => {
    let res = await self.instance.get(`${self.url}?fields=_all`, self.jwt.read)
      .expect(200);

    expect(res.body.status).toBe(200);
    res.body.result.forEach(doc => {
      expect(Object.getOwnPropertyNames(doc).length).toBeGreaterThanOrEqual(10);
      expect(Object.prototype.hasOwnProperty.call(doc, '_id')).not.toBe(true);
      expect(Object.prototype.hasOwnProperty.call(doc, 'identifier')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(doc, 'srvModified')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(doc, 'srvCreated')).toBe(true);
    });
  });


  it('should not exceed the limit of docs count', async () => {
    const apiApp = self.instance.ctx.apiApp
      , limitBackup = apiApp.get('API3_MAX_LIMIT');
    apiApp.set('API3_MAX_LIMIT', 5);
    let res = await self.instance.get(`${self.url}?limit=10`, self.jwt.read)
      .expect(400);

    expect(res.body.status).toBe(400);
    expect(res.body.message).toBe('Parameter limit out of tolerance');
    apiApp.set('API3_MAX_LIMIT', limitBackup);
  });


  it('should respect the ceiling (hard) limit of docs', async () => {
    const apiApp = self.instance.ctx.apiApp
      , limitBackup = apiApp.get('API3_MAX_LIMIT');
    apiApp.set('API3_MAX_LIMIT', 5);
    let res = await self.instance.get(`${self.url}`, self.jwt.read)
      .expect(200);

    expect(res.body.status).toBe(200);
    expect(res.body.result.length).toBe(5);
    apiApp.set('API3_MAX_LIMIT', limitBackup);
  });

});

