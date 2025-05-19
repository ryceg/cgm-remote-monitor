import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import _ from 'lodash';
import benv from 'benv';
import { readFileSync } from 'fs';
import serverSettingsFromFile from './fixtures/default-server-settings';

var nowData = {
  sgvs: [
    { mgdl: 100, mills: Date.now(), direction: 'Flat', type: 'sgv' }
  ]
};

var someData = {
  '/api/v1/devicestatus.json?count=500': [
    {
    '_id': {
        '$oid': '56096da3c5d0fef41b212362'
    },
    'uploaderBattery': 37,
    'created_at': '2015-09-28T16:41:07.144Z'
    },
    {
    '_id': {
        '$oid': '56096da3c5d0fef41b212363'
    },
    'uploaderBattery': 38,
    'created_at': '2025-09-28T16:41:07.144Z'
    }
  ],
  '/api/v1/devicestatus/?find[created_at][$lte]=': {
    n: 1
  },
  '/api/v1/treatments.json?&find[created_at][$gte]=': [
      {
        '_id':  '5609a9203c8104a8195b1c1e',
        'enteredBy': '',
        'eventType': 'Carb Correction',
        'carbs': 3,
        'created_at': '2025-09-28T20:54:00.000Z'
      }
    ],
  '/api/v1/treatments/?find[created_at][$lte]=': {
    n: 1
  },
  '/api/v1/entries.json?&find[date][$gte]=': [
      {
        '_id': '560983f326c5a592d9b9ae0c',
        'device': 'dexcom',
        'date': 1543464149000,
        'sgv': 83,
        'direction': 'Flat',
        'type': 'sgv',
        'filtered': 107632,
        'unfiltered': 106256,
        'rssi': 178,
        'noise': 1
      }
    ],
  '/api/v1/entries/?find[date][$lte]=': {
    n: 1
  },
};


