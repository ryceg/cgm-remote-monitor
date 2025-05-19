/* eslint require-atomic-updates: 0 */
'use strict';

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

describe('API3 PATCH', function() {
  const self = this
    , testConst = require('./fixtures/api3/const.json')
    , instance = require('./fixtures/api3/instance')
    , authSubject = require('./fixtures/api3/authSubject')
    , opTools = require('../lib/api3/shared/operationTools')
    ;

  self.validDoc = {
    date: (new Date()).getTime(),
    utcOffset: -180,
    app: testConst.TEST_APP,
    device: testConst.TEST_DEVICE + ' API3 PATCH',
    eventType: 'Correction Bolus',
    insulin: 0.3
  };
  self.validDoc.identifier = opTools.calculateIdentifier(self.validDoc);


  /**
   * Get document detail for futher processing
   */
  self.get = async function get (identifier) {
    let res = await self.instance.get(`${self.url}/${identifier}`, self.jwt.read)
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
      'read'
    ], self.instance.app);

    self.subject = authResult.subject;
    self.jwt = authResult.jwt;
    self.urlIdent = `${self.url}/${self.validDoc.identifier}`;
    self.cache = self.instance.cacheMonitor;
  });


  afterAll(() => {
    self.instance.ctx.bus.teardown();
  });


  beforeEach(() => {
    self.cache.clear();
  });


  afterEach(() => {
    self.cache.shouldBeEmpty();
  });


  it('should require authentication', async () => {
    let res = await self.instance.patch(`${self.url}/FAKE_IDENTIFIER`)
      .expect(401);

    expect(res.body.status).toBe(401);
    expect(res.body.message).toBe('Missing or bad access token or JWT');
  });


  it('should not found not existing collection', async () => {
    let res = await self.instance.patch(`/api/v3/NOT_EXIST`, self.jwt.update)
      .send(self.validDoc)
      .expect(404);

    expect(res.body.status).toBe(404);
  });


  it('should not found not existing document', async () => {
    let res = await self.instance.patch(self.urlIdent, self.jwt.update)
      .send(self.validDoc)
      .expect(404);

    expect(res.body.status).toBe(404);

    // now let's insert the document for further patching
    res = await self.instance.post(`${self.url}`, self.jwt.create)
      .send(self.validDoc)
      .expect(201);

    expect(res.body.status).toBe(201);
    self.cache.nextShouldEql(self.col, self.validDoc)
  });


  it('should reject identifier alteration', async () => {
    let res = await self.instance.patch(self.urlIdent, self.jwt.update)
      .send(Object.assign({}, self.validDoc, { identifier: 'MODIFIED'}))
      .expect(400);

    expect(res.body.status).toBe(400);
    expect(res.body.message).toBe('Field identifier cannot be modified by the client');
  });


  it('should reject date alteration', async () => {
    let res = await self.instance.patch(self.urlIdent, self.jwt.update)
      .send(Object.assign({}, self.validDoc, { date: self.validDoc.date + 10000 }))
      .expect(400);

    expect(res.body.status).toBe(400);
    expect(res.body.message).toBe('Field date cannot be modified by the client');
  });


  it('should reject utcOffset alteration', async () => {
    let res = await self.instance.patch(self.urlIdent, self.jwt.update)
      .send(Object.assign({}, self.validDoc, { utcOffset: self.utcOffset - 120 }))
      .expect(400);

    expect(res.body.status).toBe(400);
    expect(res.body.message).toBe('Field utcOffset cannot be modified by the client');
  });


  it('should reject eventType alteration', async () => {
    let res = await self.instance.patch(self.urlIdent, self.jwt.update)
      .send(Object.assign({}, self.validDoc, { eventType: 'MODIFIED' }))
      .expect(400);

    expect(res.body.status).toBe(400);
    expect(res.body.message).toBe('Field eventType cannot be modified by the client');
  });


  it('should reject device alteration', async () => {
    let res = await self.instance.patch(self.urlIdent, self.jwt.update)
      .send(Object.assign({}, self.validDoc, { device: 'MODIFIED' }))
      .expect(400);

    expect(res.body.status).toBe(400);
    expect(res.body.message).toBe('Field device cannot be modified by the client');
  });


  it('should reject app alteration', async () => {
    let res = await self.instance.patch(self.urlIdent, self.jwt.update)
      .send(Object.assign({}, self.validDoc, { app: 'MODIFIED' }))
      .expect(400);

    expect(res.body.status).toBe(400);
    expect(res.body.message).toBe('Field app cannot be modified by the client');
  });


  it('should reject srvCreated alteration', async () => {
    let res = await self.instance.patch(self.urlIdent, self.jwt.update)
      .send(Object.assign({}, self.validDoc, { srvCreated: self.validDoc.date - 10000 }))
      .expect(400);

    expect(res.body.status).toBe(400);
    expect(res.body.message).toBe('Field srvCreated cannot be modified by the client');
  });


  it('should reject subject alteration', async () => {
    let res = await self.instance.patch(self.urlIdent, self.jwt.update)
      .send(Object.assign({}, self.validDoc, { subject: 'MODIFIED' }))
      .expect(400);

    expect(res.body.status).toBe(400);
    expect(res.body.message).toBe('Field subject cannot be modified by the client');
  });


  it('should reject srvModified alteration', async () => {
    let res = await self.instance.patch(self.urlIdent, self.jwt.update)
      .send(Object.assign({}, self.validDoc, { srvModified: self.validDoc.date - 100000 }))
      .expect(400);

    expect(res.body.status).toBe(400);
    expect(res.body.message).toBe('Field srvModified cannot be modified by the client');
  });


  it('should reject modifiedBy alteration', async () => {
    let res = await self.instance.patch(self.urlIdent, self.jwt.update)
      .send(Object.assign({}, self.validDoc, { modifiedBy: 'MODIFIED' }))
      .expect(400);

    expect(res.body.status).toBe(400);
    expect(res.body.message).toBe('Field modifiedBy cannot be modified by the client');
  });


  it('should reject isValid alteration', async () => {
    let res = await self.instance.patch(self.urlIdent, self.jwt.update)
      .send(Object.assign({}, self.validDoc, { isValid: false }))
      .expect(400);

    expect(res.body.status).toBe(400);
    expect(res.body.message).toBe('Field isValid cannot be modified by the client');
  });


  it('should patch document', async () => {
    self.validDoc.carbs = 10;

    let res = await self.instance.patch(self.urlIdent, self.jwt.update)
      .send(self.validDoc)
      .expect(200);

    expect(res.body.status).toBe(200);

    let body = await self.get(self.validDoc.identifier);
    expect(body.carbs).toBe(10);
    expect(body.insulin).toBe(0.3);
    expect(body.subject).toBe(self.subject.apiCreate.name);
    expect(body.modifiedBy).toBe(self.subject.apiUpdate.name);

    self.cache.nextShouldEql(self.col, body)
  });

});

