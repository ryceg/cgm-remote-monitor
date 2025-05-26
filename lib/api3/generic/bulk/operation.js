'use strict';

const _ = require('lodash')
  , apiConst = require('../../const.json')
  , security = require('../../security')
  , validate = require('../create/validate.js')
  , opTools = require('../../shared/operationTools')
  ;

/**
 * Bulk upsert multiple documents into the collection using the optimized upsert-first strategy
 * @param {Object} opCtx
 * @param {Array} docs - array of documents to upsert
 */
async function bulkUpsert (opCtx, docs) {
  const { ctx, auth, col, req, res } = opCtx;

  await security.demandPermission(opCtx, `api:${col.colName}:create`);

  if (!_.isArray(docs) || docs.length === 0) {
    return opTools.sendJSONStatus(res, apiConst.HTTP.BAD_REQUEST, 'Request body must be a non-empty array of documents');
  }

  const now = new Date();
  const processedDocs = [];

  // Process and validate each document
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];

    if (_.isEmpty(doc)) {
      continue; // Skip empty documents
    }

    // Parse dates and resolve identifiers
    col.parseDate(doc);
    opTools.resolveIdentifier(doc);

    // Validate the document
    if (validate(opCtx, doc) !== true) {
      return; // validate function will have already sent error response
    }

    // Set server timestamps
    doc.srvModified = now.getTime();
    doc.srvCreated = doc.srvCreated || doc.srvModified;

    // Set subject if authenticated
    if (auth && auth.subject && auth.subject.name) {
      doc.subject = auth.subject.name;
    }

    processedDocs.push(doc);
  }

  if (processedDocs.length === 0) {
    return opTools.sendJSONStatus(res, apiConst.HTTP.BAD_REQUEST, 'No valid documents to process');
  }

  // Perform bulk upsert using the optimized strategy
  const result = await col.storage.bulkUpsert(processedDocs);

  res.setHeader('Last-Modified', now.toUTCString());

  const fields = {
    upsertedCount: result.upsertedCount,
    modifiedCount: result.modifiedCount,
    totalCount: result.totalCount,
    lastModified: now.getTime()
  };

  opTools.sendJSON({ res, status: apiConst.HTTP.OK, fields });

  // Emit events for cache updates and data processing
  ctx.bus.emit('storage-socket-bulk-upsert', {
    colName: col.colName,
    docs: processedDocs,
    result: result
  });

  col.autoPrune();
  ctx.bus.emit('data-received');
}

/**
 * Bulk CREATE operation for handling multiple document inserts/upserts
 */
async function bulkCreate (opCtx) {
  const { col, req, res } = opCtx;
  const docs = req.body;
  if (Array.isArray(docs) === false || docs.length === 0) {
    return opTools.sendJSONStatus(res, apiConst.HTTP.BAD_REQUEST, 'Request body must be a non-empty array of documents');
  }

  await bulkUpsert(opCtx, docs);
}

function bulkCreateOperation (ctx, env, app, col) {
  return async function operation (req, res) {
    const opCtx = { app, ctx, env, col, req, res };

    try {
      opCtx.auth = await security.authenticate(opCtx);
      await bulkCreate(opCtx);
    } catch (err) {
      console.error(err);
      if (!res.headersSent) {
        return opTools.sendJSONStatus(res, apiConst.HTTP.INTERNAL_ERROR, apiConst.MSG.STORAGE_ERROR);
      }
    }
  };
}

module.exports = {
  bulkUpsert,
  bulkCreate,
  bulkCreateOperation
};
