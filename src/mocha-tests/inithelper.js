const fs = require("fs");
const dayjs = require("../lib/utils/dayjs");
const language = require("../lib/language")(fs);
const settings = require("../lib/settings")();
const levels = require("../lib/levels");

function helper() {  helper.ctx = {
    language: language,
    settings: settings,
    levels: levels,
    dayjs: dayjs,
    moment: dayjs,
  };

  helper.getctx = function getctx() {
    return helper.ctx;
  };

  return helper;
}

module.exports = helper;
