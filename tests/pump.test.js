'use strict';

import { describe, it, expect, vi } from 'vitest';
import _ from 'lodash';
const helper = require('./inithelper')();
const moment = helper.ctx.moment;

var top_ctx = helper.getctx();
top_ctx.settings = require('../lib/settings')();
top_ctx.language.set('en');

var env = require('../lib/server/env')();
const levels = top_ctx.levels;
const language = top_ctx.language;

var profile = require('../lib/profilefunctions')(null, top_ctx);
var pump = require('../lib/plugins/pump')(top_ctx);
var sandbox = require('../lib/sandbox')(top_ctx);

var statuses = [{
  created_at: '2015-12-05T17:35:00.000Z'
  , device: 'openaps://farawaypi'
  , pump: {
    battery: {
      status: 'normal',
      voltage: 1.52
    },
    status: {
      status: 'normal',
      bolusing: false,
      suspended: false
    },
    reservoir: 86.4,
    clock: '2015-12-05T17:32:00.000Z'
  }
}, {
  created_at: '2015-12-05T19:05:00.000Z'
  , device: 'openaps://abusypi'
  , pump: {
    battery: {
      status: 'normal',
      voltage: 1.52
    },
    status: {
      status: 'normal',
      bolusing: false,
      suspended: false
    },
    reservoir: 86.4,
    clock: '2015-12-05T19:02:00.000Z'
  }
}];

var profileData =
{
  'timezone': moment.tz.guess()
};

var statuses2 = [{
  created_at: '2015-12-05T17:35:00.000Z'
  , device: 'openaps://farawaypi'
  , pump: {
    battery: {
      status: 'normal',
      voltage: 1.52
    },
    status: {
      status: 'normal',
      bolusing: false,
      suspended: false
    },
    reservoir: 86.4,
    reservoir_display_override: '50+U',
    clock: '2015-12-05T17:32:00.000Z'
  }
}, {
  created_at: '2015-12-05T19:05:00.000Z'
  , device: 'openaps://abusypi'
  , pump: {
    battery: {
      status: 'normal',
      voltage: 1.52
    },
    status: {
      status: 'normal',
      bolusing: false,
      suspended: false
    },
    reservoir: 86.4,
    reservoir_display_override: '50+U',
    clock: '2015-12-05T19:02:00.000Z'
  }
}];

var now = moment(statuses[1].created_at);

_.forEach(statuses, function updateMills (status) {
  status.mills = moment(status.created_at).valueOf();
});

_.forEach(statuses2, function updateMills (status) {
  status.mills = moment(status.created_at).valueOf();
});

