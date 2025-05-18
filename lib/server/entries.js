'use strict';

const { Transform, pipeline, Writable } = require('stream');
var find_options = require('./query');
var ObjectID = require('mongodb').ObjectID;
var moment = require('moment');

/**********\
 * Entries
 * Encapsulate persistent storage of sgv entries.
\**********/

/**
 * @typedef {Object} StorageOptions
 * @property {Object} [sort] - Sort options for the query.
 * @property {number} [sort.date] - Sort by date, -1 for descending, 1 for ascending.
 * @property {string|number} [count] - The number of records to return.
 * @property {Object} [find] - The find query for MongoDB.
 */

/**
 * @callback ListCallback
 * @param {Error|null} err - An error object if an error occurred, otherwise null.
 * @param {Array<Object>} [entries] - An array of entry objects.
 */

/**
 * @callback RemoveCallback
 * @param {Error|null} err - An error object if an error occurred, otherwise null.
 * @param {Object} [stat] - Statistics about the remove operation.
 */

/**
 * @callback CreateCallback
 * @param {Error|null} err - An error object if an error occurred, otherwise null.
 * @param {Array<Object>} [docs] - The created documents.
 */

/**
 * @callback GetEntryCallback
 * @param {Error|null} err - An error object if an error occurred, otherwise null.
 * @param {Object} [entry] - The entry object.
 */

/**
 * @callback PersistCallback
 * @param {Error|null} err - An error object if an error occurred, otherwise null.
 * @param {Array<Object>} [result] - The result of the persistence operation.
 */

/**
 * @function storage
 * @description Encapsulates persistent storage of sgv entries.
 * @param {Object} env - The environment configuration object.
 * @param {string} env.entries_collection - The name of the MongoDB collection for entries.
 * @param {Object} ctx - The application context.
 * @param {Object} ctx.store - The MongoDB store object.
 * @param {Object} ctx.bus - The event bus.
 * @param {Object} ctx.ddata - Dynamic data object.
 * @returns {Object} An API object with methods for interacting with entries storage.
 */
