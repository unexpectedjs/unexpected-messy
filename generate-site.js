/*global messy*/
var argv = require('minimist')(process.argv.slice(2));

messy = require('messy');
unexpected = require('unexpected').clone().installPlugin(require('./lib/unexpectedMessy'));

unexpected.installPlugin(require('./lib/unexpectedMessy'));
var generator = require('unexpected-documentation-site-generator');
argv.unexpected = unexpected;
generator(argv);
