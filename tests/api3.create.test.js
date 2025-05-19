/* eslint require-atomic-updates: 0 */
'use strict';

import { describe, test, beforeAll, afterAll, beforeEach, afterEach, expect } from 'vitest';
import testConst from './fixtures/api3/const.json';
import instance from './fixtures/api3/instance';
import authSubject from './fixtures/api3/authSubject';
import opTools from '../lib/api3/shared/operationTools';
import utils from './fixtures/api3/utils';

describe('API3 CREATE', () => {
  let self = {
    validDoc: {
      date: (new Date()).getTime(),
      app: testConst.TEST_APP,
      device: testConst.TEST_DEVICE + ' API3 CREATE',
      eventType: 'Correction Bolus',
      insulin: 0.3
    }
  };
  self.validDoc.identifier = opTools.calculateIdentifier(self.validDoc);


  /**
   * Cleanup after successful creation
   */
  self.delete = async function deletePermanent (identifier) {
    let res = await self.instance.delete(`${self.url}/${identifier}?permanent=true`, self.jwt.delete)
      .expect(200);
    expect(res.body.status).toBe(200);
  };


  /**
   * Get document detail for futher processing
   */
  self.get = async function get (identifier) {
    let res = await self.instance.get(`${self.url}/${identifier}`, self.jwt.read)
      .expect(200);
    expect(res.body.status).toBe(200);
    return res.body.result;
  };


  /**
   * Get document detail for futher processing
   */
  self.search = async function search (date) {
    let res = await self.instance.get(`${self.url}?date$eq=${date}`, self.jwt.read)
      .expect(200);
    expect(res.body.status).toBe(200);
    return res.body.result;
  };


  beforeAll(async () => {
    self.instance = await instance.create({});
    self.app = self.instance.app;
    self.env = self.instance.env;
    self.col = 'treatments';
    self.url = `/api/v3/${self.col}`;

    let authResult = await authSubject(self.instance.ctx.authorization.storage, [
      'create',
      'update',
      'read',
      'delete',
      'all'
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
    if (self.cache) expect(self.cache.isEmpty()).toBe(true); // Assuming cache has an isEmpty method or similar check
  });


  test('should require authentication', async () => {
    let res = await self.instance.post(`${self.url}`)
      .send(self.validDoc)
      .expect(401);
    expect(res.body.status).toBe(401);
    expect(res.body.message).toBe('Missing or bad access token or JWT');
  });


  test('should not found not existing collection', async () => {
    let res = await self.instance.post(`/api/v3/NOT_EXIST`, self.jwt.create)
      .send(self.validDoc)
      .expect(404);
    expect(res.body.status).toBe(404);
    expect(res.body.result).toBeUndefined();
  });


  test('should require create permission', async () => {
    let res = await self.instance.post(`${self.url}`, self.jwt.read)
      .send(self.validDoc)
      .expect(403);
    expect(res.body.status).toBe(403);
    expect(res.body.message).toBe('Missing permission api:treatments:create');
  });


  test('should reject empty body', async () => {
    let res = await self.instance.post(self.url, self.jwt.create)
      .send({ })
      .expect(400);
    expect(res.body.status).toBe(400);
  });


  test('should accept valid document', async () => {
    let res = await self.instance.post(self.url, self.jwt.create)
      .send(self.validDoc)
      .expect(201);

    expect(res.body.status).toBe(201);
    expect(res.body.identifier).toBe(self.validDoc.identifier);
    expect(res.headers.location).toBe(`${self.url}/${self.validDoc.identifier}`);
    const lastModifiedBody = res.body.lastModified;
    const lastModified = new Date(res.headers['last-modified']).getTime(); // Last-Modified has trimmed milliseconds

    let body = await self.get(self.validDoc.identifier);
    expect(body).toEqual(expect.objectContaining(self.validDoc));
    expect(body.srvModified).toBe(lastModifiedBody);
    self.cache.nextShouldEql(self.col, self.validDoc)

    const ms = body.srvModified % 1000;
    expect(body.srvModified - ms).toBe(lastModified);
    expect(body.srvCreated - ms).toBe(lastModified);
    expect(body.subject).toBe(self.subject.apiCreate.name);

    await self.delete(self.validDoc.identifier);
    self.cache.nextShouldDeleteLast(self.col)
  });


  test('should reject missing date', async () => {
    let doc = { ...self.validDoc };
    delete doc.date;

    let res = await self.instance.post(self.url, self.jwt.create)
      .send(doc)
      .expect(400);
    expect(res.body.status).toBe(400);
    expect(res.body.message).toBe('Bad or missing date field');
  });


  test('should reject invalid date null', async () => {
    let res = await self.instance.post(self.url, self.jwt.create)
      .send({ ...self.validDoc, date: null })
      .expect(400);
    expect(res.body.status).toBe(400);
    expect(res.body.message).toBe('Bad or missing date field');
  });


  test('should reject invalid date ABC', async () => {
    let res = await self.instance.post(self.url, self.jwt.create)
      .send({ ...self.validDoc, date: 'ABC' })
      .expect(400);
    expect(res.body.status).toBe(400);
    expect(res.body.message).toBe('Bad or missing date field');
  });


  test('should reject invalid date -1', async () => {
    let res = await self.instance.post(self.url, self.jwt.create)
      .send({ ...self.validDoc, date: -1 })
      .expect(400);
    expect(res.body.status).toBe(400);
    expect(res.body.message).toBe('Bad or missing date field');
  });



  test('should reject invalid date 1 (too old)', async () => {
    let res = await self.instance.post(self.url, self.jwt.create)
      .send({ ...self.validDoc, date: 1 })
      .expect(400);
    expect(res.body.status).toBe(400);
    expect(res.body.message).toBe('Bad or missing date field');
  });


  test('should reject invalid date - illegal format', async () => {
    let res = await self.instance.post(self.url, self.jwt.create)
      .send({ ...self.validDoc, date: '2019-20-60T50:90:90' })
      .expect(400);
    expect(res.body.status).toBe(400);
    expect(res.body.message).toBe('Bad or missing date field');
  });


  test('should reject invalid utcOffset -5000', async () => {
    let res = await self.instance.post(self.url, self.jwt.create)
      .send({ ...self.validDoc, utcOffset: -5000 })
      .expect(400);
    expect(res.body.status).toBe(400);
    expect(res.body.message).toBe('Bad or missing utcOffset field');
  });


  test('should reject invalid utcOffset ABC', async () => {
    let res = await self.instance.post(self.url, self.jwt.create)
      .send({ ...self.validDoc, utcOffset: 'ABC' })
      .expect(400);
    expect(res.body.status).toBe(400);
    expect(res.body.message).toBe('Bad or missing utcOffset field');
  });


  test('should accept valid utcOffset', async () => {
    const doc = { ...self.validDoc, utcOffset: 120 };
    await self.instance.post(self.url, self.jwt.create)
      .send(doc)
      .expect(201);

    let body = await self.get(self.validDoc.identifier);
    expect(body.utcOffset).toBe(120);
    self.cache.nextShouldEql(self.col, doc)

    await self.delete(self.validDoc.identifier);
    self.cache.nextShouldDeleteLast(self.col)
  });


  test('should reject invalid utcOffset null', async () => {
    let res = await self.instance.post(self.url, self.jwt.create)
      .send({ ...self.validDoc, utcOffset: null })
      .expect(400);
    expect(res.body.status).toBe(400);
    expect(res.body.message).toBe('Bad or missing utcOffset field');
  });


  test('should reject missing app', async () => {
    let doc = { ...self.validDoc };
    delete doc.app;

    let res = await self.instance.post(self.url, self.jwt.create)
      .send(doc)
      .expect(400);
    expect(res.body.status).toBe(400);
    expect(res.body.message).toBe('Bad or missing app field');
  });


  test('should reject invalid app null', async () => {
    let res = await self.instance.post(self.url, self.jwt.create)
      .send({ ...self.validDoc, app: null })
      .expect(400);
    expect(res.body.status).toBe(400);
    expect(res.body.message).toBe('Bad or missing app field');
  });


  test('should reject empty app', async () => {
    let res = await self.instance.post(self.url, self.jwt.create)
      .send({ ...self.validDoc, app: '' })
      .expect(400);
    expect(res.body.status).toBe(400);
    expect(res.body.message).toBe('Bad or missing app field');
  });


  test('should normalize date and store utcOffset', async () => {
    await self.instance.post(self.url, self.jwt.create)
      .send({ ...self.validDoc, date: '2019-06-10T08:07:08,576+02:00' })
      .expect(201);

    let body = await self.get(self.validDoc.identifier);
    expect(body.date).toBe(1560146828576);
    expect(body.utcOffset).toBe(120);
    self.cache.nextShouldEql(self.col, body)

    await self.delete(self.validDoc.identifier);
    self.cache.nextShouldDeleteLast(self.col)
  });


  test('should require update permission for deduplication', async () => {
    self.validDoc.date = (new Date()).getTime();
    self.validDoc.identifier = utils.randomString('32', 'aA#');
    const doc = { ...self.validDoc };

    await self.instance.post(self.url, self.jwt.create)
      .send(doc)
      .expect(201);

    let createdBody = await self.get(doc.identifier);
    expect(createdBody).toEqual(expect.objectContaining(doc));
    self.cache.nextShouldEql(self.col, doc)

    const doc2 = { ...doc };
    let res = await self.instance.post(self.url, self.jwt.create)
      .send(doc2)
      .expect(403);

    expect(res.body.status).toBe(403);
    expect(res.body.message).toBe('Missing permission api:treatments:update');
    await self.delete(doc.identifier);
    self.cache.nextShouldDeleteLast(self.col)
  });


  test('should upsert document (matched by identifier)', async () => {
    self.validDoc.date = (new Date()).getTime();
    self.validDoc.identifier = utils.randomString('32', 'aA#');
    const doc = { ...self.validDoc };

    await self.instance.post(self.url, self.jwt.create)
      .send(doc)
      .expect(201);

    let createdBody = await self.get(doc.identifier);
    expect(createdBody).toEqual(expect.objectContaining(doc));
    self.cache.nextShouldEql(self.col, doc)

    const doc2 = { ...doc, insulin: 0.5 };

    let resPost2 = await self.instance.post(`${self.url}`, self.jwt.all)
      .send(doc2)
      .expect(200);
    expect(resPost2.body.status).toBe(200);

    let updatedBody = await self.get(doc2.identifier);
    expect(updatedBody).toEqual(expect.objectContaining(doc2));
    self.cache.nextShouldEql(self.col, doc2)

    await self.delete(doc2.identifier);
    self.cache.nextShouldDeleteLast(self.col)
  });


  test('should deduplicate document by created_at+eventType', async () => {
    self.validDoc.date = (new Date()).getTime();
    self.validDoc.identifier = utils.randomString('32', 'aA#');
    const doc = {
      ...self.validDoc,
      created_at: new Date(self.validDoc.date).toISOString()
    };
    delete doc.identifier;

    await new Promise((resolve, reject) => {
      self.instance.ctx.treatments.create([doc], (err) => { // APIv1 style insert
        if (err) return reject(err);
        doc._id = doc._id.toString();
        self.cache.nextShouldEql(self.col, doc)
        resolve(doc);
      });
    });

    const doc2 = {
       ...doc,
        insulin: 0.4,
        identifier: utils.randomString('32', 'aA#')
      };
    delete doc2._id; // Clean up for next operation

    const resPost2 = await self.instance.post(`${self.url}`, self.jwt.all)
      .send(doc2)
      .expect(200);

    expect(resPost2.body.status).toBe(200);
    expect(resPost2.body.identifier).toBe(doc2.identifier);
    expect(resPost2.body.isDeduplication).toBe(true);
    expect(resPost2.body.deduplicatedIdentifier).toBe(doc._id);

    let updatedBody = await self.get(doc2.identifier);
    expect(updatedBody).toEqual(expect.objectContaining(doc2));
    self.cache.nextShouldEql(self.col, doc2)

    await self.delete(doc2.identifier);
    self.cache.nextShouldDeleteLast(self.col)
  });


  test('should not deduplicate treatment only by created_at', async () => {
    self.validDoc.date = (new Date()).getTime();
    self.validDoc.identifier = utils.randomString('32', 'aA#');
    const doc = {
      ...self.validDoc,
      created_at: new Date(self.validDoc.date).toISOString()
    };
    delete doc.identifier;

    await new Promise((resolve, reject) => {
      self.instance.ctx.treatments.create([doc], (err) => { // APIv1 style insert
        if (err) return reject(err);
        doc._id = doc._id.toString();

        self.cache.nextShouldEql(self.col, doc)
        resolve(doc);
      });
    });

    const oldBody = await self.get(doc._id);
    delete doc._id; // Clean up for comparison
    expect(oldBody).toEqual(expect.objectContaining(doc));

    const doc2 = {
      ...doc,
      eventType: 'Meal Bolus',
      insulin: 0.4,
      identifier: utils.randomString('32', 'aA#')
    };

    await self.instance.post(`${self.url}`, self.jwt.all)
      .send(doc2)
      .expect(201);

    let updatedBody = await self.get(doc2.identifier);
    expect(updatedBody).toEqual(expect.objectContaining(doc2));
    expect(updatedBody.identifier).not.toBe(oldBody.identifier);
    expect(updatedBody.isDeduplication).toBeUndefined();
    expect(updatedBody.deduplicatedIdentifier).toBeUndefined();
    self.cache.nextShouldEql(self.col, doc2)

    await self.delete(doc2.identifier);
    self.cache.nextShouldDeleteLast(self.col)

    await self.delete(oldBody.identifier);
    self.cache.nextShouldDeleteLast(self.col)
  });


  test('should overwrite deleted document', async () => {
    const date1 = new Date()
      , identifier = utils.randomString('32', 'aA#')
      , doc = { ...self.validDoc, identifier, date: date1.toISOString() };

    await self.instance.post(self.url, self.jwt.create)
      .send(doc)
      .expect(201);
    self.cache.nextShouldEql(self.col, { ...doc, date: date1.getTime() });

    let resDel = await self.instance.delete(`${self.url}/${identifier}`, self.jwt.delete)
      .expect(200);
    expect(resDel.body.status).toBe(200);
    self.cache.nextShouldDeleteLast(self.col)

    const date2 = new Date();
    let resPost1 = await self.instance.post(self.url, self.jwt.create)
      .send({ ...self.validDoc, identifier, date: date2.toISOString() })
      .expect(403);

    expect(resPost1.body.status).toBe(403);
    expect(resPost1.body.message).toBe('Missing permission api:treatments:update');
    expect(self.cache.isEmpty()).toBe(true);

    const doc2 = { ...self.validDoc, identifier, date: date2.toISOString() };
    let resPost2 = await self.instance.post(`${self.url}`, self.jwt.all)
      .send(doc2)
      .expect(200);

    expect(resPost2.body.status).toBe(200);
    expect(resPost2.body.identifier).toBe(identifier);
    self.cache.nextShouldEql(self.col, { ...doc2, date: date2.getTime() });

    let body = await self.get(identifier);
    expect(body.date).toBe(date2.getTime());
    expect(body.identifier).toBe(identifier);

    await self.delete(identifier);
    self.cache.nextShouldDeleteLast(self.col)
  });


  test('should calculate the identifier', async () => {
    self.validDoc.date = (new Date()).getTime();
    delete self.validDoc.identifier;
    const validIdentifier = opTools.calculateIdentifier(self.validDoc);

    let res = await self.instance.post(self.url, self.jwt.create)
      .send(self.validDoc)
      .expect(201);

    expect(res.body.status).toBe(201);
    expect(res.body.identifier).toBe(validIdentifier);
    expect(res.headers.location).toBe(`${self.url}/${validIdentifier}`);
    self.validDoc.identifier = validIdentifier;

    let body = await self.get(validIdentifier);
    expect(body).toEqual(expect.objectContaining(self.validDoc));
    self.cache.nextShouldEql(self.col, self.validDoc);

    await self.delete(validIdentifier);
    self.cache.nextShouldDeleteLast(self.col)
  });


  test('should deduplicate by identifier calculation', async () => {
    self.validDoc.date = (new Date()).getTime();
    delete self.validDoc.identifier;
    const validIdentifier = opTools.calculateIdentifier(self.validDoc);

    let res = await self.instance.post(self.url, self.jwt.create)
      .send(self.validDoc)
      .expect(201);

    expect(res.body.status).toBe(201);
    expect(res.body.identifier).toBe(validIdentifier);
    expect(res.headers.location).toBe(`${self.url}/${validIdentifier}`);
    self.validDoc.identifier = validIdentifier;

    let body = await self.get(validIdentifier);
    expect(body).toEqual(expect.objectContaining(self.validDoc));
    self.cache.nextShouldEql(self.col, self.validDoc);

    delete self.validDoc.identifier;
    res = await self.instance.post(`${self.url}`, self.jwt.update)
      .send(self.validDoc)
      .expect(200);

    expect(res.body.status).toBe(200);
    expect(res.body.identifier).toBe(validIdentifier);
    expect(res.body.isDeduplication).toBe(true);
    expect(res.body.deduplicatedIdentifier).toBeUndefined(); // no identifier change occured
    expect(res.headers.location).toBe(`${self.url}/${validIdentifier}`);
    self.validDoc.identifier = validIdentifier;
    self.cache.nextShouldEql(self.col, self.validDoc);

    body = await self.search(self.validDoc.date);
    expect(body.length).toBe(1);

    await self.delete(validIdentifier);
    self.cache.nextShouldDeleteLast(self.col)
  });

});

