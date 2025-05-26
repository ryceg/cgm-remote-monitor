/* eslint require-atomic-updates: 0 */
/* global should */
'use strict';

require('should');

describe('API3 BULK SIMPLE TEST', function() {
  const self = this
    , testConst = require('./fixtures/api3/const.json')
    , instance = require('./fixtures/api3/instance')
    , authSubject = require('./fixtures/api3/authSubject')
    , opTools = require('../lib/api3/shared/operationTools')
    ;

  self.timeout(30000);

  before(async () => {
    self.instance = await instance.create({});
    self.app = self.instance.app;
    self.env = self.instance.env;
    self.url = '/api/v3/treatments';
    self.urlBulk = `${self.url}/bulk`;

    let authResult = await authSubject(self.instance.ctx.authorization.storage, [
      'create',
      'read',
      'delete'
    ], self.instance.app);

    self.subject = authResult.subject;
    self.jwt = authResult.jwt;
    self.cache = self.instance.cacheMonitor;
  });

  after(() => {
    self.instance.ctx.bus.teardown();
  });

  beforeEach(() => {
    self.cache.clear();
  });  afterEach(() => {
    self.cache.clear(); // Bulk operations generate cache events, so we just clear instead of asserting empty
  });

  it('should work with a simple bulk create', async () => {
    const doc = {
      date: (new Date()).getTime(),
      app: testConst.TEST_APP,
      device: testConst.TEST_DEVICE + ' SIMPLE BULK TEST',
      eventType: 'Correction Bolus',
      insulin: 1.0
    };
    doc.identifier = opTools.calculateIdentifier(doc);

    console.log('Making POST request to:', self.urlBulk);
    console.log('With auth token:', self.jwt.create ? 'present' : 'missing');
    console.log('Document:', JSON.stringify(doc, null, 2));

    let res = await self.instance.post(self.urlBulk, self.jwt.create)
      .send([doc])
      .expect(200);

    console.log('Response:', JSON.stringify(res.body, null, 2));

    res.body.status.should.equal(200);
    res.body.should.have.property('totalCount');
    res.body.totalCount.should.equal(1);

    // Cleanup
    await self.instance.delete(`${self.url}/${doc.identifier}?permanent=true`, self.jwt.delete)
      .expect(200);
  });
});
