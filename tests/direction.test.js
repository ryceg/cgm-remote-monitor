'use strict';

import { describe, it, expect } from 'vitest';
import language from '../lib/language';
import sandbox from '../lib/sandbox';
import directionPlugin from '../lib/plugins/direction';

describe('BG direction', function ( ) {

  var now = Date.now();

  function setupSandbox(data, pluginBase) {
    var ctx = {
      settings: {}
      , pluginBase: pluginBase || {}
    };

    ctx.language = language();

    var sbx = sandbox();
    return sbx.clientInit(ctx, Date.now(), data);
  }

  it('set the direction property - Flat', function () {
    var sbx = setupSandbox({sgvs: [{mills: now, direction: 'Flat'}]});

    sbx.offerProperty = function mockedOfferProperty (name, setter) {
      expect(name).toBe('direction');
      var result = setter();
      expect(result.value).toBe('Flat');
      expect(result.label).toBe('→');
      expect(result.entity).toBe('&#8594;');
    };

    var direction = directionPlugin();
    direction.setProperties(sbx);

  });

  it('set the direction property Double Up', function () {
    var sbx = setupSandbox({sgvs: [{mills: now, direction: 'DoubleUp'}]});

    sbx.offerProperty = function mockedOfferProperty (name, setter) {
      expect(name).toBe('direction');
      var result = setter();
      expect(result.value).toBe('DoubleUp');
      expect(result.label).toBe('⇈');
      expect(result.entity).toBe('&#8648;');
    };

    var direction = directionPlugin();
    direction.setProperties(sbx);

  });

  it('set a pill to the direction', function () {
    var pluginBase = {
      updatePillText: function mockedUpdatePillText (plugin, options) {
        expect(options.label).toBe('→&#xfe0e;');
      }
    };

    var sbx = setupSandbox({sgvs: [{mills: now, direction: 'Flat'}]}, pluginBase);
    var direction = directionPlugin();
    direction.setProperties(sbx);
    direction.updateVisualisation(sbx);
  });

  it('get the info for a direction', function () {
    var direction = directionPlugin();

    expect(direction.info({mills: now, direction: 'NONE'}).label).toBe('⇼');
    expect(direction.info({mills: now, direction: 'NONE'}).entity).toBe('&#8700;');

    expect(direction.info({mills: now, direction: 'DoubleUp'}).label).toBe('⇈');
    expect(direction.info({mills: now, direction: 'DoubleUp'}).entity).toBe('&#8648;');

    expect(direction.info({mills: now, direction: 'SingleUp'}).label).toBe('↑');
    expect(direction.info({mills: now, direction: 'SingleUp'}).entity).toBe('&#8593;');

    expect(direction.info({mills: now, direction: 'FortyFiveUp'}).label).toBe('↗');
    expect(direction.info({mills: now, direction: 'FortyFiveUp'}).entity).toBe('&#8599;');

    expect(direction.info({mills: now, direction: 'Flat'}).label).toBe('→');
    expect(direction.info({mills: now, direction: 'Flat'}).entity).toBe('&#8594;');

    expect(direction.info({mills: now, direction: 'FortyFiveDown'}).label).toBe('↘');
    expect(direction.info({mills: now, direction: 'FortyFiveDown'}).entity).toBe('&#8600;');

    expect(direction.info({mills: now, direction: 'SingleDown'}).label).toBe('↓');
    expect(direction.info({mills: now, direction: 'SingleDown'}).entity).toBe('&#8595;');

    expect(direction.info({mills: now, direction: 'DoubleDown'}).label).toBe('⇊');
    expect(direction.info({mills: now, direction: 'DoubleDown'}).entity).toBe('&#8650;');

    expect(direction.info({mills: now, direction: 'NOT COMPUTABLE'}).label).toBe('-');
    expect(direction.info({mills: now, direction: 'NOT COMPUTABLE'}).entity).toBe('&#45;');

    expect(direction.info({mills: now, direction: 'RATE OUT OF RANGE'}).label).toBe('⇕');
    expect(direction.info({mills: now, direction: 'RATE OUT OF RANGE'}).entity).toBe('&#8661;');
  });


});
