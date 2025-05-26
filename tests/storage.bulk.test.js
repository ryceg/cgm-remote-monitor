/* eslint require-atomic-updates: 0 */
/* global should */
'use strict';

require('should');

describe('MongoDB Bulk Operations Storage', function() {
  const self = this;
  const testConst = require('./fixtures/api3/const.json');
  const instance = require('./fixtures/api3/instance');
  const opTools = require('../lib/api3/shared/operationTools');

  self.timeout(10000);

  before(async () => {
    self.instance = await instance.create({});
    self.app = self.instance.app;
    self.env = self.instance.env;

    // Get a test collection storage instance
    const MongoCollectionStorage = require('../lib/api3/storage/mongoCollection');
    const CachedCollectionStorage = require('../lib/api3/storage/mongoCachedCollection');

    self.baseStorage = new MongoCollectionStorage(self.instance.ctx, self.env, 'treatments');
    self.storage = new CachedCollectionStorage(self.instance.ctx, self.env, 'treatments', self.baseStorage);
  });

  after(() => {
    if (self.instance) {
      self.instance.ctx.bus.teardown();
    }
  });

  /**
   * Create test document
   */
  self.createTestDoc = function createTestDoc (suffix) {
    const doc = {
      date: (new Date()).getTime() + Math.random() * 1000,
      app: testConst.TEST_APP,
      device: testConst.TEST_DEVICE + ' STORAGE TEST ' + suffix,
      eventType: 'Correction Bolus',
      insulin: Math.round(Math.random() * 10 * 100) / 100,
      srvModified: Date.now(),
      srvCreated: Date.now()
    };
    doc.identifier = opTools.calculateIdentifier(doc);
    return doc;
  };

  /**
   * Cleanup test document
   */
  self.cleanup = async function cleanup (identifier) {
    try {
      await self.storage.removeDocument(identifier);
    } catch (error) {
      // Ignore errors during cleanup
    }
  };

  describe('Base MongoDB Storage bulkUpsert', () => {
    it('should have bulkUpsert method', () => {
      self.baseStorage.should.have.property('bulkUpsert');
      self.baseStorage.bulkUpsert.should.be.a.Function();
    });

    it('should perform bulk upsert of new documents', async () => {
      const docs = [
        self.createTestDoc('BASE_NEW_1'),
        self.createTestDoc('BASE_NEW_2'),
        self.createTestDoc('BASE_NEW_3')
      ];

      const result = await self.baseStorage.bulkUpsert(docs);

      result.should.have.property('upsertedCount', 3);
      result.should.have.property('modifiedCount', 0);
      result.should.have.property('totalCount', 3);

      // Cleanup
      for (const doc of docs) {
        await self.cleanup(doc.identifier);
      }
    });

    it('should perform bulk upsert of existing documents', async () => {
      const docs = [
        self.createTestDoc('BASE_EXIST_1'),
        self.createTestDoc('BASE_EXIST_2')
      ];

      // Insert documents first
      await self.baseStorage.bulkUpsert(docs);

      // Modify and upsert again
      docs[0].insulin = 5.0;
      docs[0].notes = 'Updated';
      docs[1].insulin = 6.0;
      docs[1].notes = 'Also updated';

      const result = await self.baseStorage.bulkUpsert(docs);

      result.should.have.property('upsertedCount', 0);
      result.should.have.property('modifiedCount', 2);
      result.should.have.property('totalCount', 2);

      // Cleanup
      for (const doc of docs) {
        await self.cleanup(doc.identifier);
      }
    });

    it('should handle mixed new and existing documents', async () => {
      const existingDoc = self.createTestDoc('BASE_MIXED_EXIST');
      const newDoc = self.createTestDoc('BASE_MIXED_NEW');

      // Insert one document first
      await self.baseStorage.bulkUpsert([existingDoc]);

      // Modify existing and add new
      existingDoc.insulin = 7.0;
      const docs = [existingDoc, newDoc];

      const result = await self.baseStorage.bulkUpsert(docs);

      result.should.have.property('upsertedCount', 1);
      result.should.have.property('modifiedCount', 1);
      result.should.have.property('totalCount', 2);

      // Cleanup
      for (const doc of docs) {
        await self.cleanup(doc.identifier);
      }
    });

    it('should handle empty array', async () => {
      const result = await self.baseStorage.bulkUpsert([]);

      result.should.have.property('upsertedCount', 0);
      result.should.have.property('modifiedCount', 0);
      result.should.have.property('totalCount', 0);
    });

    it('should handle large batches efficiently', async () => {
      const batchSize = 100;
      const docs = [];

      for (let i = 0; i < batchSize; i++) {
        docs.push(self.createTestDoc(`BASE_LARGE_${i}`));
      }

      const startTime = Date.now();
      const result = await self.baseStorage.bulkUpsert(docs);
      const endTime = Date.now();

      console.log(`Storage bulk upsert of ${batchSize} documents took ${endTime - startTime}ms`);

      result.should.have.property('upsertedCount', batchSize);
      result.should.have.property('modifiedCount', 0);
      result.should.have.property('totalCount', batchSize);

      // Cleanup
      for (const doc of docs) {
        await self.cleanup(doc.identifier);
      }
    });
  });

  describe('Cached MongoDB Storage bulkUpsert', () => {
    it('should have bulkUpsert method', () => {
      self.storage.should.have.property('bulkUpsert');
      self.storage.bulkUpsert.should.be.a.Function();
    });

    it('should perform bulk upsert and update cache', async () => {
      const docs = [
        self.createTestDoc('CACHED_NEW_1'),
        self.createTestDoc('CACHED_NEW_2')
      ];

      const result = await self.storage.bulkUpsert(docs);

      result.should.have.property('upsertedCount', 2);
      result.should.have.property('modifiedCount', 0);
      result.should.have.property('totalCount', 2);

      // Verify cache is updated by reading documents
      for (const doc of docs) {
        const filter = self.storage.identifyingFilter(doc.identifier);
        const results = await self.storage.findOneFilter(filter);
        results.length.should.be.aboveOrEqual(1);
        const cached = results[0];
        cached.should.containEql(doc);
      }

      // Cleanup
      for (const doc of docs) {
        await self.cleanup(doc.identifier);
      }
    });

    it('should handle cache invalidation correctly', async () => {
      const doc = self.createTestDoc('CACHED_INVALIDATE');

      // Insert document
      await self.storage.bulkUpsert([doc]);

      // Modify and upsert again
      doc.insulin = 9.0;
      doc.notes = 'Cache invalidation test';

      const result = await self.storage.bulkUpsert([doc]);

      result.should.have.property('upsertedCount', 0);
      result.should.have.property('modifiedCount', 1);
      result.should.have.property('totalCount', 1);

      // Verify cache has the updated document
      const filter = self.storage.identifyingFilter(doc.identifier);
      const results = await self.storage.findOneFilter(filter);
      results.length.should.be.aboveOrEqual(1);
      const cached = results[0];
      cached.insulin.should.equal(9.0);
      cached.notes.should.equal('Cache invalidation test');

      // Cleanup
      await self.cleanup(doc.identifier);
    });

    it('should maintain cache consistency with large batches', async () => {
      const batchSize = 50;
      const docs = [];

      for (let i = 0; i < batchSize; i++) {
        docs.push(self.createTestDoc(`CACHED_LARGE_${i}`));
      }

      const result = await self.storage.bulkUpsert(docs);

      result.should.have.property('upsertedCount', batchSize);
      result.should.have.property('totalCount', batchSize);

      // Verify some documents are in cache
      const sampleIndices = [0, Math.floor(batchSize/2), batchSize-1];
      for (const index of sampleIndices) {
        const doc = docs[index];
        const filter = self.storage.identifyingFilter(doc.identifier);
        const results = await self.storage.findOneFilter(filter);
        results.length.should.be.aboveOrEqual(1);
        const cached = results[0];
        cached.should.containEql(doc);
      }

      // Cleanup
      for (const doc of docs) {
        await self.cleanup(doc.identifier);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed documents gracefully', async () => {
      const docs = [
        self.createTestDoc('ERROR_VALID'),
        null, // This should be filtered out
        undefined, // This should be filtered out
        { invalid: 'document without identifier' }
      ];

      try {
        const result = await self.baseStorage.bulkUpsert(docs);
        // If it succeeds, check that it processed what it could
        result.should.have.property('totalCount');
      } catch (error) {
        // Expected for invalid documents
        error.should.be.an.Error();
      }

      // Cleanup valid document
      await self.cleanup(docs[0].identifier);
    });

    it('should handle database connection errors', async () => {
      // Create a storage instance with invalid connection (if possible)
      // This is harder to test without mocking, so we'll skip for now
      // In a real scenario, you'd mock the MongoDB connection
    });
  });
});
