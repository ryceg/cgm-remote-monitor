import { describe, it, expect } from 'vitest';

'use strict';

require('should');
const helper = require('./inithelper')();
const levels = helper.ctx.levels;

describe('cage', () => {
  var env = require('../lib/server/env')();
  var ctx = helper.getctx();

  ctx.ddata = require('../lib/data/ddata')();
  ctx.notifications = require('../lib/notifications')(env, ctx);

  var cage = require('../lib/plugins/cannulaage')(ctx);
  var sandbox = require('../lib/sandbox')(ctx);
  function prepareSandbox ( ) {
    var sbx = require('../lib/sandbox')().serverInit(env, ctx);
    sbx.offerProperty('iob', function () {
      return {iob: 0};
    });
    return sbx;
  }

  it('set a pill to the current cannula age', () => {
    return new Promise((done) => { // Return a Promise
      var data = {
        sitechangeTreatments: [
          {eventType: 'Site Change', notes: 'Foo', mills: Date.now() - 48 * 60 * 60000}
          , {eventType: 'Site Change', notes: 'Bar', mills: Date.now() - 24 * 60 * 60000}
          ]
      };

      var ctx = {
        settings: {}
        , pluginBase: {
          updatePillText: function mockedUpdatePillText(plugin, options) {
            expect(options.value).to.equal('24h');
            expect(options.info[1].value).to.equal('Bar');
            done();
          }
        }
      };

      ctx.language = require('../lib/language')();
      var sbx = sandbox.clientInit(ctx, Date.now(), data);
      cage.setProperties(sbx);
      cage.updateVisualisation(sbx);
    });
  });

  it('set a pill to the current cannula age', () => { // Second test with the same name, Vitest might complain, but following original structure
    return new Promise((done) => { // Return a Promise
      var data = {
        sitechangeTreatments: [
          {eventType: 'Site Change', notes: 'Foo', mills: Date.now() - 48 * 60 * 60000}
          , {eventType: 'Site Change', notes: '', mills: Date.now() - 59 * 60000}
          ]
      };

      var ctx = {
        settings: {}
        , pluginBase: {
          updatePillText: function mockedUpdatePillText(plugin, options) {
            expect(options.value).to.equal('0h');
            expect(options.info.length).to.equal(1);
            done();
          }
        }
      };
      ctx.language = require('../lib/language')();
      var sbx = sandbox.clientInit(ctx, Date.now(), data);
      cage.setProperties(sbx);
      cage.updateVisualisation(sbx);
    });
  });


 it('trigger a warning when cannula is 48 hours old', () => {
    ctx.notifications.initRequests();

    var before = Date.now() - (48 * 60 * 60 * 1000);

    ctx.ddata.sitechangeTreatments = [{eventType: 'Site Change', mills: before}];

    var sbx = prepareSandbox();
    sbx.extendedSettings = { 'enableAlerts': 'TRUE' };
    cage.setProperties(sbx);
    cage.checkNotifications(sbx);

    var highest = ctx.notifications.findHighestAlarm('CAGE');
    expect(highest.level).to.equal(levels.WARN);
    expect(highest.title).to.equal('Cannula age 48 hours');
  });

});
