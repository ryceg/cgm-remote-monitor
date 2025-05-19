import { describe, it, expect, beforeEach, afterEach } from 'vitest';
const benv = require('benv');
const helper = require('../lib/test-helper'); // Added this line

describe('careportal', function() {
  let env_vars = {};
  let cp;
  let sbx;
  let hashauth;

  beforeEach(async () => { // Changed to async function
    await new Promise(resolve => { // Wrapped benv.setup in a Promise
      benv.setup(function() {
        benv.expose({
          $: require('jquery'),
          jQuery: require('jquery'),
          document: benv.document,
          window: benv.window,
          navigator: benv.navigator
        });
        window.localStorage = {};
        window.localStorage.setItem = function(key, value) {
          window.localStorage[key] = value;
        };
        window.localStorage.getItem = function(key) {
          return window.localStorage[key];
        };
        window.localStorage.removeItem = function(key) {
          delete window.localStorage[key];
        };

        env_vars = {
          API_SECRET: 'testing',
          CAREPORTAL_ENABLED: 'true'
        };
        const env = require('../lib/server/env')(env_vars);
        const ctx = helper.getctx();
        ctx.env = env;
        ctx.settings = {};
        ctx.profile = {};
        ctx.store = {};
        ctx.ddata = require('../lib/data/ddata')();
        ctx.notifications = require('../lib/notifications')(env, ctx);
        ctx.plugins = helper.getPlugins();
        cp = require('../lib/plugins/careportal')(ctx);
        sbx = require('../lib/sandbox')(ctx).clientInit(ctx, Date.now(), {});
        hashauth = require('../lib/client/hashauth')(ctx);
        resolve(); // Resolve the promise after setup
      });
    });
  });

  afterEach(function() {
    benv.teardown();
  });

  it('should be enabled', function() {
    expect(cp.isEnabled()).toBe(true); // Changed to.toBe()
  });

  it('should not be enabled if CAREPORTAL_ENABLED is false', async () => { // Changed to async function
    const env_vars_disabled = {
      API_SECRET: 'testing',
      CAREPORTAL_ENABLED: 'false'
    };
    const env_disabled = require('../lib/server/env')(env_vars_disabled);
    const ctx_disabled = helper.getctx();
    ctx_disabled.env = env_disabled;
    const cp_disabled = require('../lib/plugins/careportal')(ctx_disabled);
    expect(cp_disabled.isEnabled()).toBe(false); // Changed to.toBe()
  });


  it('should store API_SECRET in localStorage', function() {
    const api_secret = 'testsecret';
    cp.storeApiSecret(api_secret);
    expect(window.localStorage.getItem('API_SECRET')).toBe(api_secret); // Changed to.toBe()
  });

  it('should read API_SECRET from localStorage', function() {
    const api_secret = 'testsecret';
    window.localStorage.setItem('API_SECRET', api_secret);
    expect(cp.readApiSecret()).toBe(api_secret); // Changed to.toBe()
  });

  it('should remove API_SECRET from localStorage', function() {
    const api_secret = 'testsecret';
    window.localStorage.setItem('API_SECRET', api_secret);
    cp.removeApiSecret();
    expect(window.localStorage.getItem('API_SECRET')).toBeUndefined(); // Changed to.toBeUndefined()
  });

  it('should return true if API_SECRET is stored', function() {
    const api_secret = 'testsecret';
    window.localStorage.setItem('API_SECRET', api_secret);
    expect(cp.isSecretStored()).toBe(true); // Changed to.toBe()
  });

  it('should return false if API_SECRET is not stored', function() {
    expect(cp.isSecretStored()).toBe(false); // Changed to.toBe()
  });

  it('should generate a valid token', function() {
    const api_secret = 'testsecret';
    cp.storeApiSecret(api_secret);
    const token = cp.getToken();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
    // Further validation would require knowing the token generation logic
    // For now, just check if it's a non-empty string
  });


  it('should add careportal button to header', function() {
    cp.addCareportalButton(sbx);
    const button = sbx.plugins.layout.getHeader().find('#careportal');
    expect(button.length).toBe(1); // Changed to.toBe()
    expect(button.text()).toBe('CP'); // Changed to.toBe()
  });

  describe('handleUpdate', function() {
    it('should call hashauth.update if API_SECRET is stored', async () => { // Changed to async function
      const api_secret = 'testsecret';
      cp.storeApiSecret(api_secret);
      let updateCalled = false;
      hashauth.update = function() {
        updateCalled = true;
      };
      await cp.handleUpdate(sbx, hashauth); // Added await
      expect(updateCalled).toBe(true); // Changed to.toBe()
    });

    it('should not call hashauth.update if API_SECRET is not stored', function() {
      let updateCalled = false;
      hashauth.update = function() {
        updateCalled = true;
      };
      cp.handleUpdate(sbx, hashauth);
      expect(updateCalled).toBe(false); // Changed to.toBe()
    });
  });

  describe('getSettingsPanes', function() {
    it('should return settings pane if API_SECRET is stored', function() {
      const api_secret = 'testsecret';
      cp.storeApiSecret(api_secret);
      const panes = cp.getSettingsPanes(sbx);
      expect(panes.length).toBe(1); // Changed to.toBe()
      expect(panes[0].title).toBe('Careportal'); // Changed to.toBe()
      // More detailed checks on pane content can be added here
    });

    it('should return empty array if API_SECRET is not stored', function() {
      const panes = cp.getSettingsPanes(sbx);
      expect(panes.length).toBe(0); // Changed to.toBe()
    });
  });

  // This test requires a running server or a mock of the fetch API
  // For now, we'll just check that the function exists
  it('should have a function to fetch remote data', function() {
    expect(typeof cp.fetchCareportalData).toBe('function');
  });


  // Example of how a fetch test might look with a mock
  // This is commented out as it requires more setup (e.g., nock or fetch-mock)
  /*
  it('should fetch remote data successfully', async () => { // Changed to async function
    const api_secret = 'testsecret';
    cp.storeApiSecret(api_secret);
    const mockData = { data: 'test' };

    // Mocking global fetch
    global.fetch = function(url, options) {
      return Promise.resolve({
        ok: true,
        json: function() { return Promise.resolve(mockData); }
      });
    };

    await new Promise(resolve => { // Wrapped in a Promise
      cp.fetchCareportalData(function(err, data) {
        expect(err).toBeNull(); // Changed to.toBeNull()
        expect(data).toEqual(mockData); // Changed to.toEqual() for deep equality
        delete global.fetch; // Clean up mock
        resolve(); // Resolve the promise
      });
    });
  });
  */

  it('should correctly identify Nightscout site', function() {
    const nsSite = 'https://my-nightscout-site.herokuapp.com';
    const notNsSite = 'https://example.com';
    expect(cp.isNightscoutSite(nsSite)).toBe(true); // Changed to.toBe()
    expect(cp.isNightscoutSite(notNsSite)).toBe(false); // Changed to.toBe()
  });

  it('should correctly identify if on Nightscout site', async () => { // Changed to async function
    // benv creates a jsdom environment, window.location.origin will be 'null' or similar
    // We need to mock it for this test
    const originalLocation = window.location;
    delete window.location;
    window.location = { origin: 'https://my-nightscout-site.herokuapp.com' };

    expect(cp.isOnNightscoutSite()).toBe(true); // Changed to.toBe()

    window.location = { origin: 'https://example.com' };
    expect(cp.isOnNightscoutSite()).toBe(false); // Changed to.toBe()

    window.location = originalLocation; // Restore original location
  });


  it('should have headless browser fixtures', function() {
    const fixtures = require('./fixtures/headless');
    expect(typeof fixtures).toBe('object');
    expect(typeof fixtures.settings).toBe('object');
    expect(typeof fixtures.profile).toBe('object');
    expect(Array.isArray(fixtures.treatments)).toBe(true);
    expect(Array.isArray(fixtures.devicestatus)).toBe(true);
    expect(Array.isArray(fixtures.entries)).toBe(true);
  });

});
