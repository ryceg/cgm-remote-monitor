import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import lang from '../lib/language';

describe('Devicestatus API', () => {
  // this.timeout(10000); // Vitest default timeout is 5000ms, can be configured in vitest.config.js if needed
  let self = {}; // Changed from this to self, and initialize as object
  const known = 'b723e97aa97846eb92d5264f084b2823f57c4aa1';

  const api = require('../lib/api/');
  beforeEach(async () => { // Made async
    process.env.API_SECRET = 'this is my long pass phrase';
    self.env = require('../lib/server/env')();
    self.env.settings.authDefaultRoles = 'readable';
    self.env.settings.enable = ['careportal', 'api'];
    self.wares = require('../lib/middleware/')(self.env); // Corrected: this.wares to self.wares
    self.app = require('express')();
    self.app.enable('api');
    await new Promise(resolve => { // Added promise for async boot
      require('../lib/server/bootevent')(self.env, lang()).boot(function booted(ctx) {
        self.ctx = ctx;
        self.ctx.ddata = require('../lib/data/ddata')();
        self.app.use('/api', api(self.env, ctx));
        resolve(); // Resolve promise after boot
      });
    });
  });

  it('post a devicestatus, query, delete, verify gone', async () => { // Made async, removed done
    // insert a devicestatus - needs to be unique from example data
    console.log('Inserting devicestatus entry');
    await request(self.app)
      .post('/api/devicestatus/')
      .set('api-secret', known || '')
      .send({
        device: 'xdripjs://rigName'
        , xdripjs: {
          state: 6
          , stateString: 'OK'
          , txStatus: 0
          , txStatusString: 'OK'
        }
        , created_at: '2018-12-16T01:00:52Z'
      })
      .expect(200);

    // make sure devicestatus was inserted successfully
    console.log('Ensuring devicestatus entry was inserted successfully');
    const getResponse = await request(self.app)
      .get('/api/devicestatus/')
      .query('find[created_at][$gte]=2018-12-16')
      .query('find[created_at][$lte]=2018-12-17')
      .set('api-secret', known || '')
      .expect(200);

    console.log(JSON.stringify(getResponse.body[0]));
    expect(getResponse.body[0].xdripjs.state).toBe(6);
    expect(getResponse.body[0].utcOffset).toBe(0);

    // delete the treatment
    console.log('Deleting test treatment entry');
    await request(self.app)
      .delete('/api/devicestatus/')
      .query('find[created_at][$gte]=2018-12-16')
      .set('api-secret', known || '')
      .expect(200);

    // make sure it was deleted
    console.log('Testing if devicestatus was deleted');
    const finalGetResponse = await request(self.app)
      .get('/api/devicestatus/')
      .query('find[created_at][$lte]=2018-12-16')
      .set('api-secret', known || '')
      .expect(200);
    expect(finalGetResponse.body.length).toBe(0);
  });
});
