import { describe, it, expect } from 'vitest';
const helper = require('./inithelper')();

describe('utils', () => {
  const ctx = helper.getctx();
  
  ctx.settings = {
    alarmTimeagoUrgentMins: 30,
    alarmTimeagoWarnMins: 15
  };

  var utils = require('../lib/utils')(ctx);

  it('format numbers', () => {
    expect(utils.toFixed(5.499999999)).toBe('5.50');
  });

  it('format numbers short', () => {
    var undef;
    expect(utils.toRoundedStr(3.345, 2)).toBe('3.35');
    expect(utils.toRoundedStr(5.499999999, 0)).toBe('5');
    expect(utils.toRoundedStr(5.499999999, 1)).toBe('5.5');
    expect(utils.toRoundedStr(5.499999999, 3)).toBe('5.5');
    expect(utils.toRoundedStr(123.45, -2)).toBe('100');
    expect(utils.toRoundedStr(-0.001, 2)).toBe('0');
    expect(utils.toRoundedStr(-2.47, 1)).toBe('-2.5');
    expect(utils.toRoundedStr(-2.44, 1)).toBe('-2.4');

    expect(utils.toRoundedStr(undef, 2)).toBe('0');
    expect(utils.toRoundedStr(null, 2)).toBe('0');
    expect(utils.toRoundedStr('text', 2)).toBe('0');
  });

  it('merge date and time', () => {
    var result = utils.mergeInputTime('22:35', '2015-07-14');
    expect(result.hours()).toBe(22);
    expect(result.minutes()).toBe(35);
    expect(result.year()).toBe(2015);
    expect(result.format('MMM')).toBe('Jul');
    expect(result.date()).toBe(14);
  });

});
