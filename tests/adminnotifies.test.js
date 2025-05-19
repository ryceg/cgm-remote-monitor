import { describe, it, expect, afterEach, vi, afterAll } from 'vitest';
import language from '../lib/language';

const ctx = {};

ctx.bus = {};
ctx.bus.on = function mockOn(channel, f) { };
ctx.settings = {};
ctx.settings.adminNotifiesEnabled = true;

const mockJqueryResults = {};
const mockButton = {};

mockButton.click = function() {};
mockButton.css = function() {};
mockButton.show = function() {};

const mockDrawer = {};

const mockJQuery = function mockJquery(p) {
    if (p == '#adminnotifies') return mockButton;
    if (p == '#adminNotifiesDrawer') return mockDrawer;
    return mockJqueryResults;
};

const mockClient = {};

mockClient.translate = language.translate;
mockClient.headers = function () {return {};}

const adminnotifies = require('../lib/adminnotifies')(ctx);

// global.window = window;
// window.setTimeout = function () { return; }
vi.stubGlobal('window', { setTimeout: () => {} });


describe('adminnotifies', () => {

    afterAll(() => {
        vi.unstubAllGlobals();
    });

    it('should aggregate a message', () => {

        const notify = {
            title: 'Foo'
            , message: 'Bar'
        };

        adminnotifies.addNotify(notify);
        adminnotifies.addNotify(notify);

        const notifies = adminnotifies.getNotifies();

        expect(notifies.length).toBe(1);
      });

      /*
      it('should display a message', function (done) {

        const notify2 = {
            title: 'FooFoo'
            , message: 'BarBar'
        };

        adminnotifies.addNotify(notify2);
        adminnotifies.addNotify(notify2);

        const notifies = adminnotifies.getNotifies();

        mockJQuery.ajax = function mockAjax() {

            const rVal = notifies;

            rVal.done = function(callback) {
                callback({
                    message: {
                        notifies,
                        notifyCount: notifies.length
                        }
                    });
                return rVal;
            }

            rVal.fail = function() {};

            return rVal;
        }

        const adminnotifiesClient = require('../lib/client/adminnotifiesclient')(mockClient,mockJQuery);

        mockDrawer.html = function (html) {
            console.log(html);
            expect(html.indexOf('You have administration messages')).toBeGreaterThan(0);
            expect(html.indexOf('Event repeated 2 times')).toBeGreaterThan(0);
            done();
        }

        adminnotifiesClient.prepare();

      });
*/

});