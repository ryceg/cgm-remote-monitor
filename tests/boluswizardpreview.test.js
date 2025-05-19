import { describe, it, expect } from 'vitest';
var Stream = require('stream');
const helper = require('./inithelper')();

describe('boluswizardpreview', () => {
  var env = require('../lib/server/env')();
  env.testMode = true;

  var ctx = helper.getctx();

  ctx.ddata = require('../lib/data/ddata')();
  ctx.notifications = require('../lib/notifications')(env, ctx);

  var boluswizardpreview = require('../lib/plugins/boluswizardpreview')(ctx);
  var ar2 = require('../lib/plugins/ar2')(ctx);
  var iob = require('../lib/plugins/iob')(ctx);
  var bgnow = require('../lib/plugins/bgnow')(ctx);

  function prepareSandbox ( ) {
    var sbx = require('../lib/sandbox')().serverInit(env, ctx);
    bgnow.setProperties(sbx);
    ar2.setProperties(sbx);
    iob.setProperties(sbx);
    boluswizardpreview.setProperties(sbx);
    sbx.offerProperty('direction', function setFakeDirection() {
      return {value: 'FortyFiveUp', label: '↗', entity: '&#8599;'};
    });

    return sbx;
  }

  var now = Date.now();
  var before = now - (5 * 60 * 1000);

  var profile = {
    dia: 3
    , sens: 90
    , target_high: 120
    , target_low: 100
  };

  it('should calculate IOB results correctly with 0 IOB', () => {
    ctx.notifications.initRequests();
    ctx.ddata.sgvs = [{mills: before, mgdl: 100}, {mills: now, mgdl: 100}];
    ctx.ddata.treatments = [];
    ctx.ddata.profiles = [profile];

    var sbx = prepareSandbox();
    var results = boluswizardpreview.calc(sbx);

    expect(results.effect).to.equal(0);
    expect(results.effectDisplay).to.equal(0);
    expect(results.outcome).to.equal(100);
    expect(results.outcomeDisplay).to.equal(100);
    expect(results.bolusEstimate).to.equal(0);
    expect(results.displayLine).to.equal('BWP: 0U');

  });

  it('should calculate IOB results correctly with 1.0 U IOB', () => {
    ctx.notifications.initRequests();
    ctx.ddata.sgvs = [{mills: before, mgdl: 100}, {mills: now, mgdl: 100}];
    ctx.ddata.treatments = [{mills: now, insulin: '1.0'}];

    var profile = {
      dia: 3
      , sens: 50
      , target_high: 100
      , target_low: 50
    };

    ctx.ddata.profiles = [profile];

    var sbx = prepareSandbox();
    var results = boluswizardpreview.calc(sbx);

    expect(Math.round(results.effect)).to.equal(50);
    expect(results.effectDisplay).to.equal(50);
    expect(Math.round(results.outcome)).to.equal(50);
    expect(results.outcomeDisplay).to.equal(50);
    expect(results.bolusEstimate).to.equal(0);
    expect(results.displayLine).to.equal('BWP: 0U');

  });

  it('should calculate IOB results correctly with 1.0 U IOB resulting in going low', () => {
    ctx.notifications.initRequests();
    ctx.ddata.sgvs = [{mills: before, mgdl: 100}, {mills: now, mgdl: 100}];
    ctx.ddata.treatments = [{mills: now, insulin: '1.0'}];

    var profile = {
      dia: 3
      , sens: 50
      , target_high: 200
      , target_low: 100
      , basal: 1
    };


    ctx.ddata.profiles = [profile];

    var sbx = prepareSandbox();
    var results = boluswizardpreview.calc(sbx);

    expect(Math.round(results.effect)).to.equal(50);
    expect(results.effectDisplay).to.equal(50);
    expect(Math.round(results.outcome)).to.equal(50);
    expect(results.outcomeDisplay).to.equal(50);
    expect(Math.round(results.bolusEstimate)).to.equal(-1);
    expect(results.displayLine).to.equal('BWP: -1.00U');
    expect(results.tempBasalAdjustment.thirtymin).to.equal(-100);
    expect(results.tempBasalAdjustment.onehour).to.equal(0);

  });

 it('should calculate IOB results correctly with 1.0 U IOB resulting in going low in MMOL', () => {

    // boilerplate for client sandbox running in mmol

    var profileData = {
      dia: 3
      , units: 'mmol'
      , sens: 10
      , target_high: 10
      , target_low: 5.6
      , basal: 1
    };

    var sandbox = require('../lib/sandbox')();
    var ctx = {
      settings: {
        units: 'mmol'
      }
      , pluginBase: {}
      , moment: helper.ctx.moment
    };

    ctx.language = require('../lib/language')();

    var data = {sgvs: [{mills: before, mgdl: 100}, {mills: now, mgdl: 100}]};
    data.treatments = [{mills: now, insulin: '1.0'}];
    data.devicestatus = [];
    data.profile = require('../lib/profilefunctions')([profileData], ctx);
    var sbx = sandbox.clientInit(ctx, Date.now(), data);
    sbx.properties.iob = iob.calcTotal(data.treatments, data.devicestatus, data.profile, now);

    var results = boluswizardpreview.calc(sbx);

    expect(results.effect).to.equal(10);
    expect(results.outcome).to.equal(-4.4);
    expect(results.bolusEstimate).to.equal(-1);
    expect(results.displayLine).to.equal('BWP: -1.00U');
    expect(results.tempBasalAdjustment.thirtymin).to.equal(-100);
    expect(results.tempBasalAdjustment.onehour).to.equal(0);

  });


 it('should calculate IOB results correctly with 0.45 U IOB resulting in going low in MMOL', () => {

    // boilerplate for client sandbox running in mmol

    var profileData = {
      dia: 3
      , units: 'mmol'
      , sens: 9
      , target_high: 6
      , target_low: 5
      , basal: 0.125
    };

    var sandbox = require('../lib/sandbox')();
    var ctx = {
      settings: {
        units: 'mmol'
      }
      , pluginBase: {}
      , moment: helper.ctx.moment
    };

    ctx.language = require('../lib/language')();

    var data = {sgvs: [{mills: before, mgdl: 175}, {mills: now, mgdl: 153}]};
    data.treatments = [{mills: now, insulin: '0.45'}];
    data.devicestatus = [];
    data.profile = require('../lib/profilefunctions')([profileData], ctx);
    var sbx = sandbox.clientInit(ctx, Date.now(), data);
    sbx.properties.iob = iob.calcTotal(data.treatments, data.devicestatus, data.profile, now);

    var results = boluswizardpreview.calc(sbx);

    expect(results.effect).to.equal(4.05);
    expect(results.outcome).to.equal(4.45);
    expect(Math.round(results.bolusEstimate*100)).to.equal(-6);
    expect(results.displayLine).to.equal('BWP: -0.07U');
    expect(results.tempBasalAdjustment.thirtymin).to.equal(2);
    expect(results.tempBasalAdjustment.onehour).to.equal(51);

  });


  it('Not trigger an alarm when in range', () => {
    ctx.notifications.initRequests();
    ctx.ddata.sgvs = [{mills: before, mgdl: 95}, {mills: now, mgdl: 100}];
    ctx.ddata.treatments = [];
    ctx.ddata.profiles = [profile];

    var sbx = prepareSandbox();
    boluswizardpreview.checkNotifications(sbx);

    expect(ctx.notifications.findHighestAlarm()).to.not.exist;

  });

  it('trigger a warning when going out of range', () => {
    ctx.notifications.initRequests();
    ctx.ddata.sgvs = [{mills: before, mgdl: 175}, {mills: now, mgdl: 180}];
    ctx.ddata.treatments = [];
    ctx.ddata.profiles = [profile];

    var sbx = prepareSandbox();
    boluswizardpreview.checkNotifications(sbx);

    var highest = ctx.notifications.findHighestAlarm();
    expect(highest.level).to.equal(ctx.levels.WARN);
    expect(highest.title).to.equal('Warning, Check BG, time to bolus?');
    expect(highest.message).to.equal('BG Now: 180 +5 ↗ mg/dl\nBG 15m: 187 mg/dl\nBWP: 0.66U');
  });

  it('trigger an urgent alarms when going too high', () => {
    ctx.notifications.initRequests();
    ctx.ddata.sgvs = [{mills: before, mgdl: 295}, {mills: now, mgdl: 300}];
    ctx.ddata.treatments = [];
    ctx.ddata.profiles = [profile];

    var sbx = prepareSandbox();
    boluswizardpreview.checkNotifications(sbx);
    expect(ctx.notifications.findHighestAlarm().level).to.equal(ctx.levels.URGENT);

  });

  it('request a snooze when there is enough IOB', () => {
    return new Promise((done) => { // Return a Promise
      ctx.notifications.resetStateForTests();
      ctx.notifications.initRequests();
      ctx.ddata.sgvs = [{mills: before, mgdl: 295}, {mills: now, mgdl: 300}];
      ctx.ddata.treatments = [{mills: before, insulin: '5.0'}];
      ctx.ddata.profiles = [profile];

      var sbx = prepareSandbox();

      //start fresh to we don't pick up other notifications
      ctx.bus = new Stream;
      //if notification doesn't get called test will time out
      ctx.bus.on('notification', function callback (notify) {
        expect(notify.clear).to.equal(true);
        if (notify.clear) {
          done();
        }
      });

      ar2.checkNotifications(sbx);
      boluswizardpreview.checkNotifications(sbx);
      ctx.notifications.process();
    });
  });

  it('set a pill to the BWP with infos', () => {
    var ctx = {
      settings: {}
      , pluginBase: {
        updatePillText: function mockedUpdatePillText(plugin, options) {
          expect(options.label).to.equal('BWP');
          expect(options.value).to.equal('0.50U');
        }
      }
      , moment: helper.ctx.moment
    };

    ctx.language = require('../lib/language')();
    var loadedProfile = require('../lib/profilefunctions')(null, ctx);
    loadedProfile.loadData([profile]);

    var data = {
      sgvs: [{mills: before, mgdl: 295}, {mills: now, mgdl: 300}]
      , treatments: [{mills: before, insulin: '1.5'}]
      , devicestatus: []
      , profile: loadedProfile
    };

    var sbx = require('../lib/sandbox')().clientInit(ctx, Date.now(), data);

    iob.setProperties(sbx);
    boluswizardpreview.setProperties(sbx);
    boluswizardpreview.updateVisualisation(sbx);
  });

});
