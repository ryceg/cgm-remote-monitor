'use strict';

import { describe, it, expect } from 'vitest'; // Added import
const fs = require('fs');
const language = require('../lib/language')(fs);
const levels = require('../lib/levels');
// require('should'); // Removed should

var topctx = {
  levels: levels
}

describe('Database Size', function() {

  var dataInRange = { dbstats: { dataSize: 1024 * 1024 * 137, indexSize: 1024 * 1024 * 48, fileSize: 1024 * 1024 * 256 } };
  var dataWarn = { dbstats: { dataSize: 1024 * 1024 * 250, indexSize: 1024 * 1024 * 100, fileSize: 1024 * 1024 * 360 } };
  var dataUrgent = { dbstats: { dataSize: 1024 * 1024 * 300, indexSize: 1024 * 1024 * 150, fileSize: 1024 * 1024 * 496 } };

  var env = require('../lib/server/env')();

  it('display database size in range', function(done) {
    var sandbox = require('../lib/sandbox')();
    var ctx = {
      settings: {}
      , language: language
      , levels: levels
    };

    var sbx = sandbox.clientInit(ctx, Date.now(), dataInRange);

    sbx.offerProperty = function mockedOfferProperty (name, setter) {
      expect(name).toBe('dbsize');
      var result = setter();
      expect(result.display).toBe('37%');
      expect(result.status).toBe('current');
      done();
    };

    var dbsize = require('../lib/plugins/dbsize')(ctx);
    dbsize.setProperties(sbx);

  });

  // ~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.

  it('display database size warning', function(done) {
    var sandbox = require('../lib/sandbox')();
    var ctx = {
      settings: {}
      , language: language
      , levels: levels
    };

    var sbx = sandbox.clientInit(ctx, Date.now(), dataWarn);

    sbx.offerProperty = function mockedOfferProperty (name, setter) {
      expect(name).toBe('dbsize');
      var result = setter();
      expect(result.display).toBe('70%');
      expect(result.status).toBe('warn');
      done();
    };

    var dbsize = require('../lib/plugins/dbsize')(ctx);

    dbsize.setProperties(sbx);

  });

  // ~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.

  it('display database size urgent', function(done) {
    var sandbox = require('../lib/sandbox')();
    var ctx = {
      settings: {}
      , language: language
      , levels: levels
    };

    var sbx = sandbox.clientInit(ctx, Date.now(), dataUrgent);

    sbx.offerProperty = function mockedOfferProperty (name, setter) {
      expect(name).toBe('dbsize');
      var result = setter();
      expect(result.display).toBe('90%');
      expect(result.status).toBe('urgent');
      done();
    };

    var dbsize = require('../lib/plugins/dbsize')(ctx);
    dbsize.setProperties(sbx);

  });

  // ~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.

  it('display database size warning notiffication', function(done) {
    var sandbox = require('../lib/sandbox')();
    var ctx = {
      settings: {}
      , language: language
      , notifications: require('../lib/notifications')(env, topctx)
      , levels: levels
    };
    ctx.notifications.initRequests();

    var sbx = sandbox.clientInit(ctx, Date.now(), dataWarn);
    sbx.extendedSettings = { 'enableAlerts': 'TRUE' };

    var dbsize = require('../lib/plugins/dbsize')(ctx);

    dbsize.setProperties(sbx);
    dbsize.checkNotifications(sbx);

    var notif = ctx.notifications.findHighestAlarm('Database Size');
    expect(notif.level).toBe(ctx.levels.WARN);
    expect(notif.title).toBe('Warning Database Size near its limits!');
    expect(notif.message).toBe('Database size is 350 MiB out of 496 MiB. Please backup and clean up database!');
    done();
  });

  // ~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.

  it('display database size urgent notiffication', function(done) {
    var sandbox = require('../lib/sandbox')();
    var ctx = {
      settings: {}
      , language: language
      , notifications: require('../lib/notifications')(env, topctx)
      , levels: levels
    };
    ctx.notifications.initRequests();

    var sbx = sandbox.clientInit(ctx, Date.now(), dataUrgent);
    sbx.extendedSettings = { 'enableAlerts': 'TRUE' };

    var dbsize = require('../lib/plugins/dbsize')(ctx);

    dbsize.setProperties(sbx);
    dbsize.checkNotifications(sbx);

    var notif = ctx.notifications.findHighestAlarm('Database Size');
    expect(notif.level).toBe(ctx.levels.URGENT);
    expect(notif.title).toBe('Urgent Database Size near its limits!');
    expect(notif.message).toBe('Database size is 450 MiB out of 496 MiB. Please backup and clean up database!');
    done();
  });

  // ~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.

  it('set a pill to the database size in percent', function(done) {
    var ctx = {
      settings: {}
      , pluginBase: {
        updatePillText: function mockedUpdatePillText (plugin, options) {
          expect(options.value).toBe('90%');
          expect(options.labelClass).toBe('plugicon-database');
          expect(options.pillClass).toBe('urgent');
          done();
        }
      }
      , language: language
      , levels: levels
    };

    var sandbox = require('../lib/sandbox')();
    var sbx = sandbox.clientInit(ctx, Date.now(), dataUrgent);
    var dbsize = require('../lib/plugins/dbsize')(ctx);
    dbsize.setProperties(sbx);
    dbsize.updateVisualisation(sbx);

  });

  // ~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.

  it('set a pill to the database size in MiB', function(done) {
    var ctx = {
      settings: {
        extendedSettings: {
          empty: false
          , dbsize: {
            inMib: true
          }
        }
      }
      , pluginBase: {
        updatePillText: function mockedUpdatePillText (plugin, options) {
          expect(options.value).toBe('450MiB');
          expect(options.labelClass).toBe('plugicon-database');
          expect(options.pillClass).toBe('urgent');
          done();
        }
      }
      , language: language
      , levels: levels
    };

    var sandbox = require('../lib/sandbox')();
    var sbx = sandbox.clientInit(ctx, Date.now(), dataUrgent);
    var dbsize = require('../lib/plugins/dbsize')(ctx);
    dbsize.setProperties(sbx.withExtendedSettings(dbsize));
    dbsize.updateVisualisation(sbx);

  });

  // ~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.

  it('configure warn level percentage', function(done) {

    var ctx = {
      settings: {
        extendedSettings: {
          empty: false
          , dbsize: {
            warnPercentage: 30
          }
        }
      }
      , pluginBase: {
        updatePillText: function mockedUpdatePillText (plugin, options) {
          expect(options.value).toBe('37%');
          expect(options.pillClass).toBe('warn');
          done();
        }
      }
      , language: language
      , levels: levels
    };

    var sandbox = require('../lib/sandbox')();
    var sbx = sandbox.clientInit(ctx, Date.now(), dataInRange);
    var dbsize = require('../lib/plugins/dbsize')(ctx);
    dbsize.setProperties(sbx.withExtendedSettings(dbsize));
    dbsize.updateVisualisation(sbx);
  });

  // ~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.

  it('configure urgent level percentage', function(done) {

    var ctx = {
      settings: {
        extendedSettings: {
          empty: false
          , dbsize: {
            warnPercentage: 30
            , urgentPercentage: 36
          }
        }
      }
      , pluginBase: {
        updatePillText: function mockedUpdatePillText (plugin, options) {
          expect(options.value).toBe('37%');
          expect(options.pillClass).toBe('urgent');
          done();
        }
      }
      , language: language
      , levels: levels
    };

    var sandbox = require('../lib/sandbox')();
    var sbx = sandbox.clientInit(ctx, Date.now(), dataInRange);
    var dbsize = require('../lib/plugins/dbsize')(ctx);
    dbsize.setProperties(sbx.withExtendedSettings(dbsize));
    dbsize.updateVisualisation(sbx);
  });

  // ~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.

  it('hide the pill if there is no info regarding database size', function(done) {
    var ctx = {
      settings: {}
      , pluginBase: {
        updatePillText: function mockedUpdatePillText (plugin, options) {
          expect(options.hide).toBe(true);
          done();
        }
      }
      , language: language
      , levels: levels
    };

    var sandbox = require('../lib/sandbox')();
    var sbx = sandbox.clientInit(ctx, Date.now(), {});
    var dbsize = require('../lib/plugins/dbsize')(ctx);
    dbsize.setProperties(sbx);
    dbsize.updateVisualisation(sbx);
  });

  // ~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.~.

  it('should handle virtAsst requests', function(done) {

    var ctx = {
      settings: {}
      , language: language
      , levels: levels
    };

    var sandbox = require('../lib/sandbox')();
    var sbx = sandbox.clientInit(ctx, Date.now(), dataUrgent);
    var dbsize = require('../lib/plugins/dbsize')(ctx);
    dbsize.setProperties(sbx);

    expect(dbsize.virtAsst.intentHandlers.length).toBe(1);

    dbsize.virtAsst.intentHandlers[0].intentHandler(function next (title, response) {
      expect(title).toBe('Database file size');
      expect(response).toBe('450 MiB. That is 90% of available database space.');

      done();

    }, [], sbx);

  });

});
