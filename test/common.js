/*global messy:true, unexpected:true*/
messy = require('messy');
unexpected = require('unexpected').clone()
    .installPlugin(require('../lib/unexpectedMessy'));
