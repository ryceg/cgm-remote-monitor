'use strict';

import { describe, it, expect } from 'vitest'; // Added import
import ddataFactory from '../lib/data/ddata.js';


describe('ddata', function ( ) {
  // var sandbox = require('../lib/sandbox')();
  // var env = require('../lib/server/env')();
  var ctx = {};
  ctx.ddata = ddataFactory(); // Changed from require

  it('should be a module', function () {
    const libddata = ddataFactory; // Changed from require
    var ddata = libddata( );
    expect(ddata).toBeDefined();
    expect(libddata).toBeDefined();
    expect(libddata.call).toBeDefined();
    ddata = ctx.ddata.clone( );
    expect(ddata).toBeDefined();
  });

  it('has #clone( )', function () {
    expect(ctx.ddata.treatments).toBeDefined();
    expect(ctx.ddata.sgvs).toBeDefined();
    expect(ctx.ddata.mbgs).toBeDefined();
    expect(ctx.ddata.cals).toBeDefined();
    expect(ctx.ddata.profiles).toBeDefined();
    expect(ctx.ddata.devicestatus).toBeDefined();
    expect(ctx.ddata.lastUpdated).toBeDefined();
    var ddata = ctx.ddata.clone( );
    expect(ddata).toBeDefined();
    expect(ddata.treatments).toBeDefined();
    expect(ddata.sgvs).toBeDefined();
    expect(ddata.mbgs).toBeDefined();
    expect(ddata.cals).toBeDefined();
    expect(ddata.profiles).toBeDefined();
    expect(ddata.devicestatus).toBeDefined();
    expect(ddata.lastUpdated).toBeDefined();
  });

  // TODO: ensure partition function gets called via:
  // Properties
  // * ddata.devicestatus
  // * ddata.mbgs
  // * ddata.sgvs
  // * ddata.treatments
  // * ddata.profiles
  // * ddata.lastUpdated
  // Methods
  // * ddata.processTreatments
  // * ddata.processDurations
  // * ddata.clone
  // * ddata.split


});

