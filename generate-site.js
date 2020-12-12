/* global messy:true */
/* exported messy */
const argv = require('minimist')(process.argv.slice(2));

global.require = require;
messy = require('messy');
const unexpected = require('unexpected')
  .clone()
  .installPlugin(require('./lib/unexpectedMessy'));
const generator = require('unexpected-documentation-site-generator');
unexpected.output.preferredWidth = 80;
argv.unexpected = unexpected;
generator(argv);
