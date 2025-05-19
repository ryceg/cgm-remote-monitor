/* eslint require-atomic-updates: 0 */
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import * as testConst from './fixtures/api3/const.json';
import * as apiConst from '../lib/api3/const.json';
import { create as createInstance } from './fixtures/api3/instance';
import createAuthSubject from './fixtures/api3/authSubject';
import { randomString } from './fixtures/api3/utils';

describe('Socket.IO in REST API3', { timeout: 30000 }, () => {
  let instance;
  let colName;
  let urlCol;
  let urlResource;
  // let urlHistory; // Unused variable
  let subject;
  let jwt;
  let accessToken;
  let socket;
  let docOriginal;
  let docActual;
  const identifier = randomString('32', 'aA#'); // let's have a brand new identifier for your testing document

  beforeAll(async () => {
    instance = await createInstance({
      storageSocket: true
    });

    colName = 'treatments';
    urlCol = `/api/v3/${colName}`;
    urlResource = `${urlCol}/${identifier}`;
    // urlHistory = `${urlCol}/history`; // Unused variable

    let authResult = await createAuthSubject(instance.ctx.authorization.storage, [
      'create',
      'update',
      'delete',
      'denied' // Added denied for the 'should not subscribe by subject with no rights' test
    ], instance.app);

    subject = authResult.subject;
    jwt = authResult.jwt;
    accessToken = authResult.accessToken;
    socket = instance.clientSocket;

    docOriginal = {
      identifier: identifier,
      eventType: 'Correction Bolus',
      insulin: 1,
      date: (new Date()).getTime(),
      app: testConst.TEST_APP
    };
  });

  afterAll(() => {
    if(instance && instance.clientSocket && instance.clientSocket.connected) {
      instance.clientSocket.disconnect();
    }
    instance.ctx.bus.teardown();
  });

  it('should not subscribe without accessToken', () => new Promise(done => {
    socket.emit('subscribe', { }, function (data) {
      expect(data.success).not.toBe(true);
      expect(data.message).toBe(apiConst.MSG.SOCKET_MISSING_OR_BAD_ACCESS_TOKEN);
      done(null);
    });
  }));

  it('should not subscribe by invalid accessToken', () => new Promise(done => {
    socket.emit('subscribe', { accessToken: 'INVALID' }, function (data) {
      expect(data.success).not.toBe(true);
      expect(data.message).toBe(apiConst.MSG.SOCKET_MISSING_OR_BAD_ACCESS_TOKEN);
      done(null);
    });
  }));

  it('should not subscribe by subject with no rights', () => new Promise(done => {
    socket.emit('subscribe', { accessToken: accessToken.denied }, function (data) {
      expect(data.success).not.toBe(true);
      expect(data.message).toBe(apiConst.MSG.SOCKET_UNAUTHORIZED_TO_ANY);
      done(null);
    });
  }));

  it('should subscribe by valid accessToken', () => new Promise(done => {
    const cols = ['entries', 'treatments'];

    socket.emit('subscribe', {
      accessToken: accessToken.all,
      collections: cols
    }, function (data) {
      expect(data.success).toBe(true);
      expect(data.collections.sort()).toEqual(cols);
      done(null);
    });
  }));

  it('should emit create event on CREATE', () => new Promise(done => {
    socket.once('create', (event) => {
      expect(event.colName).toBe(colName);
      expect(event.doc).toEqual(expect.objectContaining(docOriginal));
      delete event.doc.subject;
      docActual = event.doc;
      done(null);
    });

    instance.post(`${urlCol}`, jwt.create)
      .send(docOriginal)
      .expect(201)
      .end((err) => {
        expect(err).toBeNull();
      });
  }));

  it('should emit update event on UPDATE', () => new Promise(done => {
    docActual.insulin = 0.5;

    socket.once('update', (event) => {
      delete docActual.srvModified;
      expect(event.colName).toBe(colName);
      expect(event.doc).toEqual(expect.objectContaining(docActual));
      delete event.doc.subject;
      docActual = event.doc;
      done(null);
    });

    instance.put(`${urlResource}`, jwt.update)
      .send(docActual)
      .expect(200)
      .end((err) => {
        expect(err).toBeNull();
        docActual.subject = subject.apiUpdate.name; // This was using self.subject before
      });
  }));

  it('should emit update event on PATCH', () => new Promise(done => {
    docActual.carbs = 5;
    docActual.insulin = 0.4;

    socket.once('update', (event) => {
      delete docActual.srvModified;
      expect(event.colName).toBe(colName);
      expect(event.doc).toEqual(expect.objectContaining(docActual));
      delete event.doc.subject;
      docActual = event.doc;
      done(null);
    });

    instance.patch(`${urlResource}`, jwt.update)
      .send({ 'carbs': docActual.carbs, 'insulin': docActual.insulin })
      .expect(200)
      .end((err) => {
        expect(err).toBeNull();
      });
  }));

  it('should emit delete event on DELETE', () => new Promise(done => {
    socket.once('delete', (event) => {
      expect(event.colName).toBe(colName);
      expect(event.identifier).toBe(identifier);
      done(null);
    });

    instance.delete(`${urlResource}`, jwt.delete)
      .expect(200)
      .end((err) => {
        expect(err).toBeNull();
      });
  }));
});