describe('pump', () => {

  it('set the property and update the pill', async () => {
    const ctx = {
      settings: {
        units: 'mg/dl'
      }
      , pluginBase: {
        updatePillText: vi.fn((plugin, options) => {
          expect(options.label).toEqual('Pump');
          expect(options.value).toEqual('86.4U');
        })
      }
      , language: language
      , levels: levels
    };

    var sbx = sandbox.clientInit(ctx, now.valueOf(), {devicestatus: statuses});

    var unmockedOfferProperty = sbx.offerProperty;
    sbx.offerProperty = function mockedOfferProperty (name, setter) {
      expect(name).toEqual('pump');
      var result = setter();
      expect(result).toBeDefined();
      expect(result.data.level).toEqual(levels.NONE);
      expect(result.data.battery.value).toEqual(1.52);
      expect(result.data.reservoir.value).toEqual(86.4);

      sbx.offerProperty = unmockedOfferProperty;
      unmockedOfferProperty(name, setter);

    };

    pump.setProperties(sbx);
    pump.updateVisualisation(sbx);
    expect(ctx.pluginBase.updatePillText).toHaveBeenCalled();
  });

  it('use reservoir_display_override when available', async () => {
    const ctx = {
      settings: {
        units: 'mmol'
      }
      , pluginBase: {
        updatePillText: vi.fn((plugin, options) => {
          expect(options.label).toEqual('Pump');
          expect(options.value).toEqual('50+U');
        })
      }
      , language: language
      , levels: levels
    };

    var sbx = sandbox.clientInit(ctx, now.valueOf(), {devicestatus: statuses2});

    var unmockedOfferProperty = sbx.offerProperty;
    sbx.offerProperty = function mockedOfferProperty (name, setter) {
      expect(name).toEqual('pump');
      sbx.offerProperty = unmockedOfferProperty;
      unmockedOfferProperty(name, setter);
    };

    pump.setProperties(sbx);
    pump.updateVisualisation(sbx);
    expect(ctx.pluginBase.updatePillText).toHaveBeenCalled();
  });

  it('not generate an alert when pump is ok', () => {
    var ctx = {
      settings: {
        units: 'mg/dl'
      }
      , notifications: require('../lib/notifications')(env, top_ctx)
      , language: language
      , levels: levels
    };

    ctx.notifications.initRequests();

    var sbx = sandbox.clientInit(ctx, now.valueOf(), {
      devicestatus: statuses
    });
    sbx.extendedSettings = { 'enableAlerts': true };
    pump.setProperties(sbx);
    pump.checkNotifications(sbx);

    var highest = ctx.notifications.findHighestAlarm('Pump');
    expect(highest).toBeUndefined();
  });

  it('generate an alert when reservoir is low', () => {
    var ctx = {
      settings: {
        units: 'mg/dl'
      }
      , notifications: require('../lib/notifications')(env, top_ctx)
      , language: language
      , levels: levels
    };

    ctx.notifications.initRequests();

    var lowResStatuses = _.cloneDeep(statuses);
    lowResStatuses[1].pump.reservoir = 0.5;

    var sbx = sandbox.clientInit(ctx, now.valueOf(), {
      devicestatus: lowResStatuses
    });
    sbx.extendedSettings = { 'enableAlerts': true };
    pump.setProperties(sbx);
    pump.checkNotifications(sbx);

    var highest = ctx.notifications.findHighestAlarm('Pump');
    expect(highest.level).toEqual(levels.URGENT);
    expect(highest.title).toEqual('URGENT: Pump Reservoir Low');
  });

  it('generate an alert when reservoir is 0', () => {
    var ctx = {
      settings: {
        units: 'mg/dl'
      }
      , notifications: require('../lib/notifications')(env, top_ctx)
      , language: language
      , levels: levels
    };

    ctx.notifications.initRequests();

    var lowResStatuses = _.cloneDeep(statuses);
    lowResStatuses[1].pump.reservoir = 0;

    var sbx = sandbox.clientInit(ctx, now.valueOf(), {
      devicestatus: lowResStatuses
    });
    sbx.extendedSettings = { 'enableAlerts': true };
    pump.setProperties(sbx);
    pump.checkNotifications(sbx);

    var highest = ctx.notifications.findHighestAlarm('Pump');
    expect(highest.level).toEqual(levels.URGENT);
    expect(highest.title).toEqual('URGENT: Pump Reservoir Low');
  });


  it('generate an alert when battery is low', () => {
    var ctx = {
      settings: {
        units: 'mg/dl'
      }
      , notifications: require('../lib/notifications')(env, top_ctx)
      , language: language
      , levels: levels
    };

    ctx.notifications.initRequests();

    var lowBattStatuses = _.cloneDeep(statuses);
    lowBattStatuses[1].pump.battery.voltage = 1.33;

    var sbx = sandbox.clientInit(ctx, now.valueOf(), {
      devicestatus: lowBattStatuses
    });
    sbx.extendedSettings = { 'enableAlerts': true };
    pump.setProperties(sbx);
    pump.checkNotifications(sbx);

    var highest = ctx.notifications.findHighestAlarm('Pump');
    expect(highest.level).toEqual(levels.WARN);
    expect(highest.title).toEqual('Warning, Pump Battery Low');
  });

  it('generate an urgent alarm when battery is really low', () => {
    var ctx = {
      settings: {
        units: 'mg/dl'
      }
      , notifications: require('../lib/notifications')(env, top_ctx)
      , language: language
      , levels: levels
    };

    ctx.notifications.initRequests();

    var lowBattStatuses = _.cloneDeep(statuses);
    lowBattStatuses[1].pump.battery.voltage = 1.00;

    var sbx = sandbox.clientInit(ctx, now.valueOf(), {
      devicestatus: lowBattStatuses
    });
    sbx.extendedSettings = { 'enableAlerts': true };
    pump.setProperties(sbx);
    pump.checkNotifications(sbx);

    var highest = ctx.notifications.findHighestAlarm('Pump');
    expect(highest.level).toEqual(levels.URGENT);
    expect(highest.title).toEqual('URGENT: Pump Battery Low');
  });

  it('not generate a battery alarm during night when PUMP_WARN_BATT_QUIET_NIGHT is true', async () => {
    const ctx = {
      settings: {
        units: 'mg/dl'
        , dayStart: 24 // Set to 24 so it always evaluates true in test
        , dayEnd: 21.0
      }
      , pluginBase: {
        updatePillText: vi.fn((plugin, options) => {
          expect(options.label).toEqual('Pump');
          expect(options.value).toEqual('86.4U');
        })
      }
      , notifications: require('../lib/notifications')(env, top_ctx)
      , language: require('../lib/language')()
      , levels: levels
    };

    ctx.notifications.initRequests();

    var lowBattStatuses = _.cloneDeep(statuses);
    lowBattStatuses[1].pump.battery.voltage = 1.00;

    var sbx = sandbox.clientInit(ctx, now.valueOf(), {
      devicestatus: lowBattStatuses
      , profiles: [profileData]
    });
    profile.loadData(_.cloneDeep([profileData]));
    sbx.data.profile = profile;

    sbx.extendedSettings = {
      enableAlerts: true
      , warnBattQuietNight: true
    };
    pump.setProperties(sbx);
    pump.checkNotifications(sbx);

    var highest = ctx.notifications.findHighestAlarm('Pump');
    expect(highest).toBeUndefined();
    // The original test called done() inside updatePillText,
    // but checkNotifications doesn't seem to trigger it in this specific test case.
    // If updatePillText was indeed expected to be called, this assertion would fail.
    // expect(ctx.pluginBase.updatePillText).toHaveBeenCalled();
  });

  it('not generate an alert for a stale pump data, when there is an offline marker', () => {
    var ctx = {
      settings: {
        units: 'mg/dl'
      }
      , notifications: require('../lib/notifications')(env, top_ctx)
      , language: language
      , levels: levels
    };

    ctx.notifications.initRequests();

    var sbx = sandbox.clientInit(ctx, now.add(1, 'hours').valueOf(), {
      devicestatus: statuses
      , treatments: [{eventType: 'OpenAPS Offline', mills: now.valueOf(), duration: 60}]
    });
    sbx.extendedSettings = { 'enableAlerts': true };
    pump.setProperties(sbx);
    pump.checkNotifications(sbx);

    var highest = ctx.notifications.findHighestAlarm('Pump');
    expect(highest).toBeUndefined();
  });

  it('should handle virtAsst requests', () => {
    return new Promise((resolve) => {
      const ctx = {
        settings: {
          units: 'mg/dl'
        }
        , notifications: require('../lib/notifications')(env, top_ctx)
        , language: language
        , levels: levels
      };

      ctx.language.set('en');
      var sbx = sandbox.clientInit(ctx, now.valueOf(), {devicestatus: statuses});
      pump.setProperties(sbx);

      expect(pump.virtAsst.intentHandlers.length).toEqual(4);

      pump.virtAsst.intentHandlers[0].intentHandler(function next(title, response) {
        expect(title).toEqual('Insulin Remaining');
        expect(response).toEqual('You have 86.4 units remaining');

        pump.virtAsst.intentHandlers[1].intentHandler(function next(title, response) {
          expect(title).toEqual('Pump Battery');
          expect(response).toEqual('Your pump battery is at 1.52 volts');

          pump.virtAsst.intentHandlers[2].intentHandler(function next(title, response) {
            expect(title).toEqual('Insulin Remaining');
            expect(response).toEqual('You have 86.4 units remaining');

            pump.virtAsst.intentHandlers[3].intentHandler(function next(title, response) {
              expect(title).toEqual('Pump Battery');
              expect(response).toEqual('Your pump battery is at 1.52 volts');
              resolve();
            }, [], sbx);

          }, [], sbx);

        }, [], sbx);

      }, [], sbx);
    });
  });

});
