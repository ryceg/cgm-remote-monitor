import { describe, it, expect, vi, beforeEach } from 'vitest';
import _ from 'lodash'; // Assuming lodash is a dependency
// const helper = require('./inithelper')(); // This might need adjustment if inithelper has side effects or needs mocking

// Mock helper and its context if it's simple, otherwise, it might need a more complex setup
const mockCtx = {
  settings: null, // Will be set below
  // Add other properties from helper.ctx if used by the iob plugin
};

// Mocking require for settings and profilefunctions for now
// If these have complex logic or side effects, they might need more specific mocks
vi.mock('../lib/settings', () => () => ({
  // Provide mock settings if needed by the iob plugin directly
  // For example, if iob plugin accesses ctx.settings.someValue
}));

vi.mock('../lib/profilefunctions', () => (profileData, _ctx) => { // Renamed ctx to _ctx to indicate it's unused
  // Mock implementation of profilefunctions
  // This is a simplified mock. If the actual function is complex, this will need to be more detailed.
  return {
    dia: profileData && profileData[0] ? profileData[0].dia : 3, // Default DIA if not provided
    sens: profileData && profileData[0] ? profileData[0].sens : 0,
    // Add other profile properties if needed by iob.calcTotal
  };
});

// Mock the iob plugin itself to control its behavior if direct testing is too complex,
// or ensure its dependencies are correctly mocked.
// For this conversion, we'll assume direct testing of the iob plugin is intended.

