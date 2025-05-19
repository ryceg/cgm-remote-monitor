import { describe, it, expect } from 'vitest';

const helper = require('./inithelper')();

const FIVE_MINS = 300000;
const SIX_MINS = 360000;

import ddataFactory from '../lib/data/ddata';
import notificationsFactory from '../lib/notifications';
import ar2Plugin from '../lib/plugins/ar2';
import bgnowPlugin from '../lib/plugins/bgnow';
import envFactory from '../lib/server/env';
import sandboxFactory from '../lib/sandbox';

describe('ar2', () => {
  var ctx = helper.getctx();

  ctx.ddata = ddataFactory();
  // env needs to be initialized before notifications
  var env = envFactory();
  ctx.notifications = notificationsFactory(env, ctx);

  var ar2 = ar2Plugin(ctx);
  var bgnow = bgnowPlugin(ctx);

  var now = Date.now();
  var before = now - FIVE_MINS;

  function prepareSandbox(base) {
    var sbx = base || sandboxFactory().serverInit(env, ctx);
    bgnow.setProperties(sbx);
    ar2.setProperties(sbx);
    return sbx;
  }

  it('should plot a cone', () => {
    ctx.ddata.sgvs = [{mgdl: 100, mills: before}, {mgdl: 105, mills: now}];
    var sbx = prepareSandbox();
    var cone = ar2.forecastCone(sbx);
    expect(cone.length).toBe(26);
  });

  it('should plot a line if coneFactor is 0', () => {
    ctx.ddata.sgvs = [{mgdl: 100, mills: before}, {mgdl: 105, mills: now}];

    var env0 = envFactory();
    env0.extendedSettings = { ar2: { coneFactor: 0 } };
    var sbx = sandboxFactory().serverInit(env0, ctx).withExtendedSettings(ar2);
    bgnow.setProperties(sbx);
    var cone = ar2.forecastCone(sbx);
    expect(cone.length).toBe(13);
  });


  it('Not trigger an alarm when in range', () => {
    ctx.notifications.initRequests();
    ctx.ddata.sgvs = [{mgdl: 100, mills: before}, {mgdl: 105, mills: now}];

    var sbx = prepareSandbox();
    ar2.checkNotifications(sbx);
    expect(ctx.notifications.findHighestAlarm()).toBeUndefined();

  });

  it('should trigger a warning when going above target', () => {
    ctx.notifications.initRequests();
    ctx.ddata.sgvs = [{mgdl: 150, mills: before}, {mgdl: 170, mills: now}];

    var sbx = prepareSandbox();
    sbx.offerProperty('iob', function setFakeIOB() {
      return {displayLine: 'IOB: 1.25U'};
    });
    sbx.offerProperty('direction', function setFakeDirection() {
      return {value: 'FortyFiveUp', label: '↗', entity: '&#8599;'};
    });
    ar2.checkNotifications(sbx);
    var highest = ctx.notifications.findHighestAlarm();
    expect(highest.level).toBe(helper.ctx.levels.WARN);
    expect(highest.title).toBe('Warning, HIGH predicted');
    expect(highest.message).toBe('BG Now: 170 +20 ↗ mg/dl\nBG 15m: 206 mg/dl\nIOB: 1.25U');

  });

  it('should trigger a urgent alarm when going high fast', () => {
    ctx.notifications.initRequests();
    ctx.ddata.sgvs = [{mgdl: 140, mills: before}, {mgdl: 200, mills: now}];

    var sbx = prepareSandbox();
    ar2.checkNotifications(sbx);
    var highest = ctx.notifications.findHighestAlarm();
    expect(highest.level).toBe(helper.ctx.levels.URGENT);
    expect(highest.title).toBe('Urgent, HIGH');

  });

  it('should trigger a warning when below target', () => {
    ctx.notifications.initRequests();
    ctx.ddata.sgvs = [{mgdl: 90, mills: before}, {mgdl: 80, mills: now}];

    var sbx = prepareSandbox();
    ar2.checkNotifications(sbx);
    var highest = ctx.notifications.findHighestAlarm();
    expect(highest.level).toBe(helper.ctx.levels.WARN);
    expect(highest.title).toBe('Warning, LOW');

  });

  it('should trigger a warning when almost below target', () => {
    ctx.notifications.initRequests();
    ctx.ddata.sgvs = [{mgdl: 90, mills: before}, {mgdl: 83, mills: now}];

    var sbx = prepareSandbox();
    ar2.checkNotifications(sbx);
    var highest = ctx.notifications.findHighestAlarm();
    expect(highest.level).toBe(helper.ctx.levels.WARN);
    expect(highest.title).toBe('Warning, LOW predicted');

  });

  it('should trigger a urgent alarm when falling fast', () => {
    ctx.notifications.initRequests();
    ctx.ddata.sgvs = [{mgdl: 120, mills: before}, {mgdl: 85, mills: now}];

    var sbx = prepareSandbox();
    ar2.checkNotifications(sbx);
    var highest = ctx.notifications.findHighestAlarm();
    expect(highest.level).toBe(helper.ctx.levels.URGENT);
    expect(highest.title).toBe('Urgent, LOW predicted');

  });

  it('should trigger a warning alarm by interpolating when more than 5mins apart', () => {
    ctx.notifications.initRequests();

    //same as previous test but prev is 10 mins ago, so delta isn't enough to trigger an urgent alarm
    ctx.ddata.sgvs = [{mgdl: 120, mills: before - SIX_MINS}, {mgdl: 85, mills: now}];

    var sbx = prepareSandbox();
    ar2.checkNotifications(sbx);
    var highest = ctx.notifications.findHighestAlarm();
    expect(highest.level).toBe(helper.ctx.levels.WARN);
    expect(highest.title).toBe('Warning, LOW predicted');

  });

  it('should handle virtAsst requests', () => {
     var now = Date.now();
     var before = now - FIVE_MINS;

    ctx.ddata.sgvs = [{mgdl: 100, mills: before}, {mgdl: 105, mills: now}];
    var sbx = prepareSandbox();

    expect(ar2.virtAsst.intentHandlers.length).toBe(1);

    ar2.virtAsst.intentHandlers[0].intentHandler(function next(title, response) {
      expect(title).toBe('AR2 Forecast');
      expect(response).toBe('According to the AR2 forecast you are expected to be between 109 and 120 over the next in 30 minutes');
    }, [], sbx);
  });

  it('should trigger a urgent alarm when going low fast', () => {
    ctx.notifications.initRequests();
    ctx.ddata.sgvs = [{mgdl: 100, mills: before}, {mgdl: 40, mills: now}];

    var sbx = prepareSandbox();
    ar2.checkNotifications(sbx);
    var highest = ctx.notifications.findHighestAlarm();
    expect(highest.level).toBe(helper.ctx.levels.URGENT);
    expect(highest.title).toBe('Urgent, LOW');

  });

  it('should trigger a warning when going low fast but with positive IOB', () => {
    ctx.notifications.initRequests();
    ctx.ddata.sgvs = [{mgdl: 100, mills: before}, {mgdl: 40, mills: now}];

    var sbx = prepareSandbox();
    sbx.offerProperty('iob', function setFakeIOB() {
      return {displayLine: 'IOB: 1.25U'};
    });
    ar2.setProperties(sbx);
    ar2.checkNotifications(sbx);
    var highest = ctx.notifications.findHighestAlarm();
    expect(highest.level).toBe(helper.ctx.levels.WARN);
    expect(highest.title).toBe('Warning, LOW predicted');

  });


  it('should trigger a warning when going low fast but with positive IOB and low target', () => {
    ctx.notifications.initRequests();
    ctx.ddata.sgvs = [{mgdl: 100, mills: before}, {mgdl: 40, mills: now}];

    var env_low = envFactory();
    env_low.extendedSettings = { ar2: { targetBG: 70 } };
    var sbx = sandboxFactory().serverInit(env_low, ctx).withExtendedSettings(ar2);
    bgnow.setProperties(sbx);
    sbx.offerProperty('iob', function setFakeIOB() {
      return {displayLine: 'IOB: 1.25U'};
    });
    ar2.setProperties(sbx);
    ar2.checkNotifications(sbx);
    var highest = ctx.notifications.findHighestAlarm();
    expect(highest.level).toBe(helper.ctx.levels.WARN);
    expect(highest.title).toBe('Warning, LOW predicted');

  });


  it('should trigger a urgent alarm when going low fast and low target', () => {
    ctx.notifications.initRequests();
    ctx.ddata.sgvs = [{mgdl: 100, mills: before}, {mgdl: 40, mills: now}];

    var env_low = envFactory();
    env_low.extendedSettings = { ar2: { targetBG: 70 } };
    var sbx = sandboxFactory().serverInit(env_low, ctx).withExtendedSettings(ar2);
    bgnow.setProperties(sbx);
    ar2.setProperties(sbx);
    ar2.checkNotifications(sbx);
    var highest = ctx.notifications.findHighestAlarm();
    expect(highest.level).toBe(helper.ctx.levels.URGENT);
    expect(highest.title).toBe('Urgent, LOW');

  });


  it('should trigger a urgent alarm when going low fast and low target and negative IOB', () => {
    ctx.notifications.initRequests();
    ctx.ddata.sgvs = [{mgdl: 100, mills: before}, {mgdl: 40, mills: now}];

    var env_low = envFactory();
    env_low.extendedSettings = { ar2: { targetBG: 70 } };
    var sbx = sandboxFactory().serverInit(env_low, ctx).withExtendedSettings(ar2);
    bgnow.setProperties(sbx);
    sbx.offerProperty('iob', function setFakeIOB() {
      return {displayLine: 'IOB: -1.25U'};
    });
    ar2.setProperties(sbx);
    ar2.checkNotifications(sbx);
    var highest = ctx.notifications.findHighestAlarm();
    expect(highest.level).toBe(helper.ctx.levels.URGENT);
    expect(highest.title).toBe('Urgent, LOW');

  });

});