import { describe, it, expect } from 'vitest';

describe('bridge', () => {
  var bridge = require('../lib/plugins/bridge');

  var env = {
    extendedSettings: {
      bridge: {
        userName: 'nightscout'
        , password: 'wearenotwaiting'
        , interval: 60000
      }
    }
  };

  it('be creatable', () => {
    var configed = bridge(env);
    expect(configed).to.exist;
    expect(configed.startEngine).to.exist;
    expect(configed.startEngine.call).to.exist;
  });

  it('set options from env', () => {
    var opts = bridge.options(env);
    expect(opts).to.exist;

    expect(opts.login.accountName).to.equal('nightscout');
    expect(opts.login.password).to.equal('wearenotwaiting');
    expect(opts.interval).to.equal(60000);
  });

  it('store entries from share', (done) => {
    var mockEntries = {
      create: function mockCreate (err, callback) {
        callback(null);
        done();
      }
    };
    bridge.bridged(mockEntries)(null);
  });

  it('set too low bridge interval option from env', () => {
    var tooLowInterval = {
      extendedSettings: {
        bridge: { interval: 900 }
      }
    };

    var opts = bridge.options(tooLowInterval);
    expect(opts).to.exist;

    expect(opts.interval).to.equal(156000);
  });

  it('set too high bridge interval option from env', () => {
    var tooHighInterval = {
      extendedSettings: {
        bridge: { interval: 500000 }
      }
    };

    var opts = bridge.options(tooHighInterval);
    expect(opts).to.exist;

    expect(opts.interval).to.equal(156000);
  });

  it('set no bridge interval option from env', () => {
    var noInterval = {
      extendedSettings: {
        bridge: { }
      }
    };

    var opts = bridge.options(noInterval);
    expect(opts).to.exist;

    expect(opts.interval).to.equal(156000);
  });

});
