var messy = require('messy'),
    _ = require('underscore'),
    isRegExp = require('./isRegExp');

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
        if (isRegExp(value.body)) {
            expect(subject.body, 'to satisfy', value.body);
        } else {
            expect(subject.body, 'to equal', value.body);
        }
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
            return headers1.equals(headers2);
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
        },
        diff: function (actual, expected, output, diff, inspect) {
            function outputHeader(name, value) {
                return (
                    output
                        .text(messy.formatHeaderName(name) + ':', 'gray')
                        .text(' ')
                        .text(value, 'cyan')
                );
            }

            var remainingExpectedHeaders = expected.clone(),
                remainingActualHeaders = actual.clone();

            actual.getNames().forEach(function (headerName) {
                // First pass: Find exact matches
                var actualHeaderValues = actual.getAll(headerName),
                    i;
                for (i = 0 ; i < actualHeaderValues.length ; i += 1) {
                    var actualHeaderValue = actualHeaderValues[i];
                    if (remainingExpectedHeaders.remove(headerName, actualHeaderValue)) {
                        remainingActualHeaders.remove(headerName, actualHeaderValue);
                        outputHeader(headerName, actualHeaderValue).nl();
                    }
                }
                // Second pass: Find changed headers
                actualHeaderValues = remainingActualHeaders.getAll(headerName);
                if (actualHeaderValues) {
                    var foundExpectedValue = null;
                    for (i = 0 ; i < actualHeaderValues.length ; i += 1) {
                        outputHeader(headerName, actualHeaderValues[i]);
                        if (remainingExpectedHeaders.has(headerName)) {
                            var expectedHeaderValue = remainingExpectedHeaders.get(headerName);
                            output.sp().error('// should be: ').text(expectedHeaderValue).nl();
                            remainingExpectedHeaders.remove(headerName, expectedHeaderValue);
                        } else {
                            output.sp().error('// should be removed').nl();
                        }
                    }
                }
            });
            // All the headers remaining in remainingExpectedHeaders are missing:
            remainingExpectedHeaders.getNames().forEach(function (headerName) {
                remainingExpectedHeaders.getAll(headerName).forEach(function (headerValue) {
                    output.error('// missing: ');
                    outputHeader(headerName, headerValue).nl();
                });
            });
            return {
                diff: output
            };
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
        inspect: function inspectMessage(output, message, inspect) {
            if (message.headers.getNames().length > 0) {
                inspect(output, message.headers);
            }
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
        base: 'messy.Message',
        identify: function (obj) {
            return obj instanceof messy.HttpRequest;
        },
        equal: function (httpRequest1, httpRequest2) {
            return httpRequest1.equal(httpRequest2);
        },
        inspect: function (output, httpRequest, inspect) {
            inspect(output, httpRequest.requestLine);
            output.nl();
            this.baseType.inspect(output, httpRequest, inspect);
            return output;
        }
    }).addAssertion('messy.HttpRequest', 'to [exhaustively] satisfy', function (expect, subject, value) {
        expectMessageToSatisfy.call(this, expect, subject, value);
        if ('requestLine' in value) {
            expect(subject.requestLine, 'to [exhaustively] satisfy', value.requestLine);
        }
        // Make the RequestLine properties available for matching:
        expect(subject.requestLine, 'to [exhaustively] satisfy', _.pick(value, messy.RequestLine.propertyNames));
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
        base: 'messy.Message',
        equal: function (httpResponse1, httpResponse2) {
            return httpResponse1.equal(httpResponse2);
        },
        identify: function (obj) {
            return obj instanceof messy.HttpResponse;
        },
        inspect: function (output, httpResponse, inspect) {
            inspect(output, httpResponse.statusLine);
            output.nl();
            this.baseType.inspect(output, httpResponse, inspect);
            return output;
        }
    }).addAssertion('messy.HttpResponse', 'to [exhaustively] satisfy', function (expect, subject, value) {
        expectMessageToSatisfy.call(this, expect, subject, value);

        if ('statusLine' in value) {
            expect(subject.statusLine, 'to [exhaustively] satisfy', value.statusLine);
        }
        // Make the RequestLine properties available for matching:
        expect(subject.statusLine, 'to [exhaustively] satisfy', _.pick(value, messy.StatusLine.propertyNames));
    }).addType({
        name: 'messy.HttpExchange',
        equal: function (httpExchange1, httpExchange2) {
            return httpExchange1.equal(httpExchange2);
        },
        identify: function (obj) {
            return obj instanceof messy.HttpExchange;
        },
        inspect: function (output, httpExchange, inspect) {
            inspect(output, httpExchange.request);
            output.nl(2);
            inspect(output, httpExchange.response);
            return output;
        }
    }).addAssertion('messy.HttpExchange', 'to [exhaustively] satisfy', function (expect, subject, value) {
        if ('request' in value) {
            expect(subject.request, 'to [exhaustively] satisfy', value.request);
        } else {
            expect(this.flags.exhaustively, 'to be false');
        }
        if ('response' in value) {
            expect(subject.response, 'to [exhaustively] satisfy', value.response);
        } else {
            expect(this.flags.exhaustively, 'to be false');
        }
    }).addType({
        name: 'messy.HttpConversation',
        equal: function (httpConversation1, httpConversation2) {
            return httpConversation1.equal(httpConversation2);
        },
        identify: function (obj) {
            return obj instanceof messy.HttpConversation;
        },
        inspect: function (output, httpConversation, inspect) {
            httpConversation.exchanges.forEach(function (httpExchange, i) {
                if (i > 0) {
                    output.nl(2);
                }
                inspect(output, httpExchange);
            });
            return output;
        }
    }).addAssertion('messy.HttpConversation', 'to [exhaustively] satisfy', function (expect, subject, value) {
        expect(value, 'to be an object');
        expect(value.exchanges, 'to be an array');
        expect(subject.exchanges, 'to be an array whose items satisfy', function (httpExchange, i) {
            expect(httpExchange, 'to [exhaustively] satisfy', value.exchanges[i]);
        });
        expect(subject.exchanges.length, 'to equal', value.exchanges.length);
    });
};