describe('admintools', () => {
  let self = {};
  // this.timeout(45000); // Vitest default timeout is 5000ms, can be configured in vitest.config.js if needed
  beforeAll(async () => {
    await new Promise(resolve => {
      benv.setup(() => {
        benv.require(__dirname + '/../node_modules/.cache/_ns_cache/public/js/bundle.app.js');
        self.$ = $;
        self.localCookieStorage = self.localStorage = self.$.localStorage = require('./fixtures/localstorage');

        self.$.fn.tooltip = function mockTooltip() { };

        self.$.fn.dialog = function mockDialog(opts) {
          function maybeCall (name, obj) {
            if (obj[name] && obj[name].call) {
              obj[name]();
            }

          }
          maybeCall('open', opts);

          _.forEach(opts.buttons, function (button) {
            maybeCall('click', button);
          });
        };

        var indexHtml = readFileSync(__dirname + '/../views/adminindex.html', 'utf8');
        self.$('body').html(indexHtml);

        //var filesys = require('fs');
        //var logfile = filesys.createWriteStream('out.txt', { flags: 'a'} )

        self.$.ajax = function mockAjax(url, opts) {
          if (url && url.url) {
            url = url.url;
          }
          //logfile.write(url+'\n');
          //console.log('Mock ajax:',url,opts);
          if (opts && opts.success && opts.success.call) {
            if (url.indexOf('/api/v1/treatments.json?&find[created_at][$gte]=')===0) {
              url = '/api/v1/treatments.json?&find[created_at][$gte]=';
            } else if (url.indexOf('/api/v1/entries.json?&find[date][$gte]=')===0) {
              url = '/api/v1/entries.json?&find[date][$gte]=';
            } else if (url.indexOf('/api/v1/devicestatus/?find[created_at][$lte]=')===0) {
              url = '/api/v1/devicestatus/?find[created_at][$lte]=';
            } else if (url.indexOf('/api/v1/treatments/?find[created_at][$lte]=')===0) {
              url = '/api/v1/treatments/?find[created_at][$lte]=';
            } else if (url.indexOf('/api/v1/entries/?find[date][$lte]=')===0) {
              url = '/api/v1/entries/?find[date][$lte]=';
            }
            return {
              done: function mockDone (fn) {
                  if (someData[url]) {
                    console.log('+++++Data for ' + url + ' sent');
                    opts.success(someData[url]);
                  } else {
                    console.log('-----Data for ' + url + ' missing');
                    opts.success([]);
                  }
                fn();
                return self.$.ajax();
              },
              fail: function mockFail () {
                return self.$.ajax();
              }
            };
          }
          return {
            done: function mockDone (fn) {
              if (url.indexOf('status.json') > -1) {
                fn(serverSettings);
              } else {
                fn({message: {message: 'OK'}});
              }
              return self.$.ajax();
              },
            fail: function mockFail () {
              return self.$.ajax();
              }
          };
        };

        self.$.plot = function mockPlot() {
        };

        var d3 = require('d3');
        //disable all d3 transitions so most of the other code can run with jsdom
        //d3.timer = function mockTimer() { };
        let timer = d3.timer(function mockTimer() { });
        timer.stop();

        var cookieStorageType = self.localStorage._type

        benv.expose({
          $: self.$,
          jQuery: self.$,
          d3: d3,
          serverSettings: serverSettingsFromFile,
          localCookieStorage: self.localStorage,
          cookieStorageType: self.localStorage,
          localStorage: self.localStorage,
          io: {
            connect: function mockConnect ( ) {
              return {
                on: function mockOn (event, callback) {
                  if ('connect' === event && callback) {
                    callback();
                  }
                }
                , emit: function mockEmit (event, data, callback) {
                  if ('authorize' === event && callback) {
                    callback({
                      read: true
                    });
                  }
                }
              };
            }
          }
        });

        //benv.require(__dirname + '/../bundle/bundle.source.js');
        benv.require(__dirname + '/../static/admin/js/admin.js');

        resolve();
        });
    });
  });

  afterAll(() => {
    benv.teardown(true);
  });

  it('should produce some html', () => {
    var client = require('../lib/client');

    var hashauth = require('../lib/client/hashauth');
    hashauth.init(client, $);
    hashauth.verifyAuthentication = function mockVerifyAuthentication(next) {
      hashauth.authenticated = true;
      next(true);
    };

    vi.stubGlobal('confirm', (text) => {
      console.log('Confirm:', text);
      return true;
    });

    vi.stubGlobal('alert', () => true);

    client.init();

    client.dataUpdate(nowData);

    //var result = $(\'body\').html();
    //var filesys = require(\'fs\');
    //var logfile = filesys.createWriteStream(\'out.txt\', { flags: \'a\'} )
    //logfile.write($(\'body\').html());

    //console.log(result);

    expect(self.$('#admin_cleanstatusdb_0_html + button').text()).toBe('Delete all documents'); // devicestatus button
    expect(self.$('#admin_cleanstatusdb_0_status').text()).toBe('Database contains 2 records'); // devicestatus init result

    self.$('#admin_cleanstatusdb_0_html + button').click();
    expect(self.$('#admin_cleanstatusdb_0_status').text()).toBe('All records removed ...'); // devicestatus code result

    expect(self.$('#admin_cleanstatusdb_1_html + button').text()).toBe('Delete old documents'); // devicestatus button
    expect(self.$('#admin_cleanstatusdb_1_status').text()).toBe(''); // devicestatus init result

    self.$('#admin_cleanstatusdb_1_html + button').click();
    expect(self.$('#admin_cleanstatusdb_1_status').text()).toBe('1 records deleted'); // devicestatus code result

    expect(self.$('#admin_futureitems_0_html + button').text()).toBe('Remove treatments in the future'); // futureitems button 0
    expect(self.$('#admin_futureitems_0_status').text()).toBe('Database contains 1 future records'); // futureitems init result 0

    self.$('#admin_futureitems_0_html + button').click();
    expect(self.$('#admin_futureitems_0_status').text()).toBe('Record 5609a9203c8104a8195b1c1e removed ...'); // futureitems code result 0

    expect(self.$('#admin_futureitems_1_html + button').text()).toBe('Remove entries in the future'); // futureitems button 1
    expect(self.$('#admin_futureitems_1_status').text()).toBe('Database contains 1 future records'); // futureitems init result 1

    self.$('#admin_futureitems_1_html + button').click();
    expect(self.$('#admin_futureitems_1_status').text()).toBe('Record 560983f326c5a592d9b9ae0c removed ...'); // futureitems code result 1

    expect(self.$('#admin_cleantreatmentsdb_0_html + button').text()).toBe('Delete old documents'); // treatments button
    expect(self.$('#admin_cleantreatmentsdb_0_status').text()).toBe(''); // treatments init result

    self.$('#admin_cleantreatmentsdb_0_html + button').click();
    expect(self.$('#admin_cleantreatmentsdb_0_status').text()).toBe('1 records deleted'); // treatments code result

    expect(self.$('#admin_cleanentriesdb_0_html + button').text()).toBe('Delete old documents'); // entries button
    expect(self.$('#admin_cleanentriesdb_0_status').text()).toBe(''); // entries init result

    self.$('#admin_cleanentriesdb_0_html + button').click();
    expect(self.$('#admin_cleanentriesdb_0_status').text()).toBe('1 records deleted'); // entries code result
  });

});
