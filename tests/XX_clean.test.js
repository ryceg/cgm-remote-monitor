'use strict';

var language = require('../src/lib/language')();

describe('Clean MONGO after tests', function ( ) {
  this.timeout(10000);
  var self = this;

  var api = require('../src/lib/api/');
  beforeEach(function (done) {
    process.env.API_SECRET = 'this is my long pass phrase';
    self.env = require('../src/lib/server/env')();
    self.env.settings.authDefaultRoles = 'readable';
    self.env.settings.enable = ['careportal', 'api'];
    this.wares = require('../src/lib/middleware/')(self.env);
    self.app = require('express')();
    self.app.enable('api');
    require('../src/lib/server/bootevent')(self.env, language).boot(function booted(ctx) {
      self.ctx = ctx;
      self.ctx.ddata = require('../src/lib/data/ddata')();
      self.app.use('/api', api(self.env, ctx));
      done();
    });
  });

  it('wipe treatment data', function (done) {
    self.ctx.treatments().remove({ }, function ( ) {
        done();
    });
  });

  it('wipe entries data', function (done) {
    self.ctx.entries().remove({ }, function ( ) {
        done();
    });
  });

});
