import request from 'supertest';
import load from './fixtures/load';
import bootevent from '../lib/server/bootevent';
import lang from '../lib/language'; // Renamed to avoid conflict
import _ from 'lodash';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

const FIVE_MINUTES = 1000 * 60 * 5;

describe('Entries REST api', () => {
  const entries = require('../lib/api/entries/');
  let self = {}; // Changed from this to self, and initialize as object
  const known = 'b723e97aa97846eb92d5264f084b2823f57c4aa1';

  // this.timeout(10000); // Vitest default timeout is 5000ms

  beforeAll(async () => { // Changed from before to beforeAll and made async
    delete process.env.API_SECRET;
    process.env.API_SECRET = 'this is my long pass phrase';
    self.env = require('../lib/server/env')();
    self.env.settings.authDefaultRoles = 'readable';
    self.wares = require('../lib/middleware/')(self.env);
    self.archive = null;
    self.app = require('express')();
    self.app.enable('api');
    await new Promise(resolve => {
      bootevent(self.env, lang()).boot(function booted(ctx) {
        self.app.use('/', entries(self.app, self.wares, ctx, self.env));
        self.archive = require('../lib/server/entries')(self.env, ctx);
        self.ctx = ctx;
        resolve();
      });
    });
  });

  beforeEach(async () => { // Made async
    let creating = load('json');

    for (let i = 0; i < 20; i++) {
      const e = { type: 'sgv', sgv: 100, date: Date.now() };
      e.date = e.date - FIVE_MINUTES * i;
      creating.push(e);
    }

    creating = _.sortBy(creating, function (item) {
      return item.date;
    });

    await new Promise(resolve => {
      // wait for event processing of cache entries to actually finish
      // Using a short timeout, but ideally this would be a more robust mechanism if possible
      self.archive.create(creating, () => setTimeout(resolve, 100));
    });
  });

  afterEach(async () => { // Made async
    await new Promise(resolve => self.archive().remove({}, resolve));
  });

  afterAll(async () => { // Changed from after to afterAll and made async
    await new Promise(resolve => self.archive().remove({}, resolve));
  });

  // keep this test pinned at or near the top in order to validate all
  // entries successfully uploaded. if res.body.length is short of the
  // expected value, it may indicate a regression in the create
  // function callback logic in entries.js.
  it('gets requested number of entries', async () => { // Made async
    var count = 30;
    const res = await request(self.app)
      .get('/entries.json?find[dateString][$gte]=2014-07-19&count=' + count)
      .expect(200);
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBe(count);
  });

  it('gets default number of entries', async () => { // Made async
    var defaultCount = 10;
    const res = await request(self.app)
      .get('/entries/sgv.json?find[dateString][$gte]=2014-07-19&find[dateString][$lte]=2014-07-20')
      .expect(200);
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBe(defaultCount);
  });

  it('gets entries in right order', async () => { // Made async
    var defaultCount = 10;
    const res = await request(self.app)
      .get('/entries/sgv.json?find[dateString][$gte]=2014-07-19&find[dateString][$lte]=2014-07-20')
      .expect(200);
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBe(defaultCount);

    var array = res.body;
    var firstEntry = array[0];
    var secondEntry = array[1];

    expect(firstEntry.date).toBeGreaterThan(secondEntry.date);
  });

  it('gets entries in right order without type specifier', async () => { // Made async
    var defaultCount = 10;
    const res = await request(self.app)
      .get('/entries.json')
      .expect(200);
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBe(defaultCount);

    var array = res.body;
    var firstEntry = array[0];
    var secondEntry = array[1];

    expect(firstEntry.date).toBeGreaterThan(secondEntry.date);
  });

  it('/echo/ api shows query', async () => { // Made async
    const res = await request(self.app)
      .get('/echo/entries/sgv.json?find[dateString][$gte]=2014-07-19&find[dateString][$lte]=2014-07-20')
      .expect(200);
    expect(res.body).toBeInstanceOf(Object);
    expect(res.body.query).toBeInstanceOf(Object);
    expect(res.body.input).toBeInstanceOf(Object);
    expect(res.body.input.find).toBeInstanceOf(Object);
    expect(res.body.storage).toBe('entries');
  });

  it('/slice/ can slice time', async () => { // Made async
    var app = self.app;
    const res = await request(app)
      .get('/slice/entries/dateString/sgv/2014-07.json?count=20')
      .expect(200);
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBe(20);
  });


  it('/times/echo can describe query', async () => { // Made async
    var app = self.app;
    const res = await request(app)
      .get('/times/echo/2014-07/.*T{00..05}:.json?count=20&find[sgv][$gte]=160')
      .expect(200);
    expect(res.body).toBeInstanceOf(Object);
    expect(res.body.req).toHaveProperty('query');
    expect(res.body).toHaveProperty('pattern');
    expect(res.body.pattern.length).toBe(6);
  });

  it('/slice/ can slice with multiple prefix', async () => { // Made async
    var app = self.app;
    const res = await request(app)
      .get('/slice/entries/dateString/sgv/2014-07-{17..20}.json?count=20')
      .expect(200);
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBe(20);
  });

  it('/slice/ can slice time with prefix and no results', async () => { // Made async
    var app = self.app;
    const res = await request(app)
      .get('/slice/entries/dateString/sgv/1999-07.json?count=20&find[sgv][$lte]=401')
      .expect(200);
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBe(0);
  });

  it('/times/ can get modal times', async () => { // Made async
    var app = self.app;
    const res = await request(app)
      .get('/times/2014-07-/{0..30}T.json?')
      .expect(200);
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBe(10);
  });

  it('/times/ can get modal minutes and times', async () => { // Made async
    var app = self.app;
    const res = await request(app)
      .get('/times/20{14..15}-07/T{09..10}.json?')
      .expect(200);
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBe(10);
  });
  it('/times/ can get multiple prefixen and modal minutes and times', async () => { // Made async
    var app = self.app;
    const res = await request(app)
      .get('/times/20{14..15}/T.*:{00..60}.json?')
      .expect(200);
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBe(10);
  });

  it('/entries/current.json', async () => { // Made async
    const res = await request(self.app)
      .get('/entries/current.json')
      .expect(200);
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBe(1);
    expect(res.body[0].sgv).toBe(100);
  });

  it('/entries/:id', async () => { // Made async
    var app = self.app;
    const records = await new Promise((resolve, reject) => {
      self.archive.list({ count: 1 }, (err, recs) => {
        if (err) return reject(err);
        resolve(recs);
      });
    });
    var currentId = records.pop()._id.toString();
    const res = await request(app)
      .get('/entries/' + currentId + '.json')
      .expect(200);
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBe(1);
    expect(res.body[0]._id).toBe(currentId);
  });

  it('/entries/:model', async () => { // Made async
    var app = self.app;
    const res = await request(app)
      .get('/entries/sgv/.json?count=10&find[dateString][$gte]=2014')
      .expect(200);
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBe(10);
  });

  it('disallow POST by readable /entries/preview', async () => { // Made async
    await request(self.app)
      .post('/entries/preview.json')
      .send(load('json'))
      .expect(401);
    // res.body.should.be.instanceof(Array).and.have.lengthOf(30); // This was commented out
  });

  it('disallow deletes unauthorized', async () => { // Made async
    var app = self.app;

    await request(app)
      .delete('/entries/sgv?find[dateString][$gte]=2014-07-19&find[dateString][$lte]=2014-07-20')
      .expect(401);

    const res = await request(app)
      .get('/entries/sgv.json?find[dateString][$gte]=2014-07-19&find[dateString][$lte]=2014-07-20')
      .expect(200);
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBe(10);
  });

  it('post an entry, query, delete, verify gone', async () => { // Made async
    // insert a glucose entry - needs to be unique from example data
    console.log('Inserting glucose entry')
    await request(self.app)
      .post('/entries/')
      .set('api-secret', known || '')
      .send({
        "type": "sgv", "sgv": "199", "dateString": "2014-07-20T00:44:15.000-07:00"
        , "date": 1405791855000, "device": "dexcom", "direction": "NOT COMPUTABLE"
      })
      .expect(200);

    // make sure treatment was inserted successfully
    console.log('Ensuring glucose entry was inserted successfully');
    const getResponse = await request(self.app)
      .get('/entries.json?find[dateString][$gte]=2014-07-20&count=100')
      .set('api-secret', known || '')
      .expect(200);

    var entry = getResponse.body[0];
    expect(entry.sgv).toBe('199');
    expect(entry.utcOffset).toBe(-420);

    // delete the glucose entry
    console.log('Deleting test glucose entry');
    await request(self.app)
      .delete('/entries.json?find[dateString][$gte]=2014-07-20&count=100')
      .set('api-secret', known || '')
      .expect(200);

    // make sure it was deleted
    console.log('Testing if glucose entry was deleted');
    const finalGetResponse = await request(self.app)
      .get('/entries.json?find[dateString][$gte]=2014-07-20&count=100')
      .set('api-secret', known || '')
      .expect(200);
    expect(finalGetResponse.body.length).toBe(0);
  });

  it('post multiple entries, query, delete, verify gone', async () => { // Made async
    // insert a glucose entry - needs to be unique from example data
    console.log('Inserting glucose entry')
    await request(self.app)
      .post('/entries/')
      .set('api-secret', known || '')
      .send([{
        "type": "sgv", "sgv": "199", "dateString": "2014-07-20T00:44:15.000-07:00"
        , "date": 1405791855000, "device": "dexcom", "direction": "NOT COMPUTABLE"
      }, {
        "type": "sgv", "sgv": "200", "dateString": "2014-07-20T00:44:15.001-07:00"
        , "date": 1405791855001, "device": "dexcom", "direction": "NOT COMPUTABLE"
      }])
      .expect(200);

    // make sure treatment was inserted successfully
    console.log('Ensuring glucose entry was inserted successfully');
    const getResponse = await request(self.app)
      .get('/entries.json?find[dateString][$gte]=2014-07-20&count=100')
      .set('api-secret', known || '')
      .expect(200);

    var entry = getResponse.body[0];
    expect(getResponse.body.length).toBe(2);
    expect(entry.sgv).toBe('200');
    expect(entry.utcOffset).toBe(-420);

    // delete the glucose entry
    console.log('Deleting test glucose entry');
    await request(self.app)
      .delete('/entries.json?find[dateString][$gte]=2014-07-20&count=100')
      .set('api-secret', known || '')
      .expect(200);

    // make sure it was deleted
    console.log('Testing if glucose entries were deleted');
    const finalGetResponse = await request(self.app)
      .get('/entries.json?find[dateString][$gte]=2014-07-20&count=100')
      .set('api-secret', known || '')
      .expect(200);
    expect(finalGetResponse.body.length).toBe(0);
  });

});
