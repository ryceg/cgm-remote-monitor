'use strict';

const _ = require('lodash')

/**
 * Storage implementation which wraps mongo baseStorage with caching
 * @param {Object} ctx
 * @param {Object} env
 * @param {string} colName - name of the collection in mongo database
 * @param {Object} baseStorage - wrapped mongo storage implementation
 */
function MongoCachedCollection (ctx, env, colName, baseStorage) {

  const self = this;

  self.colName = colName;

  self.identifyingFilter = baseStorage.identifyingFilter;

  self.findOne = (...args) => baseStorage.findOne(...args);

  self.findOneFilter = (...args) => baseStorage.findOneFilter(...args);

  self.findMany = (...args) => baseStorage.findMany(...args);


  self.insertOne = async (doc) => {
    const result = await baseStorage.insertOne(doc, { normalize: false });

    if (cacheSupported()) {
      updateInCache([doc]);
    }

    if (doc._id) {
      delete doc._id;
    }
    return result;
  }


  self.replaceOne = async (identifier, doc) => {
    const result = await baseStorage.replaceOne(identifier, doc);

    if (cacheSupported()) {
      const rawDocs = await baseStorage.findOne(identifier, null, { normalize: false })
      updateInCache([rawDocs[0]])
    }

    return result;
  }


  self.updateOne = async (identifier, setFields) => {
    const result = await baseStorage.updateOne(identifier, setFields);

    if (cacheSupported()) {
      const rawDocs = await baseStorage.findOne(identifier, null, { normalize: false })

      if (rawDocs[0].isValid === false) {
        deleteInCache(rawDocs)
      }
      else {
        updateInCache([rawDocs[0]])
      }
    }

    return result;
  }

  self.deleteOne = async (identifier) => {
    let invalidateDocs
    if (cacheSupported()) {
      invalidateDocs = await baseStorage.findOne(identifier, { _id: 1 }, { normalize: false })
    }

    const result = await baseStorage.deleteOne(identifier);

    if (cacheSupported()) {
      deleteInCache(invalidateDocs)
    }

    return result;
  }

  self.deleteManyOr = async (filter) => {
    let invalidateDocs
    if (cacheSupported()) {
      invalidateDocs = await baseStorage.findMany({ filter,
        limit: 1000,
        skip: 0,
        projection: { _id: 1 },
        options: { normalize: false } });
    }

    const result = await baseStorage.deleteManyOr(filter);

    if (cacheSupported()) {
      deleteInCache(invalidateDocs)
    }

    return result;
  }

  self.bulkUpsert = async (docs, options) => {
    const result = await baseStorage.bulkUpsert(docs, options);

    if (cacheSupported()) {
      // For bulk upserts, we need to update cache for all affected documents
      // Since we don't know which were inserts vs updates, we'll invalidate and refresh
      const identifiers = docs.map(doc => doc.identifier).filter(Boolean);

      if (identifiers.length > 0) {
        // Fetch the latest versions of all upserted documents
        const rawDocs = await Promise.all(
          identifiers.map(identifier =>
            baseStorage.findOne(identifier, null, { normalize: false })
          )
        );

        // Update cache with the latest versions
        const flatDocs = rawDocs.flat().filter(doc => doc);
        if (flatDocs.length > 0) {
          updateInCache(flatDocs);
        }
      }
    }

    return result;
  }

  self.version = (...args) => baseStorage.version(...args);

  self.getLastModified = (...args) => baseStorage.getLastModified(...args);

  function cacheSupported () {
    return ctx.cache
      && ctx.cache[colName]
      && _.isArray(ctx.cache[colName]);
  }

  function updateInCache (doc) {
    if (doc && doc.isValid === false) {
      deleteInCache([doc._id])
    }
    else {
      ctx.bus.emit('data-update', {
        type: colName
        , op: 'update'
        , changes: doc
      });
    }
  }

  function deleteInCache (docs) {
    let changes
    if (_.isArray(docs)) {
      if (docs.length === 0) {
        return
      }
      else if (docs.length === 1 && docs[0]._id) {
        const _id = docs[0]._id.toString()
        changes = [ _id ]
      }
    }

    ctx.bus.emit('data-update', {
      type: colName
      , op: 'remove'
      , changes
    });
  }
}

module.exports = MongoCachedCollection;
