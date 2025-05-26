/* eslint require-atomic-updates: 0 */
/* global should */
'use strict';

require('should');

describe('Bulk Operations Performance Test', function() {
  const self = this;
  const testConst = require('./fixtures/api3/const.json');
  const instance = require('./fixtures/api3/instance');
  const authSubject = require('./fixtures/api3/authSubject');
  const opTools = require('../lib/api3/shared/operationTools');

  self.timeout(60000); // Extended timeout for performance tests

  before(async () => {
    self.instance = await instance.create({}); // Pass empty object to instance.create
    self.app = self.instance.app;
    self.env = self.instance.env;
    self.url = '/api/v3/treatments';
    self.urlBulk = `${self.url}/bulk`;

    let authResult = await authSubject(self.instance.ctx.authorization.storage, ['create', 'delete'], self.app);
    self.subject = authResult.subject;
    self.jwt = authResult.jwt;
  });

  after(() => {
    self.instance.ctx.bus.teardown();
  });

  /**
   * Create test document
   */
  self.createTestDoc = function createTestDoc (suffix) {
    const doc = {
      date: (new Date()).getTime() + Math.floor(Math.random() * 1000),
      app: testConst.TEST_APP,
      device: testConst.TEST_DEVICE + ' PERF TEST ' + suffix,
      eventType: 'Correction Bolus',
      insulin: Math.round(Math.random() * 10 * 100) / 100
    };
    doc.identifier = opTools.calculateIdentifier(doc);
    return doc;
  };

  /**
   * Cleanup after test
   */
  self.cleanup = async function cleanup (identifiers) {
    for (const identifier of identifiers) {
      try {
        await self.instance.delete(`${self.url}/${identifier}?permanent=true`, self.jwt.delete);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  };

  it('should demonstrate significant performance improvement with bulk operations', async () => {
    const testSizes = [10, 50, 100];
    const results = {};

    for (const size of testSizes) {
      console.log(`\nTesting with ${size} documents:`);

      // Test individual operations
      const individualDocs = [];
      for (let i = 0; i < size; i++) {
        individualDocs.push(self.createTestDoc(`INDIVIDUAL_${size}_${i}`));
      }

      const startIndividual = Date.now();
      for (const doc of individualDocs) {
        await self.instance.post(self.url, self.jwt.create)
          .send(doc)
          .expect(201);
      }
      const endIndividual = Date.now();
      const individualTime = endIndividual - startIndividual;

      // Test bulk operations
      const bulkDocs = [];
      for (let i = 0; i < size; i++) {
        bulkDocs.push(self.createTestDoc(`BULK_${size}_${i}`));
      }

      const startBulk = Date.now();
      let res = await self.instance.post(self.urlBulk, self.jwt.create)
        .send(bulkDocs)
        .expect(200);
      const endBulk = Date.now();
      const bulkTime = endBulk - startBulk;

      res.body.status.should.equal(200);
      res.body.totalCount.should.equal(size);
      res.body.upsertedCount.should.equal(size);

      const improvement = Math.round(((individualTime - bulkTime) / individualTime) * 100);

      results[size] = {
        individual: individualTime,
        bulk: bulkTime,
        improvement: improvement,
        speedup: Math.round((individualTime / bulkTime) * 100) / 100
      };

      console.log(`  Individual operations: ${individualTime}ms`);
      console.log(`  Bulk operation: ${bulkTime}ms`);
      console.log(`  Performance improvement: ${improvement}%`);
      console.log(`  Speed-up factor: ${results[size].speedup}x`);

      // Cleanup
      const allIdentifiers = [...individualDocs.map(d => d.identifier), ...bulkDocs.map(d => d.identifier)];
      await self.cleanup(allIdentifiers);
    }

    // Verify that bulk operations are faster for larger datasets
    if (results[100]) {
      results[100].improvement.should.be.greaterThan(0, 'Bulk operations should be faster than individual operations');
      results[100].speedup.should.be.greaterThan(1.5, 'Bulk operations should be at least 1.5x faster');
    }

    console.log('\nPerformance Test Summary:');
    console.table(results);
  });

  it('should handle duplicate record scenarios efficiently', async () => {
    console.log('\nTesting duplicate record scenarios:');

    const batchSize = 50;

    // Create initial documents
    const docs = [];
    for (let i = 0; i < batchSize; i++) {
      docs.push(self.createTestDoc(`DUPLICATE_${i}`));
    }

    // First bulk insert (all new)
    console.log(`Creating ${batchSize} fresh documents...`);
    const startFresh = Date.now();
    let res = await self.instance.post(self.urlBulk, self.jwt.create)
      .send(docs)
      .expect(200);
    const endFresh = Date.now();
    const freshTime = endFresh - startFresh;

    res.body.upsertedCount.should.equal(batchSize);
    res.body.modifiedCount.should.equal(0);

    // Modify and re-upsert same documents (all duplicates)
    docs.forEach((doc, index) => {
      doc.insulin = (index + 1) * 0.5;
      doc.notes = `Updated duplicate ${index}`;
    });

    console.log(`Updating ${batchSize} duplicate documents...`);
    const startDuplicates = Date.now();
    res = await self.instance.post(self.urlBulk, self.jwt.create)
      .send(docs)
      .expect(200);
    const endDuplicates = Date.now();
    const duplicatesTime = endDuplicates - startDuplicates;

    res.body.upsertedCount.should.equal(0);
    res.body.modifiedCount.should.equal(batchSize);

    console.log(`  Fresh documents: ${freshTime}ms`);
    console.log(`  Duplicate documents: ${duplicatesTime}ms`);
    console.log(`  Ratio (duplicates/fresh): ${Math.round((duplicatesTime / freshTime) * 100) / 100}x`);

    // The key insight: duplicates should NOT take twice as long as fresh records
    // This was the original problem we're solving
    const ratio = duplicatesTime / freshTime;
    ratio.should.be.lessThan(1.5, 'Duplicate records should not take significantly longer than fresh records');

    // Cleanup
    await self.cleanup(docs.map(d => d.identifier));
  });

  it('should scale linearly with document count', async () => {
    console.log('\nTesting scalability:');

    const sizes = [25, 50, 100];
    const times = {};

    for (const size of sizes) {
      const docs = [];
      for (let i = 0; i < size; i++) {
        docs.push(self.createTestDoc(`SCALE_${size}_${i}`));
      }

      const start = Date.now();
      let res = await self.instance.post(self.urlBulk, self.jwt.create)
        .send(docs)
        .expect(200);
      const end = Date.now();

      times[size] = end - start;
      res.body.totalCount.should.equal(size);

      console.log(`  ${size} documents: ${times[size]}ms (${Math.round(times[size]/size)}ms per doc)`);

      // Cleanup
      await self.cleanup(docs.map(d => d.identifier));
    }

    // Check that performance scales reasonably (should be roughly linear)
    const perDocTime25 = times[25] / 25;
    const perDocTime100 = times[100] / 100;
    const scalingFactor = perDocTime100 / perDocTime25;

    console.log(`  Scaling factor (100 vs 25): ${Math.round(scalingFactor * 100) / 100}x`);
    scalingFactor.should.be.lessThan(3, 'Per-document time should not increase dramatically with batch size');
  });
});
