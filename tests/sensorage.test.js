import { describe, it, expect } from 'vitest';
import times from '../lib/times';
const helper = require('./inithelper')();

describe('sage', () => {
  var env = require('../lib/server/env')();
  var ctx = helper.getctx();
  ctx.ddata = require('../lib/data/ddata')();
  ctx.notifications = require('../lib/notifications')(env, ctx);
  var sage = require('../lib/plugins/sensorage')(ctx);
  var sandbox = require('../lib/sandbox')();

  function prepareSandbox ( ) {
    var sbx = require('../lib/sandbox')().serverInit(env, ctx);
    return sbx;
  }

  it('set a pill to the current age since start with change', async () => {
    await new Promise(done => {
      var data = {
        sensorTreatments: [
          {eventType: 'Sensor Change', notes: 'Foo', mills: Date.now() - times.days(2).msecs},
          {eventType: 'Sensor Start', notes: 'Bar', mills: Date.now() - times.days(1).msecs}
        ]
      };

      var context = { // Renamed ctx to context to avoid conflict with outer ctx
        settings: {},
        pluginBase: {
          updatePillText: function mockedUpdatePillText(plugin, options) {
            console.log(JSON.stringify(options));
            expect(options.value).toBe('1d0h');
            expect(options.info[0].label).toBe('Sensor Insert');
            expect(options.info[1]).toMatchObject({ label: 'Duration', value: '2 days 0 hours' });
            expect(options.info[2]).toMatchObject({ label: 'Notes', value: 'Foo' });
            expect(options.info[3].label).toBe('Sensor Start');
            expect(options.info[4]).toMatchObject({ label: 'Duration', value: '1 days 0 hours' });
            expect(options.info[5]).toMatchObject({ label: 'Notes', value: 'Bar' });
            done();
          }
        }
      };
      context.language = require('../lib/language')(); // Use context here

      var sbx = sandbox.clientInit(context, Date.now(), data); // Use context here
      sage.setProperties(sbx);
      sage.updateVisualisation(sbx);
    });
  });

  it('set a pill to the current age since start without change', async () => {
    await new Promise(done => {
      var data = {
        sensorTreatments: [
          {eventType: 'Sensor Start', notes: 'Bar', mills: Date.now() - times.days(3).msecs}
        ]
      };

      var context = { // Renamed ctx to context
        settings: {},
        pluginBase: {
          updatePillText: function mockedUpdatePillText(plugin, options) {
            expect(options.value).toBe('3d0h');
            expect(options.info[0].label).toBe('Sensor Start');
            expect(options.info[1]).toMatchObject({ label: 'Duration', value: '3 days 0 hours' });
            expect(options.info[2]).toMatchObject({ label: 'Notes', value: 'Bar' });
            done();
          }
        }
      };
      context.language = require('../lib/language')(); // Use context here

      var sbx = sandbox.clientInit(context, Date.now(), data); // Use context here
      sage.setProperties(sbx);
      sage.updateVisualisation(sbx);
    });
  });

  it('set a pill to the current age since change without start', async () => {
    await new Promise(done => {
      var data = {
        sensorTreatments: [
          {eventType: 'Sensor Change', notes: 'Foo', mills: Date.now() - times.days(3).msecs}
        ]
      };

      var context = { // Renamed ctx to context
        settings: {},
        pluginBase: {
          updatePillText: function mockedUpdatePillText(plugin, options) {
            expect(options.value).toBe('3d0h');
            expect(options.info[0].label).toBe('Sensor Insert');
            expect(options.info[1]).toMatchObject({ label: 'Duration', value: '3 days 0 hours' });
            expect(options.info[2]).toMatchObject({ label: 'Notes', value: 'Foo' });
            done();
          }
        }
      };
      context.language = require('../lib/language')(); // Use context here

      var sbx = sandbox.clientInit(context, Date.now(), data); // Use context here
      sage.setProperties(sbx);
      sage.updateVisualisation(sbx);
    });
  });

  it('set a pill to the current age since change after start', async () => {
    await new Promise(done => {
      var data = {
        sensorTreatments: [
          {eventType: 'Sensor Start', notes: 'Bar', mills: Date.now() - times.days(10).msecs},
          {eventType: 'Sensor Change', notes: 'Foo', mills: Date.now() - times.days(3).msecs}
        ]
      };

      var context = { // Renamed ctx to context
        settings: {},
        pluginBase: {
          updatePillText: function mockedUpdatePillText(plugin, options) {
            expect(options.value).toBe('3d0h');
            expect(options.info.length).toBe(3);
            expect(options.info[0].label).toBe('Sensor Insert');
            expect(options.info[1]).toMatchObject({ label: 'Duration', value: '3 days 0 hours' });
            expect(options.info[2]).toMatchObject({ label: 'Notes', value: 'Foo' });
            done();
          }
        }
      };
      context.language = require('../lib/language')(); // Use context here

      var sbx = sandbox.clientInit(context, Date.now(), data); // Use context here
      sage.setProperties(sbx);
      sage.updateVisualisation(sbx);
    });
  });

  it('trigger an alarm when sensor is 6 days and 22 hours old', () => {
    ctx.notifications.initRequests();

    var before = Date.now() - times.days(6).msecs - times.hours(22).msecs;

    ctx.ddata.sensorTreatments = [{eventType: 'Sensor Start', mills: before}];

    var sbx = prepareSandbox();
    sbx.extendedSettings = { 'enableAlerts': true };
    sage.setProperties(sbx);
    sage.checkNotifications(sbx);

    var highest = ctx.notifications.findHighestAlarm('SAGE');
    expect(highest.level).toBe(ctx.levels.URGENT);
    expect(highest.title).toBe('Sensor age 6 days 22 hours');
  });

  it('not trigger an alarm when sensor is 6 days and 23 hours old', () => {
    ctx.notifications.initRequests();

    var before = Date.now() - times.days(6).msecs - times.hours(23).msecs;

    ctx.ddata.sensorTreatments = [{eventType: 'Sensor Start', mills: before}];

    var sbx = prepareSandbox();
    sbx.extendedSettings = { 'enableAlerts': true };
    sage.setProperties(sbx);
    sage.checkNotifications(sbx);

    expect(ctx.notifications.findHighestAlarm('SAGE')).toBeUndefined();
  });
});
