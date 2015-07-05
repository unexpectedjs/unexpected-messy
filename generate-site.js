/*global messy:true, global*/
var argv = require('minimist')(process.argv.slice(2));

global.require = require;
messy = require('messy');
var unexpected = require('unexpected').clone().installPlugin(require('./lib/unexpectedMessy'));
var generator = require('unexpected-documentation-site-generator');
argv.unexpected = unexpected;
generator(argv);
