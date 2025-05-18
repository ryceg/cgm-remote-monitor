import { describe, it, expect, vi } from 'vitest';
import levels from '../lib/levels';
import envLib from '../lib/server/env';
import notificationsLib from '../lib/notifications';
import pushnotifyLib from '../lib/server/pushnotify';

describe('pushnotify', () => {

  it('send a pushover alarm, but only 1 time', () => {
    return new Promise((resolve) => {
      const env = envLib();
      const ctx = {};

      ctx.levels = levels;
      ctx.notifications = notificationsLib(env, ctx);

      const notify = {
        title: 'Warning, this is a test!'
        , message: 'details details details details'
        , level: levels.WARN
        , pushoverSound: 'climb'
        , plugin: {name: 'test'}
      };

      ctx.pushover = {
        PRIORITY_NORMAL: 0
        , PRIORITY_EMERGENCY: 2
        , send: vi.fn((notify2, callback) => {
            expect(notify2).toEqual(notify);
            callback(null, JSON.stringify({receipt: 'abcd12345'}));
            resolve();
          })
      };

      ctx.pushnotify = pushnotifyLib(env, ctx);

      ctx.pushnotify.emitNotification(notify);

      //call again, but should be deduped, or fail with 'done() called multiple times'
      ctx.pushnotify.emitNotification(notify);
    });
  });

  it('send a pushover notification, but only 1 time', () => {
    return new Promise((resolve) => {
      const env = envLib();
      const ctx = {};
      ctx.levels = levels;
      ctx.notifications = notificationsLib(env, ctx);

      const notify = {
        title: 'Sent from a test'
        , message: 'details details details details'
        , level: levels.INFO
        , plugin: {name: 'test'}
      };

      ctx.pushover = {
        PRIORITY_NORMAL: 0
        , PRIORITY_EMERGENCY: 2
        , send: vi.fn((notify2, callback) => {
          expect(notify2).toEqual(notify);
            callback(null, JSON.stringify({}));
            resolve();
          })
      };

      ctx.pushnotify = pushnotifyLib(env, ctx);

      ctx.pushnotify.emitNotification(notify);

      //call again, but should be deduped, or fail with 'done() called multiple times'
      ctx.pushnotify.emitNotification(notify);
    });
  });

  it('send a pushover alarm, and then cancel', () => {
    return new Promise((resolve) => {
      const env = envLib();
      const ctx = {};
      ctx.levels = levels;

      ctx.notifications = notificationsLib(env, ctx);

      const notify = {
        title: 'Warning, this is a test!'
        , message: 'details details details details'
        , level: levels.WARN
        , pushoverSound: 'climb'
        , plugin: {name: 'test'}
      };

      ctx.pushover = {
        PRIORITY_NORMAL: 0
        , PRIORITY_EMERGENCY: 2
        , send: vi.fn((notify2, callback) => {
          expect(notify2).toEqual(notify);
          callback(null, JSON.stringify({receipt: 'abcd12345'}));
        })
        , cancelWithReceipt: vi.fn((receipt) => {
          expect(receipt).toEqual('abcd12345');
          resolve();
        })
      };

      ctx.pushnotify = pushnotifyLib(env, ctx);

      //first send the warning
      ctx.pushnotify.emitNotification(notify);

      //then pretend is was acked from the web
      ctx.pushnotify.emitNotification({clear: true});
    });
  });
});
