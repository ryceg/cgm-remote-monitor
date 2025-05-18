import { describe, it, expect } from 'vitest';
const fs = require('fs');
const levels = require('../lib/levels');

describe('Uploader Battery', () => {
  const data = { devicestatus: [{ mills: Date.now(), uploader: { battery: 20 } }] };

  it('display uploader battery status', () => new Promise((done) => {
    var ctx = {
      settings: {},
      language: require('../lib/language')(fs),
    };
    ctx.language.set('en');
    ctx.levels = levels;
    var sandbox = require('../lib/sandbox')(ctx);
    
    var sbx = sandbox.clientInit(ctx, Date.now(), data);

    sbx.offerProperty = function mockedOfferProperty (name, setter) {
      expect(name).toBe('upbat');
      var result = setter();
      expect(result.display).toBe('20%');
      expect(result.status).toBe('urgent');
      expect(result.min.value).toBe(20);
      expect(result.min.level).toBe(25);
      done();
    };

    var upbat = require('../lib/plugins/upbat')(ctx);
    upbat.setProperties(sbx);
  }));

  it('set a pill to the uploader battery status', () => new Promise((done) => {
    var ctx = {
      settings: {},
      pluginBase: {
        updatePillText: function mockedUpdatePillText(plugin, options) {
          expect(options.value).toBe('20%');
          expect(options.labelClass).toBe('icon-battery-25');
          expect(options.pillClass).toBe('urgent');
          done();
        }
      },
      language: require('../lib/language')(fs),
      levels: levels
    };
    ctx.language.set('en');

    var sandbox = require('../lib/sandbox')();
    var sbx = sandbox.clientInit(ctx, Date.now(), data);
    var upbat = require('../lib/plugins/upbat')(ctx);
    upbat.setProperties(sbx);
    upbat.updateVisualisation(sbx);
  }));

  it('hide the pill if there is no uploader battery status', () => new Promise((done) => {
    var ctx = {
      settings: {},
      pluginBase: {
        updatePillText: function mockedUpdatePillText (plugin, options) {
          expect(options.hide).toBe(true);
          done();
        }
      },
      language: require('../lib/language')(fs),
      levels: levels
    };
    ctx.language.set('en');

    var sandbox = require('../lib/sandbox')();
    var sbx = sandbox.clientInit(ctx, Date.now(), {});
    var upbat = require('../lib/plugins/upbat')(ctx);
    upbat.setProperties(sbx);
    upbat.updateVisualisation(sbx);
  }));

  it('hide the pill if there is uploader battery status is -1', () => new Promise((done) => {
    var ctx = {
      settings: {},
      pluginBase: {
        updatePillText: function mockedUpdatePillText(plugin, options) {
          expect(options.hide).toBe(true);
          done();
        }
      }, 
      language: require('../lib/language')(fs),
      levels: levels
    };
    ctx.language.set('en');

    var sandbox = require('../lib/sandbox')();
    var sbx = sandbox.clientInit(ctx, Date.now(), { devicestatus: [{ uploader: { battery: -1 } }] });
    var upbat = require('../lib/plugins/upbat')(ctx);
    upbat.setProperties(sbx);
    upbat.updateVisualisation(sbx);
  }));

  it('should handle virtAsst requests', () => new Promise((done) => {
    var ctx = {
      settings: {},
      language: require('../lib/language')(fs),
      levels: levels
    };
    ctx.language.set('en');

    var sandbox = require('../lib/sandbox')();
    var sbx = sandbox.clientInit(ctx, Date.now(), data);
    var upbat = require('../lib/plugins/upbat')(ctx);
    upbat.setProperties(sbx);

    expect(upbat.virtAsst.intentHandlers.length).toBe(2);

    upbat.virtAsst.intentHandlers[0].intentHandler(function next(title, response) {
      expect(title).toBe('Uploader Battery');
      expect(response).toBe('Your uploader battery is at 20%');
      
      upbat.virtAsst.intentHandlers[1].intentHandler(function next(title, response) {
        expect(title).toBe('Uploader Battery');
        expect(response).toBe('Your uploader battery is at 20%');
        done();
      }, [], sbx);
    }, [], sbx);
  }));
});
