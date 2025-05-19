'use strict';

import { describe, it, expect } from 'vitest'; // Added import
const _ = require('lodash');
const helper = require('./inithelper')();

describe('COB', function ( ) {
  var ctx = helper.ctx;

  var cob = require('../lib/plugins/cob')(ctx);

  var profileData = {
    startDate: '2015-06-21'
    , sens: 95
    , carbratio: 18
    , carbs_hr: 30
  };

  var profile = require('../lib/profilefunctions')([profileData], ctx);

  it('should calculate IOB, multiple treatments', function() {

    var treatments = [
      {
        'carbs': '100',
        'mills': new Date('2015-05-29T02:03:48.827Z').getTime()
      },
      {
        'carbs': '10',
        'mills': new Date('2015-05-29T03:45:10.670Z').getTime()
      }
    ];

    var devicestatus = [];

    var after100 = cob.cobTotal(treatments, devicestatus, profile, new Date('2015-05-29T02:03:49.827Z').getTime());
    var before10 = cob.cobTotal(treatments, devicestatus, profile, new Date('2015-05-29T03:45:10.670Z').getTime());
    var after10 = cob.cobTotal(treatments, devicestatus, profile, new Date('2015-05-29T03:45:11.670Z').getTime());

    expect(after100.cob).toBe(100);
    expect(Math.round(before10.cob)).toBe(59);
    expect(Math.round(after10.cob)).toBe(69);  //WTF == 128
  });

  it('should calculate IOB, single treatment', function() {

    var treatments = [
      {
        'carbs': '8',
        'mills': new Date('2015-05-29T04:40:40.174Z').getTime()
      }
    ];

    var devicestatus = [];

    var rightAfterCorrection = new Date('2015-05-29T04:41:40.174Z').getTime();
    var later1 = new Date('2015-05-29T05:04:40.174Z').getTime();
    var later2 = new Date('2015-05-29T05:20:00.174Z').getTime();
    var later3 = new Date('2015-05-29T05:50:00.174Z').getTime();
    var later4 = new Date('2015-05-29T06:50:00.174Z').getTime();

    var result1 = cob.cobTotal(treatments, devicestatus, profile, rightAfterCorrection);
    var result2 = cob.cobTotal(treatments, devicestatus, profile, later1);
    var result3 = cob.cobTotal(treatments, devicestatus, profile, later2);
    var result4 = cob.cobTotal(treatments, devicestatus, profile, later3);
    var result5 = cob.cobTotal(treatments, devicestatus, profile, later4);

    expect(result1.cob).toBe(8);
    expect(result2.cob).toBe(6);
    expect(result3.cob).toBe(0);
    expect(result4.cob).toBe(0);
    expect(result5.cob).toBe(0);
  });

  it('set a pill to the current COB', function (done) {
    var data = {
      treatments: [{
        carbs: '8'
        , 'mills': Date.now() - 60000 //1m ago
      }]
      , profile: profile
    };

    ctx.pluginBase = {
        updatePillText: function mockedUpdatePillText (plugin, options) {
          expect(options.value).toBe('8g');
          done();
        }
    };

    var sandbox = require('../lib/sandbox')();
    var sbx = sandbox.clientInit(ctx, Date.now(), data);
    cob.setProperties(sbx);
    cob.updateVisualisation(sbx);

  });

  it('should handle virtAsst requests', function (done) {
    var data = {
      treatments: [{
        carbs: '8'
        , 'mills': Date.now() - 60000 //1m ago
      }]
      , profile: profile
    };

    var sandbox = require('../lib/sandbox')();
    var sbx = sandbox.clientInit(ctx, Date.now(), data);
    cob.setProperties(sbx);

    expect(cob.virtAsst.intentHandlers.length).toBe(1);

    cob.virtAsst.intentHandlers[0].intentHandler(function next(title, response) {
      expect(title).toBe('Current COB');
      expect(response).toBe('You have 8 carbohydrates on board');
      done();
    }, [], sbx);

  });

  describe('from devicestatus', function () {
    var time = Date.now();
    var treatments = [{
      mills: time - 1,
      carbs: '20'
    }];

    var OPENAPS_DEVICESTATUS = {
      device: 'openaps://pi1',
      openaps: {
        enacted: {
          COB: 30
        }
      }
    };

    var treatmentCOB = cob.fromTreatments(treatments, OPENAPS_DEVICESTATUS, profile, time).cob;

    it('should fall back to treatment data if no devicestatus data', function() {
      expect(cob.cobTotal(treatments, [], profile, time)).toEqual(expect.objectContaining({
        source: 'Care Portal',
        cob: treatmentCOB
      }));
    });

    it('should fall back to treatments if openaps devicestatus is present but empty', function() {
      var devicestatus = [{
        device: 'openaps://pi1',
        mills: time - 1,
        openaps: {}
      }];
      expect(cob.cobTotal(treatments, devicestatus, profile, time).cob).toBe(treatmentCOB);
    });

    it('should fall back to treatments if openaps devicestatus is present but too stale', function() {
      var devicestatus = [_.merge(OPENAPS_DEVICESTATUS, { mills: time - cob.RECENCY_THRESHOLD - 1, openaps: {enacted: {COB: 5, timestamp: time - cob.RECENCY_THRESHOLD - 1} } })];
      expect(cob.cobTotal(treatments, devicestatus, profile, time)).toEqual(expect.objectContaining({
        source: 'Care Portal',
        cob: treatmentCOB
      }));
    });

    it('should return COB data from OpenAPS', function () {
      var devicestatus = [_.merge(OPENAPS_DEVICESTATUS, { mills: time - 1, openaps: {enacted: {COB: 5, timestamp: time - 1} } })];
      expect(cob.cobTotal(treatments, devicestatus, profile, time)).toEqual(expect.objectContaining({
        cob: 5,
        source: 'OpenAPS',
        device: 'openaps://pi1'
      }));
    });

    it('should return COB data from Loop', function () {

      var LOOP_DEVICESTATUS = {
        device: 'loop://iPhone',
        loop: {
          cob: {
            cob: 5
          }
        }
      };

      var devicestatus = [_.merge(LOOP_DEVICESTATUS, { mills: time - 1, loop: {cob: {timestamp: time - 1} } })];
      expect(cob.cobTotal(treatments, devicestatus, profile, time)).toEqual(expect.objectContaining({
        cob: 5,
        source: 'Loop',
        device: 'loop://iPhone'
      }));
    });

  });


});
