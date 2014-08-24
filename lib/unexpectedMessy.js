var messy = require('messy'),
    _ = require('underscore'),
    isRegExp = require('./isRegExp');

function inspectMessage(output, message, inspect) {
    inspect(output, message.headers);
    if (typeof message.body !== 'undefined') {
        output.nl();
        if (typeof message.body === 'string') {
            output.text(message.body);
        } else {
            // Buffer instance or parsed JSON
            inspect(output, message.body);
        }
    }
    return output;
}

function expectMessageToSatisfy(expect, subject, value) {
    if (typeof value === 'string') {
        value = new messy.Message(value);
    }
    if ('headers' in value) {
        expect(subject.headers, 'to [exhaustively] satisfy', value.headers);
    } else if (this.flags.exhaustive) {
        expect(subject.headers.getNames(), 'to be empty');
    }

    subject.upgradeOrDowngradeBodyToMatchSpec(value);
    if ('body' in value) {
        expect(subject.body, 'to satisfy', value.body);
    } else if (this.flags.exhaustive) {
        expect(subject.body, 'to be undefined');
    }
}

module.exports = function unexpectedMessy(expect) {
    expect.addType({
        name: 'messy.Headers',
        identify: function (obj) {
            return obj instanceof messy.Headers;
        },
        equal: function (headers1, headers2) {
            return headers1.equal(headers2);
        },
        inspect: function (output, headers, inspect) {
            headers.getNames().forEach(function (headerName) {
                headers.valuesByName[headerName].forEach(function (headerValue) {
                    output
                        .text(messy.formatHeaderName(headerName + ':'), 'gray')
                        .text(' ')
                        .text(headerValue, 'cyan')
                        .nl();
                });
            });
            return output;
        }
    }).addAssertion('messy.Headers', 'to [exhaustively] satisfy', function (expect, subject, value) {
        if (isRegExp(value)) {
            expect(subject.toString(), 'to match', value);
        } else {
            var exhaustively = this.flags.exhaustively;
            if (value && typeof value === 'object' && !(value instanceof messy.Headers)) {
                expect(value, 'to be a hash whose keys satisfy', function (headerName) {
                    expect(typeof value[headerName] !== 'undefined' || !subject.has(headerName), 'to be true');
                });
            }

            var expectedHeaders = value instanceof messy.Headers ? value : new messy.Headers(value, true),
                expectedHeaderNames = expectedHeaders.getNames();

            if (exhaustively) {
                expect(expectedHeaderNames.length, 'not to be less than', subject.getNames().length);
            }
            expect(expectedHeaderNames, 'to be an array whose items satisfy', function (expectedHeaderName) {
                var expectedValues = expectedHeaders.getAll(expectedHeaderName);
                if (exhaustively) {
                    expect(subject.getAll(expectedHeaderName).sort(), 'to equal', expectedValues.sort());
                } else {
                    expect(subject.has(expectedHeaderName, expectedValues), 'to be ok');
                }
            });
        }
    }).addType({
        name: 'messy.Message',
        identify: function (obj) {
            return obj instanceof messy.Message;
        },
        equal: function (message1, message2) {
            return message1.equal(message2);
        },
        inspect: inspectMessage
    }).addAssertion('messy.Message', 'to [exhaustively] satisfy', expectMessageToSatisfy)
    .addType({
        name: 'messy.RequestLine',
        identify: function (obj) {
            return obj instanceof messy.RequestLine;
        },
        equal: function (requestLine1, requestLine2) {
            return requestLine1.equal(requestLine2);
        },
        inspect: function (output, requestLine, inspect) {
            return (output
                .text(requestLine.method, 'blue')
                .text(' ')
                .text(requestLine.url, 'gray')
                .text(' ')
                .text(requestLine.protocolName, 'blue')
                .text('/')
                .text(requestLine.protocolVersion, 'cyan')
            );
        }
    }).addAssertion('messy.RequestLine', 'to [exhaustively] satisfy', function (expect, subject, value) {
        if (value && typeof value === 'object') {
            expect(_.pick(subject, messy.RequestLine.propertyNames), 'to [exhaustively] satisfy', value);
        } else {
            expect(subject.toString(), 'to [exhaustively] satisfy', value);
        }
    }).addType({
        name: 'messy.HttpRequest',
        identify: function (obj) {
            return obj instanceof messy.HttpRequest;
        },
        equal: function (httpRequest1, httpRequest2) {
            return httpRequest1.equal(httpRequest2);
        },
        inspect: function (output, httpRequest, inspect) {
            inspect(output, httpRequest.requestLine);
            output.nl();
            inspectMessage(output, httpRequest.headers, inspect);
            return output;
        }
    }).addAssertion('messy.HttpRequest', 'to [exhaustively] satisfy', function (expect, subject, value) {
        expectMessageToSatisfy.call(this, expect, subject, value);
        if ('requestLine' in value) {
            expect(subject.requestLine, 'to [exhaustively] satisfy', value.requestLine);
            // Make the RequestLine properties available for matching:
            expect(subject.requestLine, 'to [exhaustively] satisfy', _.pick(value, messy.RequestLine.propertyNames));
        }
    }).addType({
        name: 'messy.StatusLine',
        identify: function (obj) {
            return obj instanceof messy.StatusLine;
        },
        equal: function (statusLine1, statusLine2) {
            return statusLine1.equal(statusLine2);
        },
        inspect: function (output, statusLine, inspect) {
            return (output
                .text(statusLine.protocolName, 'blue')
                .text('/')
                .text(statusLine.protocolVersion, 'cyan')
                .text(' ')
                .text(statusLine.statusCode, 'cyan')
                .text(' ')
                .text(statusLine.statusMessage, 'yellow')
            );
        }
    }).addAssertion('messy.StatusLine', 'to [exhaustively] satisfy', function (expect, subject, value) {
        if (value && typeof value === 'object') {
            expect(_.pick(subject, messy.StatusLine.propertyNames), 'to [exhaustively] satisfy', value);
        } else {
            expect(subject.toString(), 'to [exhaustively] satisfy', value);
        }
    }).addType({
        name: 'messy.HttpResponse',
        equal: function (httpResponse1, httpResponse2) {
            return httpResponse1.equal(httpResponse2);
        },
        identify: function (obj) {
            return obj instanceof messy.HttpResponse;
        },
        inspect: function (output, httpResponse, inspect) {
            inspect(output, httpResponse.statusLine);
            output.nl();
            inspectMessage(output, httpResponse.headers, inspect);
            return output;
        }
    }).addAssertion('messy.HttpResponse', 'to [exhaustively] satisfy', function (expect, subject, value) {
        expectMessageToSatisfy.call(this, expect, subject, value);
        if ('statusLine' in value) {
            expect(subject.statusLine, 'to [exhaustively] satisfy', value.statusLine);
            // Make the RequestLine properties available for matching:
            expect(subject.statusLine, 'to [exhaustively] satisfy', _.pick(value, messy.StatusLine.propertyNames));
        }
    });
};
