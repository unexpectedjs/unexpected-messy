/*global messy:true, unexpected:true */
messy = require('messy');
unexpected = require('unexpected');
unexpected.output.preferredWidth = 80;
unexpected.use(require('./lib/unexpectedMessy'));
