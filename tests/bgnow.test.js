import { describe, it, expect } from 'vitest';
'use strict';

var _ = require('lodash');
const helper = require('./inithelper')();

var FIVE_MINS = 300000;
var SIX_MINS = 360000;

describe('BG Now', () => {

  const ctx = helper.ctx;

  var bgnow = require('../lib/plugins/bgnow')(ctx);
  var sandbox = require('../lib/sandbox')(ctx);

  var now = Date.now();
  var before = now - FIVE_MINS;

  it('should calculate BG Delta', () => {
    var ctx = {
      settings: { units: 'mg/dl' }
      , pluginBase: {
        updatePillText: function mockedUpdatePillText (plugin, options) {
          expect(options.label).to.equal(ctx.settings.units);
          expect(options.value).to.equal('+5');
          expect(options.info).to.not.exist;
        }
      , language: { translate: function(text) { return text; } }
      }
    };

    ctx.language = ctx.pluginBase.language;
    ctx.levels = require('../lib/levels');

    var data = {sgvs: [{mills: before, mgdl: 100}, {mills: now, mgdl: 105}]};

    var sbx = sandbox.clientInit(ctx, Date.now(), data);

    bgnow.setProperties(sbx);

    var delta = sbx.properties.delta;
    expect(delta.mgdl).to.equal(5);
    expect(delta.interpolated).to.equal(false);
    expect(delta.scaled).to.equal(5);
    expect(delta.display).to.equal('+5');

    bgnow.updateVisualisation(sbx);
  });

  it('should calculate BG Delta by interpolating when more than 5mins apart', () => {
    var data = {sgvs: [{mills: before - SIX_MINS, mgdl: 100}, {mills: now, mgdl: 105}]};

    var ctx = {
      settings: {
        units: 'mg/dl'
      }
      , pluginBase: {
        updatePillText: function mockedUpdatePillText(plugin, options) {
          expect(options.label).to.equal(ctx.settings.units);
          expect(options.value).to.equal('+2 *');
          expect(findInfoValue('Elapsed Time', options.info)).to.equal('11 mins');
          expect(findInfoValue('Absolute Delta', options.info)).to.equal('5 mg/dl');
          expect(findInfoValue('Interpolated', options.info)).to.equal('103 mg/dl');
        }
      }
      , language: require('../lib/language')()
      , moment: helper.ctx.moment
    };

    var sbx = sandbox.clientInit(ctx, now, data);

    bgnow.setProperties(sbx);

    var delta = sbx.properties.delta;
    expect(delta.mgdl).to.equal(2);
    expect(delta.interpolated).to.equal(true);
    expect(delta.scaled).to.equal(2);
    expect(delta.display).to.equal('+2');
    bgnow.updateVisualisation(sbx);

  });

  it('should calculate BG Delta in mmol', () => {
    var ctx = {
      settings: {
        units: 'mmol'
      }
      , pluginBase: {}
      , language: require('../lib/language')()
      , moment: helper.ctx.moment
    };

    var data = {sgvs: [{mills: before, mgdl: 100}, {mills: now, mgdl: 105}]};
    var sbx = sandbox.clientInit(ctx, Date.now(), data);

    var gotbgnow = false;
    var gotdelta = false;
    var gotbuckets = false;

    sbx.offerProperty = function mockedOfferProperty (name, setter) {
      if (name === 'bgnow') {
        var bgnowProp = setter();
        expect(bgnowProp.mean).to.equal(105);
        expect(bgnowProp.last).to.equal(105);
        expect(bgnowProp.mills).to.equal(now);
        gotbgnow = true;
      } else if (name === 'delta') {
        var result = setter();
        expect(result.mgdl).to.equal(5);
        expect(result.interpolated).to.equal(false);
        expect(result.scaled).to.equal(0.2);
        expect(result.display).to.equal('+0.2');
        gotdelta = true;
      } else if (name === 'buckets') {
        var buckets = setter();
        expect(buckets[0].mean).to.equal(105);
        expect(buckets[1].mean).to.equal(100);
        gotbuckets = true;
      }

      if (gotbgnow && gotdelta && gotbuckets) {
        // done(); // Removed done callback
      }
    };

    bgnow.setProperties(sbx);
  });

  it('should calculate BG Delta in mmol and not show a change because of rounding', () => {
    var ctx = {
      settings: {
        units: 'mmol'
      }
      , pluginBase: {}
      , language: require('../lib/language')()
      , moment: helper.ctx.moment
    };

    var data = {sgvs: [{mills: before, mgdl: 85}, {mills: now, mgdl: 85}]};
    var sbx = sandbox.clientInit(ctx, Date.now(), data);

    var gotbgnow = false;
    var gotdelta = false;
    var gotbuckets = false;

    sbx.offerProperty = function mockedOfferProperty (name, setter) {
      if (name === 'bgnow') {
        var bgnowProp = setter();
        expect(bgnowProp.mean).to.equal(85);
        expect(bgnowProp.last).to.equal(85);
        expect(bgnowProp.mills).to.equal(now);
        gotbgnow = true;
      } else if (name === 'delta') {
        var result = setter();
        expect(result.mgdl).to.equal(0);
        expect(result.interpolated).to.equal(false);
        expect(result.scaled).to.equal(0);
        expect(result.display).to.equal('+0');
        gotdelta = true;
      } else if (name === 'buckets') {
        var buckets = setter();
        expect(buckets[0].mean).to.equal(85);
        expect(buckets[1].mean).to.equal(85);
        gotbuckets = true;
      }

      if (gotbgnow && gotdelta && gotbuckets) {
        // done(); // Removed done callback
      }

    };

    bgnow.setProperties(sbx);
  });

  it('should calculate BG Delta in mmol by interpolating when more than 5mins apart', () => {
    var ctx = {
      settings: {
        units: 'mmol'
      }
      , pluginBase: {}
      , language: require('../lib/language')()
      , moment: helper.ctx.moment
    };

    var data = {sgvs: [{mills: before - SIX_MINS, mgdl: 100}, {mills: now, mgdl: 105}]};
    var sbx = sandbox.clientInit(ctx, Date.now(), data);

    var gotbgnow = false;
    var gotdelta = false;
    var gotbuckets = false;

    sbx.offerProperty = function mockedOfferProperty (name, setter) {
      if (name === 'bgnow') {
        var bgnowProp = setter();
        expect(bgnowProp.mean).to.equal(105);
        expect(bgnowProp.last).to.equal(105);
        expect(bgnowProp.mills).to.equal(now);
        gotbgnow = true;
      } else if (name === 'delta') {
        var result = setter();
        expect(result.mgdl).to.equal(2);
        expect(result.interpolated).to.equal(true);
        expect(result.scaled).to.equal(0.1);
        expect(result.display).to.equal('+0.1');
        gotdelta = true;
      } else if (name === 'buckets') {
        var buckets = setter();
        expect(buckets[0].mean).to.equal(105);
        expect(buckets[1].isEmpty).to.equal(true);
        expect(buckets[2].mean).to.equal(100);
        gotbuckets = true;
      }

      if (gotbgnow && gotdelta && gotbuckets) {
        // done(); // Removed done callback
      }
    };

    bgnow.setProperties(sbx);
  });

});

function findInfoValue (label, info) {
  var found = _.find(info, function checkLine (line) {
    return line.label === label;
  });
  return found && found.value;
}
