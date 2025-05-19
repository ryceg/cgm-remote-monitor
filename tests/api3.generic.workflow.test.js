/* eslint require-atomic-updates: 0 */
'use strict';

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

describe('Generic REST API3', { timeout: 30000 }, function() {
  const self = this
    , testConst = require('./fixtures/api3/const.json')
    , instance = require('./fixtures/api3/instance')
    , authSubject = require('./fixtures/api3/authSubject')
    , opTools = require('../lib/api3/shared/operationTools')
    ;

  self.urlLastModified = '/api/v3/lastModified';
  self.historyTimestamp = 0;

  self.docOriginal = {
    eventType: 'Correction Bolus',
    insulin: 1,
    date: (new Date()).getTime(),
    app: testConst.TEST_APP,
    device: testConst.TEST_DEVICE + ' Generic REST API3'
  };
  self.identifier = opTools.calculateIdentifier(self.docOriginal);
  self.docOriginal.identifier = self.identifier;

  // this.timeout(30000); // Moved to describe options

  beforeAll(async () => {
    self.instance = await instance.create({});

    self.app = self.instance.app;
    self.env = self.instance.env;
    self.col = 'treatments';
    self.urlCol = `/api/v3/${self.col}`;
    self.urlResource = self.urlCol + '/' + self.identifier;
    self.urlHistory = self.urlCol + '/history';

    let authResult = await authSubject(self.instance.ctx.authorization.storage, [
      'create',
      'update',
      'read',
      'delete'
    ], self.instance.app);

    self.subject = authResult.subject;
    self.jwt = authResult.jwt;
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


  self.checkHistoryExistence = async function checkHistoryExistence (assertions) {

    let res = await self.instance.get(`${self.urlHistory}/${self.historyTimestamp}`, self.jwt.read)
      .expect(200);

    expect(res.body.status).toBe(200);
    expect(res.body.result.length).toBeGreaterThan(0);

    const originalHistoryTimestamp = self.historyTimestamp;
    let foundAndAsserted = false;

    for (const value of res.body.result) {
      try {
        expect(value.identifier).toEqual(self.identifier);
        expect(value.srvModified).toBeGreaterThan(originalHistoryTimestamp);

        if (typeof(assertions) === 'function') {
          assertions(value);
        }
        self.historyTimestamp = value.srvModified;
        foundAndAsserted = true;
        break;
      } catch (e) {
        // This item didn't meet all criteria, or assertions failed. Continue to the next.
      }
    }
    expect(foundAndAsserted).toBe(true);
  };


  it('LAST MODIFIED to get actual server timestamp', async () => {
    let res = await self.instance.get(`${self.urlLastModified}`, self.jwt.read)
      .expect(200);

    expect(res.body.status).toBe(200);
    self.historyTimestamp = res.body.result.collections.treatments;
    if (!self.historyTimestamp) {
      self.historyTimestamp = res.body.result.srvDate - (10 * 60 * 1000);
    }
    expect(self.historyTimestamp).toBeGreaterThanOrEqual(testConst.YEAR_2019);
  });


  it('STATUS to get actual server timestamp', async () => {
    let res = await self.instance.get(`/api/v3/status`, self.jwt.read)
      .expect(200);

    expect(res.body.status).toBe(200);
    self.historyTimestamp = res.body.result.srvDate;
    expect(self.historyTimestamp).toBeGreaterThanOrEqual(testConst.YEAR_2019);
  });


  it('READ of not existing document is not found', async () => {
    await self.instance.get(`${self.urlResource}`, self.jwt.read)
      .expect(404);
  });


  it('SEARCH of not existing document (not found)', async () => {
    let res = await self.instance.get(`${self.urlCol}`, self.jwt.read)
      .query({ 'identifier_eq': self.identifier })
      .expect(200);

    expect(res.body.status).toBe(200);
    expect(res.body.result).toHaveLength(0);
  });


  it('DELETE of not existing document is not found', async () => {
    await self.instance.delete(`${self.urlResource}`, self.jwt.delete)
      .expect(404);
  });


  it('CREATE new document', async () => {
    await self.instance.post(`${self.urlCol}`, self.jwt.create)
      .send(self.docOriginal)
      .expect(201);

    self.cache.nextShouldEql(self.col, self.docOriginal)
  });


  it('READ existing document', async () => {
    let res = await self.instance.get(`${self.urlResource}`, self.jwt.read)
      .expect(200);

    expect(res.body.status).toBe(200);
    expect(res.body.result).toMatchObject(self.docOriginal);
    self.docActual = res.body.result;

    if (self.historyTimestamp >= self.docActual.srvModified) {
      self.historyTimestamp = self.docActual.srvModified - 1;
    }
  });


  it('SEARCH existing document (found)', async () => {
    let res = await self.instance.get(`${self.urlCol}`, self.jwt.read)
      .query({ 'identifier$eq': self.identifier })
      .expect(200);

    expect(res.body.status).toBe(200);
    expect(res.body.result.length).toBeGreaterThan(0);
    const found = res.body.result.some(value => {
      try {
        expect(value.identifier).toEqual(self.identifier);
        return true;
      } catch {
        return false;
      }
    });
    expect(found).toBe(true);
  });


  it('new document in HISTORY', async () => {
    await self.checkHistoryExistence();
  });


  it('UPDATE document', async () => {
    self.docActual.insulin = 0.5;

    let res = await self.instance.put(`${self.urlResource}`, self.jwt.update)
      .send(self.docActual)
      .expect(200);

    expect(res.body.status).toBe(200);
    self.docActual.subject = self.subject.apiUpdate.name;
    delete self.docActual.srvModified;

    self.cache.nextShouldEql(self.col, self.docActual)
  });


  it('document changed in HISTORY', async () => {
    await self.checkHistoryExistence();
  });


  it('document changed in READ', async () => {
    let res = await self.instance.get(`${self.urlResource}`, self.jwt.read)
      .expect(200);

    expect(res.body.status).toBe(200);
    delete self.docActual.srvModified;
    expect(res.body.result).toMatchObject(self.docActual);
    self.docActual = res.body.result;
  });


  it('PATCH document', async () => {
    self.docActual.carbs = 5;
    self.docActual.insulin = 0.4;

    let res = await self.instance.patch(`${self.urlResource}`, self.jwt.update)
      .send({ 'carbs': self.docActual.carbs, 'insulin': self.docActual.insulin })
      .expect(200);

    expect(res.body.status).toBe(200);
    delete self.docActual.srvModified;

    self.cache.nextShouldEql(self.col, self.docActual)
  });


  it('document changed in HISTORY', async () => {
    await self.checkHistoryExistence();
  });


  it('document changed in READ', async () => {
    let res = await self.instance.get(`${self.urlResource}`, self.jwt.read)
      .expect(200);

    expect(res.body.status).toBe(200);
    delete self.docActual.srvModified;
    expect(res.body.result).toMatchObject(self.docActual);
    self.docActual = res.body.result;
  });


  it('soft DELETE', async () => {
    let res = await self.instance.delete(`${self.urlResource}`, self.jwt.delete)
      .expect(200);

    expect(res.body.status).toBe(200);
    self.cache.nextShouldDeleteLast(self.col)
  });


  it('READ of deleted is gone', async () => {
    await self.instance.get(`${self.urlResource}`, self.jwt.read)
      .expect(410);
  });


  it('SEARCH of deleted document missing it', async () => {
    let res = await self.instance.get(`${self.urlCol}`, self.jwt.read)
      .query({ 'identifier_eq': self.identifier })
      .expect(200);

    expect(res.body.status).toBe(200);
    expect(res.body.result).toHaveLength(0);
  });


  it('document deleted in HISTORY', async () => {
    await self.checkHistoryExistence(value => {
      expect(value.isValid).toBe(false);
    });
  });


  it('permanent DELETE', async () => {
    let res = await self.instance.delete(`${self.urlResource}`, self.jwt.delete)
      .query({ 'permanent': 'true' })
      .expect(200);

    expect(res.body.status).toBe(200);
    self.cache.nextShouldDeleteLast(self.col)
  });


  it('READ of permanently deleted is not found', async () => {
    await self.instance.get(`${self.urlResource}`, self.jwt.read)
      .expect(404);
  });


  it('document permanently deleted not in HISTORY', async () => {
    let res = await self.instance.get(`${self.urlHistory}/${self.historyTimestamp}`, self.jwt.read);

    expect(res.body.status).toBe(200);
    res.body.result.forEach(value => {
      expect(value.identifier).not.toEqual(self.identifier);
    });
  });


  it('should not modify read-only document', async () => {
    await self.instance.post(`${self.urlCol}`, self.jwt.create)
      .send(Object.assign({}, self.docOriginal, { isReadOnly: true }))
      .expect(201);

    let res = await self.instance.get(`${self.urlResource}`, self.jwt.read)
      .expect(200);

    expect(res.body.status).toBe(200);
    self.docActual = res.body.result;
    delete self.docActual.srvModified;
    const readOnlyMessage = 'Trying to modify read-only document';

    self.cache.nextShouldEql(self.col, self.docActual)
    self.cache.shouldBeEmpty()

    res = await self.instance.post(`${self.urlCol}`, self.jwt.update)
      .send(Object.assign({}, self.docActual, { insulin: 0.41 }))
      .expect(422);
    expect(res.body.message).toBe(readOnlyMessage);

    res = await self.instance.put(`${self.urlResource}`, self.jwt.update)
      .send(Object.assign({}, self.docActual, { insulin: 0.42 }))
      .expect(422);
    expect(res.body.message).toBe(readOnlyMessage);

    res = await self.instance.patch(`${self.urlResource}`, self.jwt.update)
      .send({ insulin: 0.43 })
      .expect(422);
    expect(res.body.message).toBe(readOnlyMessage);

    res = await self.instance.delete(`${self.urlResource}`, self.jwt.delete)
      .query({ 'permanent': 'true' })
      .expect(422);
    expect(res.body.message).toBe(readOnlyMessage);

    res = await self.instance.get(`${self.urlResource}`, self.jwt.read)
      .expect(200);
    expect(res.body.status).toBe(200);
    expect(res.body.result).toMatchObject(self.docOriginal);
  });

});

