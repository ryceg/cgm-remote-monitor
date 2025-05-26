'use strict';

const utils = require('./utils')
 ;

/**
 * Insert single document
 * @param {Object} col
 * @param {Object} doc
 * @param {Object} options
 */
function insertOne (col, doc, options) {

  return new Promise(function (resolve, reject) {

    col.insertOne(doc, function mongoDone(err, result) {

      if (err) {
        reject(err);
      } else {
        const identifier = doc.identifier || result.insertedId.toString();

        if (!options || options.normalize !== false) {
          delete doc._id;
        }
        resolve(identifier);
      }
    });
  });
}


/**
 * Replace single document
 * @param {Object} col
 * @param {string} identifier
 * @param {Object} doc
 */
function replaceOne (col, identifier, doc) {

  return new Promise(function (resolve, reject) {

    const filter = utils.filterForOne(identifier);

    col.replaceOne(filter, doc, { upsert: true }, function mongoDone(err, result) {
      if (err) {
        reject(err);
      } else {
        resolve(result.matchedCount);
      }
    });
  });
}


/**
 * Update single document by identifier
 * @param {Object} col
 * @param {string} identifier
 * @param {object} setFields
 */
function updateOne (col, identifier, setFields) {

  return new Promise(function (resolve, reject) {

    const filter = utils.filterForOne(identifier);

    col.updateOne(filter, { $set: setFields }, function mongoDone(err, result) {
      if (err) {
        reject(err);
      } else {
        resolve({ updated: result.result.nModified });
      }
    });
  });
}


/**
 * Permanently remove single document by identifier
 * @param {Object} col
 * @param {string} identifier
 */
function deleteOne (col, identifier) {

  return new Promise(function (resolve, reject) {

    const filter = utils.filterForOne(identifier);

    col.deleteOne(filter, function mongoDone(err, result) {
      if (err) {
        reject(err);
      } else {
        resolve({ deleted: result.result.n });
      }
    });
  });
}


/**
 * Permanently remove many documents matching any of filtering criteria
 */
function deleteManyOr (col, filterDef) {

  return new Promise(function (resolve, reject) {

    const filter = utils.parseFilter(filterDef, 'or');

    col.deleteMany(filter, function mongoDone(err, result) {
      if (err) {
        reject(err);
      } else {
        resolve({ deleted: result.deletedCount });
      }
    });
  });
}


/**
 * Bulk upsert many documents using MongoDB's bulkWrite API
 * This is the "Upsert-First Strategy" optimization that replaces
 * the inefficient pattern of insertMany + individual replaceOne calls
 * @param {Object} col - MongoDB collection
 * @param {Array} docs - array of documents to upsert
 * @param {Object} options - bulkWrite options
 */
function bulkUpsert (col, docs, options) {
  return new Promise(function (resolve, reject) {

    if (!docs || docs.length === 0) {
      return resolve({ upsertedCount: 0, modifiedCount: 0, matchedCount: 0, totalCount: 0 });
    }

    // Convert each document to a replaceOne operation with upsert: true
    const bulkOps = docs.map(doc => {
      const filter = utils.filterForOne(doc.identifier);

      return {
        replaceOne: {
          filter: filter,
          replacement: doc,
          upsert: true
        }
      };
    });

    const bulkOptions = Object.assign({
      ordered: false  // Allow parallel processing for better performance
    }, options);

    col.bulkWrite(bulkOps, bulkOptions, function mongoDone(err, result) {
      if (err) {
        reject(err);
      } else {
        // Normalize document IDs if requested
        if (!options || options.normalize !== false) {
          docs.forEach(doc => {
            if (doc._id) {
              delete doc._id;
            }
          });
        }

        resolve({
          upsertedCount: result.upsertedCount,
          modifiedCount: result.modifiedCount,
          matchedCount: result.matchedCount,
          insertedCount: result.upsertedCount, // For compatibility with insertMany
          totalCount: docs.length
        });
      }
    });
  });
}

module.exports = {
  insertOne,
  replaceOne,
  updateOne,
  deleteOne,
  deleteManyOr,
  bulkUpsert
};
