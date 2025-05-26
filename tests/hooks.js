require('module-alias/register');
'use strict;'

const fs = require('fs');
const path = require('path');

function clearRequireCache () {
  Object.keys(require.cache).forEach(function(key) {
    delete require.cache[key];
  });
}

exports.mochaHooks = {
  beforeAll(done) {
    const cacheDir = path.resolve(__dirname, '../src/node_modules/.cache/_ns_cache');
    const randomStringFile = path.join(cacheDir, 'randomString');
    const dummyKey = 'testJWTRandomStringForNightscoutTests';

    try {
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      fs.writeFileSync(randomStringFile, dummyKey);
      console.log(`Successfully created dummy randomString file at ${randomStringFile}`);
    } catch (err) {
      console.error('Failed to create dummy randomString file:', err);
      // Optionally, fail the tests if this setup is critical
      // return done(err);
    }
    done();
  },
  afterEach (done) {
    clearRequireCache();
    done();
  }
};
