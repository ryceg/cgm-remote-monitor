import { describe, it, expect } from 'vitest';
import levels from '../lib/levels';

describe('simplealarms', () => {
  const env = require('../lib/server/env')();
  const ctx = {
    settings: {}
    , language: require('../lib/language')()
    , levels: levels
  };

  const simplealarms = require('../lib/plugins/simplealarms')(ctx);

  ctx.ddata = require('../lib/data/ddata')();
  ctx.notifications = require('../lib/notifications')(env, ctx);
  const bgnow = require('../lib/plugins/bgnow')(ctx);

  const now = Date.now();
  const before = now - (5 * 60 * 1000);

  it('Not trigger an alarm when in range', () => {
    ctx.notifications.initRequests();
    ctx.ddata.sgvs = [{mills: now, mgdl: 100}];

    const sbx = require('../lib/sandbox')().serverInit(env, ctx);
    simplealarms.checkNotifications(sbx);
    expect(ctx.notifications.findHighestAlarm()).toBeUndefined();
  });

  it('should trigger a warning when above target', () => {
    ctx.notifications.initRequests();
    ctx.ddata.sgvs = [{mills: before, mgdl: 171}, {mills: now, mgdl: 181}];

    const sbx = require('../lib/sandbox')().serverInit(env, ctx);
    bgnow.setProperties(sbx);
    simplealarms.checkNotifications(sbx);
    const highest = ctx.notifications.findHighestAlarm();
    expect(highest.level).toBe(levels.WARN);
    expect(highest.message).toBe('BG Now: 181 +10 mg/dl');
  });

  it('should trigger a urgent alarm when really high', () => {
    ctx.notifications.initRequests();
    ctx.ddata.sgvs = [{mills: now, mgdl: 400}];

    const sbx = require('../lib/sandbox')().serverInit(env, ctx);
    simplealarms.checkNotifications(sbx);
    expect(ctx.notifications.findHighestAlarm().level).toBe(levels.URGENT);
  });

  it('should trigger a warning when below target', () => {
    ctx.notifications.initRequests();
    ctx.ddata.sgvs = [{mills: now, mgdl: 70}];

    const sbx = require('../lib/sandbox')().serverInit(env, ctx);
    simplealarms.checkNotifications(sbx);
    expect(ctx.notifications.findHighestAlarm().level).toBe(levels.WARN);
  });

  it('should trigger a urgent alarm when really low', () => {
    ctx.notifications.initRequests();
    ctx.ddata.sgvs = [{mills: now, mgdl: 40}];

    const sbx = require('../lib/sandbox')().serverInit(env, ctx);
    simplealarms.checkNotifications(sbx);
    expect(ctx.notifications.findHighestAlarm().level).toBe(levels.URGENT);
  });
});