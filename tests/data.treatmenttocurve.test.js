'use strict';

import { describe, it, expect } from 'vitest';

var fitTreatmentsToBGCurve = require('../lib/data/treatmenttocurve');

describe('Data', function ( ) {

  var now = Date.now();
  var before = now - (5 * 60 * 1000);
  var settings = require('../lib/settings')();

  it('update treatment display BGs', function() {
    var ddata = require('../lib/data/ddata')();
    ddata.sgvs = [{mgdl: 90, mills: before},{mgdl: 100, mills: now}];
    ddata.treatments = [
      {_id: 'someid_1', mills: before, glucose: 100, units: 'mgdl'} //with glucose and units
      , {_id: 'someid_2', mills: before, glucose: 5.5, units: 'mmol'} //with glucose and units
      , {_id: 'someid_3', mills: now - 120000, insulin: '1.00'} //without glucose, between sgvs
      , {_id: 'someid_4', mills: now + 60000, insulin: '1.00'} //without glucose, after sgvs
      , {_id: 'someid_5', mills: before - 120000, insulin: '1.00'} //without glucose, before sgvs
    ];
    fitTreatmentsToBGCurve(ddata, {
        settings: settings
      }
      , {
        language: require('../lib/language')()
      }
    );
    expect(ddata.treatments[0].mgdl).toBe(100);
    expect(ddata.treatments[1].mmol).toBe(5.5);
    expect(ddata.treatments[2].mgdl).toBe(95);
    expect(ddata.treatments[3].mgdl).toBe(100);
    expect(ddata.treatments[4].mgdl).toBe(90);
  });

});