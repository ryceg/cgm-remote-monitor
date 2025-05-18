import { describe, it, expect } from 'vitest';
import levels from '../lib/levels';
import times from '../lib/times';
import ddataLib from '../lib/data/ddata';
import notificationsLib from '../lib/notifications';
import languageLib from '../lib/language';
import settingsLib from '../lib/settings';
import timeagoPlugin from '../lib/plugins/timeago';
import envLib from '../lib/server/env';
import sandboxLib from '../lib/sandbox';

describe('timeago', () => {
  const ctx = {};
  ctx.levels = levels;
  ctx.ddata = ddataLib();
  const env = envLib(); // Define env before using it in notificationsLib
  ctx.notifications = notificationsLib(env, ctx);
  ctx.language = languageLib();
  ctx.settings = settingsLib();
  ctx.settings.heartbeat = 0.5; // short heartbeat to speedup tests

  const timeago = timeagoPlugin(ctx);

  function freshSBX () {
    //set extendedSettings right before calling withExtendedSettings, there's some strange test interference here
    env.extendedSettings = { timeago: { enableAlerts: true } };
    const sbx = sandboxLib().serverInit(env, ctx).withExtendedSettings(timeago);
    return sbx;
  }

  it('Not trigger an alarm when data is current', () => {
    ctx.notifications.initRequests();
    ctx.ddata.sgvs = [{ mills: Date.now(), mgdl: 100, type: 'sgv' }];

    const sbx = freshSBX();
    timeago.checkNotifications(sbx);
    expect(ctx.notifications.findHighestAlarm('Time Ago')).toBeUndefined();
  });

  it('Not trigger an alarm with future data', () => {
    ctx.notifications.initRequests();
    ctx.ddata.sgvs = [{ mills: Date.now() + times.mins(15).msecs, mgdl: 100, type: 'sgv' }];

    const sbx = freshSBX();
    timeago.checkNotifications(sbx);
    expect(ctx.notifications.findHighestAlarm('Time Ago')).toBeUndefined();
  });


  it('should trigger a warning when data older than 15m', () => {
    ctx.notifications.initRequests();
    ctx.ddata.sgvs = [{ mills: Date.now() - times.mins(16).msecs, mgdl: 100, type: 'sgv' }];

    const sbx = freshSBX();
    timeago.checkNotifications(sbx);

    const highest = ctx.notifications.findHighestAlarm('Time Ago');
    expect(highest.level).toEqual(levels.WARN);
    expect(highest.message).toEqual('Last received: 16 mins ago\nBG Now: 100 mg/dl');
  });

  it('should trigger an urgent alarm when data older than 30m', () => {
    ctx.notifications.initRequests();
    ctx.ddata.sgvs = [{ mills: Date.now() - times.mins(31).msecs, mgdl: 100, type: 'sgv' }];

    const sbx = freshSBX();
    timeago.checkNotifications(sbx);
    const highest = ctx.notifications.findHighestAlarm('Time Ago');
    expect(highest.level).toEqual(levels.URGENT);
    expect(highest.message).toEqual('Last received: 31 mins ago\nBG Now: 100 mg/dl');
  });

  it('calc timeago displays', () => {
    const now = Date.now();

    expect(
      timeago.calcDisplay({ mills: now + times.mins(15).msecs }, now)
    ).toEqual({ label: 'in the future', shortLabel: 'future' });

    //TODO: current behavior, we can do better
    //just a little in the future, pretend it's ok
    expect(
      timeago.calcDisplay({ mills: now + times.mins(4).msecs }, now)
    ).toEqual({ value: 1, label: 'min ago', shortLabel: 'm' });

    expect(
      timeago.calcDisplay(null, now)
    ).toEqual({ label: 'time ago', shortLabel: 'ago' });

    expect(
      timeago.calcDisplay({ mills: now }, now)
    ).toEqual({ value: 1, label: 'min ago', shortLabel: 'm' });

    expect(
      timeago.calcDisplay({ mills: now - 1 }, now)
    ).toEqual({ value: 1, label: 'min ago', shortLabel: 'm' });

    expect(
      timeago.calcDisplay({ mills: now - times.sec(30).msecs }, now)
    ).toEqual({ value: 1, label: 'min ago', shortLabel: 'm' });

    expect(
      timeago.calcDisplay({ mills: now - times.mins(30).msecs }, now)
    ).toEqual({ value: 30, label: 'mins ago', shortLabel: 'm' });

    expect(
      timeago.calcDisplay({ mills: now - times.hours(5).msecs }, now)
    ).toEqual({ value: 5, label: 'hours ago', shortLabel: 'h' });

    expect(
      timeago.calcDisplay({ mills: now - times.days(5).msecs }, now)
    ).toEqual({ value: 5, label: 'days ago', shortLabel: 'd' });

    expect(
      timeago.calcDisplay({ mills: now - times.days(10).msecs }, now)
    ).toEqual({ label: 'long ago', shortLabel: 'ago' });
  });
});
