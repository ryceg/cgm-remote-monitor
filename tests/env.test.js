import { describe, it, expect } from 'vitest';
import envFactory from '../lib/server/env';

describe('env', function () {
  it( 'show the right plugins', function () {
    process.env.SHOW_PLUGINS = 'iob';
    process.env.ENABLE = 'iob cob';

    var env = envFactory();
    var showPlugins = env.settings.showPlugins;
    expect(showPlugins).toContain( 'iob' );
    expect(showPlugins).toContain( 'delta' );
    expect(showPlugins).toContain( 'direction' );
    expect(showPlugins).toContain( 'upbat' );

    delete process.env.SHOW_PLUGINS;
    delete process.env.ENABLE;
  } );

  it( 'get extended settings', function () {
    process.env.ENABLE = 'scaryplugin';
    process.env.SCARYPLUGIN_DO_THING = 'yes';

    var env = envFactory();
    expect(env.settings.isEnabled( 'scaryplugin' )).toBe( true );

    //Note the camelCase
    expect(env.extendedSettings.scaryplugin.doThing).toBe( 'yes' );

    delete process.env.ENABLE;
    delete process.env.SCARYPLUGIN_DO_THING;
  } );

  it( 'add pushover to enable if one of the env vars is set', function () {
    process.env.PUSHOVER_API_TOKEN = 'abc12345';

    var env = envFactory();
    expect(env.settings.enable).toContain( 'pushover' );
    expect(env.extendedSettings.pushover.apiToken).toBe( 'abc12345' );

    delete process.env.PUSHOVER_API_TOKEN;
  } );

  it( 'add pushover to enable if one of the weird azure env vars is set', function () {
    process.env.CUSTOMCONNSTR_PUSHOVER_API_TOKEN = 'abc12345';

    var env = envFactory();
    expect(env.settings.enable).toContain( 'pushover' );
    expect(env.extendedSettings.pushover.apiToken).toBe( 'abc12345' );

    // This was delete process.env.PUSHOVER_API_TOKEN; in the original,
    // but should probably be delete process.env.CUSTOMCONNSTR_PUSHOVER_API_TOKEN;
    // However, sticking to minimal changes for now unless tests fail.
    // For safety, deleting the one that was set.
    delete process.env.CUSTOMCONNSTR_PUSHOVER_API_TOKEN;
  } );

  it( 'readENVTruthy ', function () {
    process.env.INSECURE_USE_HTTP = 'true';
    var env = envFactory();
    expect(env.insecureUseHttp).toBe(true);
    process.env.INSECURE_USE_HTTP = 'false';
    env = envFactory();
    expect(env.insecureUseHttp).toBe(false);
    process.env.INSECURE_USE_HTTP = 'not set ok, so use default value false';
    env = envFactory();
    expect(env.insecureUseHttp).toBe(false);
    delete process.env.INSECURE_USE_HTTP; // unset INSECURE_USE_HTTP
    process.env.SECURE_HSTS_HEADER = 'true';
    env = envFactory();
    expect(env.insecureUseHttp).toBe(false); // not defined should be false
    expect(env.secureHstsHeader).toBe(true);
    delete process.env.SECURE_HSTS_HEADER; // Clean up
  });

  describe( 'DISPLAY_UNITS', function () {
    const MMOL = 'mmol';
    const MGDL = 'mg/dl';
    describe ( 'mmol', function () {
      it( 'mmol => mmol', function () {
        process.env.DISPLAY_UNITS = MMOL;
        var env = envFactory();
        expect(env.settings.units).toBe( MMOL );
        delete process.env.DISPLAY_UNITS;
      } );

      it( 'mmol/l => mmol', function () {
        process.env.DISPLAY_UNITS = 'mmol/l';
        var env = envFactory();
        expect(env.settings.units).toBe( MMOL );
        delete process.env.DISPLAY_UNITS;
      } );

      it( 'mmol/L => mmol', function () {
        process.env.DISPLAY_UNITS = 'mmol/L';
        var env = envFactory();
        expect(env.settings.units).toBe( MMOL );
        delete process.env.DISPLAY_UNITS;
      } );

      it( 'MMOL => mmol', function () {
        process.env.DISPLAY_UNITS = 'MMOL';
        var env = envFactory();
        expect(env.settings.units).toBe( MMOL );
        delete process.env.DISPLAY_UNITS;
      } );
    } );

    describe ( 'mg/dl', function () {
      it( 'mg/dl => mg/dl', function () {
        process.env.DISPLAY_UNITS = MGDL;
        var env = envFactory();
        expect(env.settings.units).toBe( MGDL );
        delete process.env.DISPLAY_UNITS;
      } );

      it( 'mg/dL => mg/dl', function () {
        process.env.DISPLAY_UNITS = 'mg/dL';
        var env = envFactory();
        expect(env.settings.units).toBe( MGDL );
        delete process.env.DISPLAY_UNITS;
      } );

      it( 'MG/DL => mg/dl', function () {
        process.env.DISPLAY_UNITS = 'MG/DL';
        var env = envFactory();
        expect(env.settings.units).toBe( MGDL );
        delete process.env.DISPLAY_UNITS;
      } );

      it( 'mgdl => mg/dl', function () {
        process.env.DISPLAY_UNITS = 'mgdl';
        var env = envFactory();
        expect(env.settings.units).toBe( MGDL );
        delete process.env.DISPLAY_UNITS;
      } );
    } );

    describe ( 'default: mg/dl', function () {
      it( '<random> => mg/dl', function () {
        var random;
        // Keep MGDL check case-insensitive as original logic might imply it by context, though === is strict
        while (!random || random.toLowerCase() === MGDL.toLowerCase())
          random = [...Array(~~(Math.random()*20)+1)].map(()=>(~~(Math.random()*36)).toString(36)).join('');

        process.env.DISPLAY_UNITS = random;
        var env = envFactory();
        expect(env.settings.units).toBe( MGDL );
        delete process.env.DISPLAY_UNITS;
      } );

      it( '<null> => mg/dl', function () {
        // Ensure DISPLAY_UNITS is actually deleted if it exists from a previous test run state (though Vitest should isolate)
        if (process.env.DISPLAY_UNITS) {
          delete process.env.DISPLAY_UNITS;
        }
        var env = envFactory();
        expect(env.settings.units).toBe( MGDL );
        // delete process.env.DISPLAY_UNITS; // Already deleted or wasn't set
      } );
    } );
  } );
})
