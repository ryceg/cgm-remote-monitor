'use strict';

import { describe, it, expect } from 'vitest';
import _ from 'lodash';
import levels from '../lib/levels';
import settingsLib from '../lib/settings';

describe('settings', () => {
  const settings = settingsLib();

  it('have defaults ready', () => {
    expect(settings.timeFormat).toEqual(12);
    expect(settings.nightMode).toEqual(false);
    expect(settings.showRawbg).toEqual('never');
    expect(settings.customTitle).toEqual('Nightscout');
    expect(settings.theme).toEqual('default');
    expect(settings.alarmUrgentHigh).toEqual(true);
    expect(settings.alarmUrgentHighMins).toEqual([30, 60, 90, 120]);
    expect(settings.alarmHigh).toEqual(true);
    expect(settings.alarmHighMins).toEqual([30, 60, 90, 120]);
    expect(settings.alarmLow).toEqual(true);
    expect(settings.alarmLowMins).toEqual([15, 30, 45, 60]);
    expect(settings.alarmUrgentLow).toEqual(true);
    expect(settings.alarmUrgentLowMins).toEqual([15, 30, 45]);
    expect(settings.alarmUrgentMins).toEqual([30, 60, 90, 120]);
    expect(settings.alarmWarnMins).toEqual([30, 60, 90, 120]);
    expect(settings.alarmTimeagoWarn).toEqual(true);
    expect(settings.alarmTimeagoWarnMins).toEqual(15);
    expect(settings.alarmTimeagoUrgent).toEqual(true);
    expect(settings.alarmTimeagoUrgentMins).toEqual(30);
    expect(settings.language).toEqual('en');
    expect(settings.showPlugins).toEqual('dbsize');
    expect(settings.insecureUseHttp).toEqual(false);
    expect(settings.secureHstsHeader).toEqual(true);
    expect(settings.secureCsp).toEqual(false);
  });

  it('support setting from env vars', () => {
    var expected = [
      'ENABLE'
      , 'DISABLE'
      , 'UNITS'
      , 'TIME_FORMAT'
      , 'NIGHT_MODE'
      , 'SHOW_RAWBG'
      , 'CUSTOM_TITLE'
      , 'THEME'
      , 'ALARM_TYPES'
      , 'ALARM_URGENT_HIGH'
      , 'ALARM_HIGH'
      , 'ALARM_LOW'
      , 'ALARM_URGENT_LOW'
      , 'ALARM_TIMEAGO_WARN'
      , 'ALARM_TIMEAGO_WARN_MINS'
      , 'ALARM_TIMEAGO_URGENT'
      , 'ALARM_TIMEAGO_URGENT_MINS'
      , 'LANGUAGE'
      , 'SHOW_PLUGINS'
      , 'BG_HIGH'
      , 'BG_TARGET_TOP'
      , 'BG_TARGET_BOTTOM'
      , 'BG_LOW'
      , 'SCALE_Y'
    ];

    expect(expected.length).toEqual(24);

    var seen = { };
    settings.eachSettingAsEnv(function markSeenNames(name) {
      seen[name] = true;
    });


    var expectedAndSeen = _.filter(expected, function (name) {
      return seen[name];
    });

    expect(expectedAndSeen.length).toEqual(expected.length);
  });

  it('support setting each', () => {
    var expected = [
      'enable'
      , 'disable'
      , 'units'
      , 'timeFormat'
      , 'nightMode'
      , 'showRawbg'
      , 'customTitle'
      , 'theme'
      , 'alarmTypes'
      , 'alarmUrgentHigh'
      , 'alarmHigh'
      , 'alarmLow'
      , 'alarmUrgentLow'
      , 'alarmTimeagoWarn'
      , 'alarmTimeagoWarnMins'
      , 'alarmTimeagoUrgent'
      , 'alarmTimeagoUrgentMins'
      , 'language'
      , 'showPlugins'
    ];

    expect(expected.length).toEqual(19);

    var seen = { };
    settings.eachSetting(function markSeenNames(name) {
      seen[name] = true;
    });


    var expectedAndSeen = _.filter(expected, function (name) {
      return seen[name];
    });

    expect(expectedAndSeen.length).toEqual(expected.length);

  });

  it('have default features', () => {
    var fresh = settingsLib();
    fresh.eachSettingAsEnv(function () {
      return undefined;
    });

    _.each(fresh.DEFAULT_FEATURES, function eachDefault (feature) {
      expect(fresh.enable).toContain(feature);
    });

  });

  it('support disabling default features', () => {
    var fresh = settingsLib();
    fresh.eachSettingAsEnv(function (name) {
      return name === 'DISABLE' ?
        fresh.DEFAULT_FEATURES.join(' ') + ' ar2' //need to add ar2 here since it will be auto enabled
        : undefined;
    });

    expect(fresh.enable.length).toEqual(0);
  });

  it('parse custom snooze mins', () => {
    var userSetting = {
      ALARM_URGENT_LOW_MINS: '5 10 15'
    };

    var fresh = settingsLib();
    fresh.eachSettingAsEnv(function (name) {
      return userSetting[name];
    });

    expect(fresh.alarmUrgentLowMins).toEqual([5, 10, 15]);

    expect(fresh.snoozeMinsForAlarmEvent({eventName: 'low', level: levels.URGENT})).toEqual([5, 10, 15]);
    expect(fresh.snoozeFirstMinsForAlarmEvent({eventName: 'low', level: levels.URGENT})).toEqual(5);
  });

  it('set thresholds', () => {
    var userThresholds = {
      BG_HIGH: '200'
      , BG_TARGET_TOP: '170'
      , BG_TARGET_BOTTOM: '70'
      , BG_LOW: '60'
    };

    var fresh = settingsLib();
    fresh.eachSettingAsEnv(function (name) {
      return userThresholds[name];
    });

    expect(fresh.thresholds.bgHigh).toEqual(200);
    expect(fresh.thresholds.bgTargetTop).toEqual(170);
    expect(fresh.thresholds.bgTargetBottom).toEqual(70);
    expect(fresh.thresholds.bgLow).toEqual(60);

    expect(fresh.alarmTypes).toEqual(['simple']);
  });

  it('default to predict if no thresholds are set', () => {
    var fresh = settingsLib();
    fresh.eachSettingAsEnv(function ( ) {
      return undefined;
    });

    expect(fresh.alarmTypes).toEqual(['predict']);
  });

  it('ignore junk alarm types', () => {
    var fresh = settingsLib();
    fresh.eachSettingAsEnv(function (name) {
      return name === 'ALARM_TYPES' ? 'beep bop' : undefined;
    });

    expect(fresh.alarmTypes).toEqual(['predict']);
  });

  it('allow multiple alarm types to be set', () => {
    var fresh = settingsLib();
    fresh.eachSettingAsEnv(function (name) {
      return name === 'ALARM_TYPES' ? 'predict simple' : undefined;
    });

    expect(fresh.alarmTypes).toEqual(['predict', 'simple']);
  });

  it('handle screwed up thresholds in a way that will display something that looks wrong', () => {
    var screwedUp = {
      BG_HIGH: '89'
      , BG_TARGET_TOP: '90'
      , BG_TARGET_BOTTOM: '95'
      , BG_LOW: '96'
    };

    var fresh = settingsLib();
    fresh.eachSettingAsEnv(function (name) {
      return screwedUp[name];
    });

    expect(fresh.thresholds.bgHigh).toEqual(91);
    expect(fresh.thresholds.bgTargetTop).toEqual(90);
    expect(fresh.thresholds.bgTargetBottom).toEqual(89);
    expect(fresh.thresholds.bgLow).toEqual(88);

    expect(fresh.alarmTypes).toEqual(['simple']);
  });

  it('check if a feature isEnabled', () => {
    var fresh = settingsLib();
    fresh.enable = ['feature1'];
    expect(fresh.isEnabled('feature1')).toEqual(true);
    expect(fresh.isEnabled('feature2')).toEqual(false);
  });

  it('check if any listed feature isEnabled', () => {
    var fresh = settingsLib();
    fresh.enable = ['feature1'];
    expect(fresh.isEnabled(['unknown', 'feature1'])).toEqual(true);
    expect(fresh.isEnabled(['unknown', 'feature2'])).toEqual(false);
  });

});