function storage (env, ctx) {

  // TODO: Code is a little redundant.

  /**
   * @function list
   * @description Queries for entries from storage.
   * @param {StorageOptions} opts - Options for the query.
   * @param {ListCallback} fn - Callback function to handle the results.
   */
  function list (opts, fn) {
    // these functions, find, sort, and limit, are used to
    // dynamically configure the request, based on the options we've
    // been given

    /**
     * determine sort options
     * @returns {StorageOptions | Object} Sort options.
     */
    function sort () {
      return opts && opts.sort || { date: -1 };
    }

    /**
     * configure the limit portion of the current query
     * @this {Object} MongoDB cursor object.
     * @returns {Object} MongoDB cursor object with limit applied.
     */
    function limit () {
      if (opts && opts.count) {
        return this.limit(parseInt(opts.count));
      }
      return this;
    }

    // handle all the results
    /**
     * @param {Error|null} err
     * @param {Array<Object>} entries
     */
    function toArray (err, entries) {
      fn(err, entries);
    }

    // now just stitch them all together
    limit.call(api()
      .find(query_for(opts))
      .sort(sort())
    ).toArray(toArray);
  }

  /**
   * @function remove
   * @description Removes entries from storage.
   * @param {StorageOptions} opts - Options for the remove operation.
   * @param {RemoveCallback} fn - Callback function to handle the results.
   */
  function remove (opts, fn) {
    api().remove(query_for(opts), function(err, stat) {

      ctx.bus.emit('data-update', {
        type: 'entries'
        , op: 'remove'
        , count: stat.result.n
        , changes: opts.find._id
      });

      //TODO: this is triggering a read from Mongo, we can do better
      ctx.bus.emit('data-received');
      fn(err, stat);
    });
  }

  /**
   * @function map
   * @description Returns a writable stream to lint each sgv record passing through it.
   * @returns {Transform} A Transform stream.
   */
  function map () {
    return new Transform({
      objectMode: true,
      transform(chunk, encoding, callback) {
        callback(null, chunk);
      }
    });
  }

  /**
   * @function persist
   * @description Writable stream that persists all records.
   * @param {PersistCallback} fn - Function to call when done.
   * @returns {Transform} The input Transform stream that the request should pipe into.
   */
  function persist (fn) { // fn is the callback from the caller, e.g. insert_entries's done.
    const collectedData = [];
    const inputTransformStream = map(); // map() returns a new Transform stream

    const dataCollectorStream = new Writable({
      objectMode: true,
      write(chunk, encoding, callback) {
        collectedData.push(chunk);
        callback();
      },
      final(writableFinalCb) {
        // This wrapper ensures that the original callback 'fn' (done) is called,
        // and only then is the writable stream's own finalization callback invoked.
        const newCbForCreate = (err, result) => {
          fn(err, result); // Call the original 'done' (or 'fn') callback
          writableFinalCb(err); // Signal the Writable stream's finalization, passing any error
        };
        create(collectedData, newCbForCreate);
      }
    });

    pipeline(inputTransformStream, dataCollectorStream, (err) => {
      if (err) {
        // If pipeline errors, call 'fn' immediately.
        fn(err);
      }
      // If pipeline is successful, 'fn' is called by dataCollectorStream.final -> create -> fn
    });

    return inputTransformStream; // Return the stream that the request should pipe into
  }

  //TODO: implement
  //function update (fn) {
  //}
  //

  /**
   * @function create
   * @description Stores new documents using the storage mechanism.
   * @param {Array<Object>} docs - An array of documents to create.
   * @param {CreateCallback} fn - Callback function to handle the results.
   */
  function create (docs, fn) {
    // potentially a batch insert
    var firstErr = null
      , numDocs = docs.length
      , totalCreated = 0;

    docs.forEach(function(doc) {

      // Normalize dates to be in UTC, store offset in utcOffset

      var _sysTime;

      if (doc.dateString) { _sysTime = moment.parseZone(doc.dateString); }
      if (!_sysTime && doc.date) { _sysTime = moment(doc.date); }
      if (!_sysTime) _sysTime = moment();

      doc.utcOffset = _sysTime.utcOffset();
      doc.sysTime = _sysTime.toISOString();
      if (doc.dateString) doc.dateString = doc.sysTime;

      var query = (doc.sysTime && doc.type) ? { sysTime: doc.sysTime, type: doc.type } : doc;
      api().update(query, doc, { upsert: true }, function(err, updateResults) {
        firstErr = firstErr || err;

        if (!err) {
          if (updateResults.result.upserted) {
            doc._id = updateResults.result.upserted[0]._id
          }

          ctx.bus.emit('data-update', {
            type: 'entries'
            , op: 'update'
            , changes: ctx.ddata.processRawDataForRuntime([doc])
          });
        }

        if (++totalCreated === numDocs) {
          //TODO: this is triggering a read from Mongo, we can do better
          ctx.bus.emit('data-received');
          fn(firstErr, docs);
        }
      });
    });
  }

  /**
   * @function getEntry
   * @description Retrieves a single entry by its ID.
   * @param {string} id - The ID of the entry to retrieve.
   * @param {GetEntryCallback} fn - Callback function to handle the results.
   */
  function getEntry (id, fn) {
    api().findOne({ _id: ObjectID(id) }, function(err, entry) {
      if (err) {
        fn(err);
      } else {
        fn(null, entry);
      }
    });
  }

  /**
   * @function query_for
   * @description Generates a MongoDB query object based on the provided options.
   * @param {StorageOptions} opts - Options for generating the query.
   * @returns {Object} A MongoDB query object.
   */
  function query_for (opts) {
    return find_options(opts, storage.queryOpts);
  }

  /**
   * @function api
   * @description Closure to represent the API for interacting with the entries collection.
   * @returns {Object} MongoDB collection object.
   */
  function api () {
    // obtain handle usable for querying the collection associated
    // with these records
    return ctx.store.collection(env.entries_collection);
  }

  // Expose all the useful functions
  api.list = list;
  api.map = map;
  api.create = create;
  api.remove = remove;
  api.persist = persist;
  api.query_for = query_for;
  api.getEntry = getEntry;
  api.aggregate = require('./aggregate')({}, api);
  api.indexedFields = [
    'date'
    , 'type'
    , 'sgv'
    , 'mbg'
    , 'sysTime'
    , 'dateString'
    , { 'type': 1, 'date': -1, 'dateString': 1 }
 ];
  return api;
}

storage.queryOpts = {
  walker: {
    date: parseInt
    , sgv: parseInt
    , filtered: parseInt
    , unfiltered: parseInt
    , rssi: parseInt
    , noise: parseInt
    , mbg: parseInt
  }
  , useEpoch: true
};

// expose module
storage.storage = storage;
module.exports = storage;