describe('IOB', () => {
  let iob;
  let ctx = mockCtx; // Use the mocked context

  beforeEach(() => {
    // Resetting process.env variables or other global state might be needed here if tests interfere
    ctx.settings = require('../lib/settings')(); // Load (mocked) settings
    iob = require('../lib/plugins/iob')(ctx); // Load the actual iob plugin with mocked context
  });

  it('should handle virtAsst requests', () => {
    return new Promise((done) => {
      const sbx = {
        properties: {
          iob: {
            iob: 1.5
          }
        }
      };

      expect(iob.virtAsst.intentHandlers.length).toBe(1);
      expect(iob.virtAsst.rollupHandlers.length).toBe(1);

      iob.virtAsst.intentHandlers[0].intentHandler(function next(title, response) {
        expect(title).toBe('Current IOB');
        expect(response).toBe('You have 1.50 units of insulin on board');

        iob.virtAsst.rollupHandlers[0].rollupHandler([], sbx, function callback (err, rollupResponse) {
          expect(err).toBeUndefined();
          expect(rollupResponse.results).toBe('and you have 1.50 units of insulin on board.');
          expect(rollupResponse.priority).toBe(2);
          done();
        });
      }, [], sbx);
    });
  });

  describe('from treatments', () => {
    it('should calculate IOB', () => {
      const time = Date.now();
      const treatments = [
        {
          mills: time - 1,
          insulin: '1.00'
        }
      ];

      const profileData = {
        dia: 3,
        sens: 0
      };

      const profile = require('../lib/profilefunctions')([profileData], ctx);
      const rightAfterBolus = iob.calcTotal(treatments, [], profile, time);
      expect(rightAfterBolus.display).toBe('1.00');

      const afterSomeTime = iob.calcTotal(treatments, [], profile, time + (60 * 60 * 1000));
      expect(afterSomeTime.iob).toBeLessThan(1);
      expect(afterSomeTime.iob).toBeGreaterThan(0);

      const afterDIA = iob.calcTotal(treatments, [], profile, time + (3 * 60 * 60 * 1000));
      expect(afterDIA.iob).toBe(0);
    });

    it('should calculate IOB using defaults', () => {
      const treatments = [{
        mills: Date.now() - 1,
        insulin: '1.00'
      }];

      // When profile is undefined, calcTotal should use defaults
      const rightAfterBolus = iob.calcTotal(treatments, []);
      expect(rightAfterBolus.display).toBe('1.00');
    });

    it('should not show a negative IOB when approaching 0', () => {
      const time = Date.now() - 1;
      const treatments = [{
        mills: time,
        insulin: '5.00'
      }];

      // Profile is undefined, defaults will be used (dia: 3)
      const whenApproaching0 = iob.calcTotal(treatments, [], undefined, time + (3 * 60 * 60 * 1000) - (90 * 1000));
      expect(whenApproaching0.display).toBe('0.00');
    });

    it('should calculate IOB using a 4 hour duration', () => {
      const time = Date.now();
      const treatments = [
        {
          mills: time - 1,
          insulin: '1.00'
        }
      ];

      const profileData = {
        dia: 4,
        sens: 0
      };
      const profile = require('../lib/profilefunctions')([profileData], ctx);

      const rightAfterBolus = iob.calcTotal(treatments, [], profile, time);
      expect(rightAfterBolus.display).toBe('1.00');

      const afterSomeTime = iob.calcTotal(treatments, [], profile, time + (60 * 60 * 1000));
      expect(afterSomeTime.iob).toBeLessThan(1);
      expect(afterSomeTime.iob).toBeGreaterThan(0);

      const after3hDIA = iob.calcTotal(treatments, [], profile, time + (3 * 60 * 60 * 1000));
      expect(after3hDIA.iob).toBeGreaterThan(0);

      const after4hDIA = iob.calcTotal(treatments, [], profile, time + (4 * 60 * 60 * 1000));
      expect(after4hDIA.iob).toBe(0);
    });
  });

  describe('from devicestatus', () => {
    const time = Date.now();
    // Ensure profile is created within this scope or passed correctly
    // For simplicity, defining it here. Adjust if ctx or helper setup is different.
    const profile = require('../lib/profilefunctions')([{ dia: 3, sens: 0 }], ctx);
    const treatments = [{
      mills: time - 1,
      insulin: '3.00'
    }];
    const treatmentIOB = iob.fromTreatments(treatments, profile, time).iob;

    const OPENAPS_DEVICESTATUS = {
      device: 'openaps://pi1',
      openaps: {
        iob: {
           iob: 0.047,
           basaliob: -0.298,
           activity: 0.0147
         }
      }
    };

    it('should fall back to treatment data if no devicestatus data', () => {
      expect(iob.calcTotal(treatments, [], profile, time)).toEqual(expect.objectContaining({
        source: 'Care Portal',
        iob: treatmentIOB
      }));
    });

    it('should fall back to treatments if openaps devicestatus is present but empty', () => {
      const devicestatus = [{
        device: 'openaps://pi1',
        mills: time - 1,
        openaps: {}
      }];
      expect(iob.calcTotal(treatments, devicestatus, profile, time).iob).toBe(treatmentIOB);
    });

    it('should fall back to treatments if openaps devicestatus is present but too stale', () => {
      const devicestatus = [_.merge({}, OPENAPS_DEVICESTATUS, { mills: time - iob.RECENCY_THRESHOLD - 1, openaps: {iob: {timestamp: time - iob.RECENCY_THRESHOLD - 1} } })];
      expect(iob.calcTotal(treatments, devicestatus, profile, time)).toEqual(expect.objectContaining({
        source: 'Care Portal',
        iob: treatmentIOB
      }));
    });

    it('should return IOB data from openaps', () => {
      const devicestatus = [_.merge({}, OPENAPS_DEVICESTATUS, { mills: time - 1, openaps: {iob: {timestamp: time - 1} } })];
      expect(iob.calcTotal(treatments, devicestatus, profile, time)).toEqual(expect.objectContaining({
        iob: 0.047,
        basaliob: -0.298,
        activity: 0.0147,
        source: 'OpenAPS',
        device: 'openaps://pi1'
      }));
    });

    it('should not blow up with null IOB data from openaps', () => {
      const devicestatus = [_.merge({}, OPENAPS_DEVICESTATUS, { mills: time - 1, openaps: {iob: null } })];
      // Create a fresh profile for this specific test case if needed, or ensure the outer scope profile is appropriate
      const currentProfile = require('../lib/profilefunctions')([{ dia: 3, sens: 0 }], ctx);
      expect(iob.calcTotal(treatments, devicestatus, currentProfile, time)).toEqual(expect.objectContaining({
        source: 'Care Portal',
        display: '3.00' // This implies treatmentIOB is used and formatted
      }));
    });

    it('should return IOB data from openaps post AMA (an array)', () => {
      const devicestatus = [_.merge({}, OPENAPS_DEVICESTATUS, { mills: time - 1, openaps: {iob: [{
        iob: 0.047,
        basaliob: -0.298,
        activity: 0.0147,
        time: time - 1 // Assuming 'time' here refers to the timestamp of the IOB record
      }]}})];
      expect(iob.calcTotal(treatments, devicestatus, profile, time)).toEqual(expect.objectContaining({
        iob: 0.047,
        basaliob: -0.298,
        activity: 0.0147,
        source: 'OpenAPS',
        device: 'openaps://pi1'
      }));
    });

    it('should return IOB data from Loop', () => {
      const LOOP_DEVICESTATUS = {
        device: 'loop://iPhone',
        loop: {
          iob: {
            iob: 0.75
            // timestamp is implicitly needed by the logic in iob plugin for recency
          }
        }
      };
      // Ensure timestamp is recent for Loop data to be picked up
      const devicestatus = [_.merge({}, LOOP_DEVICESTATUS, { mills: time - 1, loop: {iob: {timestamp: time - 1, iob: 0.75} } })];
      expect(iob.calcTotal(treatments, devicestatus, profile, time)).toEqual(expect.objectContaining({
        iob: 0.75,
        source: 'Loop',
        device: 'loop://iPhone'
      }));
    });

    it('should return IOB data from openaps from multiple devices', () => {
      const devicestatus = [
        _.merge({}, OPENAPS_DEVICESTATUS, { mills: time - 1000, openaps: {iob: {timestamp: time - 1000, iob: 0.047, basaliob: -0.298, activity: 0.0147}} }),
        _.merge({}, OPENAPS_DEVICESTATUS, { mills: time - 1, openaps: {iob: {timestamp: time - 1, iob: 0.047, basaliob: -0.298, activity: 0.0147}} }), // Most recent
        _.merge({}, OPENAPS_DEVICESTATUS, { mills: time - 20000, openaps: {iob: {timestamp: time - 20000, iob: 0.047, basaliob: -0.298, activity: 0.0147}} })
      ];
      expect(iob.calcTotal(treatments, devicestatus, profile, time)).toEqual(expect.objectContaining({
        iob: 0.047,
        basaliob: -0.298,
        activity: 0.0147,
        source: 'OpenAPS',
        device: 'openaps://pi1' // Assumes device is consistent or taken from the most recent valid entry
      }));
    });

    it('should return IOB data from MiniMed Connect', () => {
      const devicestatus = [{
        device: 'connect://paradigm',
        mills: time - 1, // Ensure this is recent
        pump: { iob: { bolusiob: 0.87 } },
        connect: { sensorState: 'copacetic' } // Assuming this doesn't affect IOB directly but is part of the structure
      }];
      expect(iob.calcTotal(treatments, devicestatus, profile, time)).toEqual(expect.objectContaining({
        iob: 0.87,
        source: 'MM Connect',
        device: 'connect://paradigm'
      }));
    });
  });
});
