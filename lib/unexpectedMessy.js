var messy = require('messy'),
    _ = require('underscore'),
    isRegExp = require('./isRegExp'),
    statusMessageByStatusCode = {
        100: 'Continue',
        101: 'Switching Protocols',
        102: 'Processing',
        200: 'OK',
        201: 'Created',
        202: 'Accepted',
        203: 'Non-Authoritative Information',
        204: 'No Content',
        205: 'Reset Content',
        206: 'Partial Content',
        207: 'Multi-Status',
        300: 'Multiple Choices',
        301: 'Moved Permanently',
        302: 'Moved Temporarily',
        303: 'See Other',
        304: 'Not Modified',
        305: 'Use Proxy',
        307: 'Temporary Redirect',
        400: 'Bad Request',
        401: 'Unauthorized',
        402: 'Payment Required',
        403: 'Forbidden',
        404: 'Not Found',
        405: 'Method Not Allowed',
        406: 'Not Acceptable',
        407: 'Proxy Authentication Required',
        408: 'Request Time-out',
        409: 'Conflict',
        410: 'Gone',
        411: 'Length Required',
        412: 'Precondition Failed',
        413: 'Request Entity Too Large',
        414: 'Request-URI Too Large',
        415: 'Unsupported Media Type',
        416: 'Requested Range Not Satisfiable',
        417: 'Expectation Failed',
        418: 'I\'m a teapot',
        422: 'Unprocessable Entity',
        423: 'Locked',
        424: 'Failed Dependency',
        425: 'Unordered Collection',
        426: 'Upgrade Required',
        428: 'Precondition Required',
        429: 'Too Many Requests',
        431: 'Request Header Fields Too Large',
        500: 'Internal Server Error',
        501: 'Not Implemented',
        502: 'Bad Gateway',
        503: 'Service Unavailable',
        504: 'Gateway Time-out',
        505: 'HTTP Version Not Supported',
        506: 'Variant Also Negotiates',
        507: 'Insufficient Storage',
        509: 'Bandwidth Limit Exceeded',
        510: 'Not Extended',
        511: 'Network Authentication Required'
    };

function isTextualContentType(contentType) {
    if (typeof contentType === 'string') {
        contentType = contentType.toLowerCase().trim().replace(/\s*;.*$/, '');
        return (
            /^text\//.test(contentType) ||
            /^application\/(json|javascript)$/.test(contentType) ||
            /^application\/xml/.test(contentType) ||
            /^application\/x-www-form-urlencoded\b/.test(contentType) ||
            /\+xml$/.test(contentType)
        );
    }
    return false;
}

function bufferCanBeInterpretedAsUtf8(buffer) {
    // Hack: Since Buffer.prototype.toString('utf-8') is very forgiving, convert the buffer to a string
    // with percent-encoded octets, then see if decodeURIComponent accepts it.
    try {
        decodeURIComponent(Array.prototype.map.call(buffer, function (octet) {
            return '%' + (octet < 16 ? '0' : '') + octet.toString(16);
        }).join(''));
    } catch (e) {
        return false;
    }
    return true;
}

function expectMessageToSatisfy(expect, subject, value) {
    try {
        if (typeof value === 'string') {
            value = new messy.Message(value);
        }
        expect(subject.headers, 'to [exhaustively] satisfy', value.headers || {});

        subject.upgradeOrDowngradeBodyToMatchSpec(value);
        if ('body' in value) {
            if (isRegExp(value.body)) {
                expect(subject.body, 'to satisfy', value.body);
            } else {
                expect(subject.body, 'to equal', value.body);
            }
        } else if (this.flags.exhaustively) {
            expect(subject.body, 'to be undefined');
        }
    } catch (e) {
        if (e._isUnexpected) {
            var flags = this.flags;
            e.createDiff = function (output, diff, inspect, equal) {
                try {
                    expect(subject.headers, 'to [exhaustively] satisfy', value.headers || {});
                    output.append(expect.inspect(subject.headers));
                } catch (e) {
                    output.append(e.createDiff(output.clone(), diff, inspect, equal).diff);
                }
                var bodyDiffError,
                    bodyDiffResult;
                if ('body' in value) {
                    try {
                        expect(subject.body, 'to satisfy', value.body);
                    } catch (e) {
                        bodyDiffError = e;
                        bodyDiffResult = e.createDiff && e.createDiff(output.clone(), diff, inspect, equal);
                    }
                }
                if (bodyDiffResult) {
                    output.nl(2).append(bodyDiffResult.diff);
                } else if (typeof subject.body !== 'undefined') {
                    output.nl(2);
                    if (typeof subject.body === 'string') {
                        output.text(subject.body);
                    } else {
                        // Buffer instance or parsed JSON
                        output.append(inspect(subject.body));
                    }
                    if (bodyDiffError) {
                        output.sp().error('// should satisfy ').append(inspect(value.body));
                    }
                } else if (flags.exhaustively && typeof subject.body !== 'undefined') {
                    if (typeof message.body === 'string') {
                        output.text(message.body);
                    } else {
                        // Buffer instance or parsed JSON
                        output.append(inspect(message.body, depth));
                    }
                    output.sp().error('// should be removed');
                }
                return {
                    diff: output
                };
            };
        }
        expect.fail(e);
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
        inspect: function (headers, depth, output, inspect) {
            var isFirst = true;
            headers.getNames().forEach(function (headerName) {
                headers.valuesByName[headerName].forEach(function (headerValue) {
                    if (isFirst) {
                        isFirst = false;
                    } else {
                        output.nl();
                    }
                    output
                        .text(messy.formatHeaderName(headerName + ':'), 'gray')
                        .text(' ')
                        .text(headerValue, 'cyan');
                });
            });
            return output;
        },
        diff: function (actual, expected, output, diff, inspect, equal) {
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
        try {
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
        } catch (e) {
            if (e._isUnexpected) {
                var flags = this.flags;
                e.createDiff = function (output, diff, inspect, equal) {
                    var isFirstHeader = true;
                    function outputHeader(name, value) {
                        if (isFirstHeader) {
                            isFirstHeader = false;
                        } else {
                            output.nl();
                        }
                        return (
                            output
                                .text(messy.formatHeaderName(name) + ':', 'gray')
                                .text(' ')
                                .text(value, 'cyan')
                        );
                    }

                    var remainingExpectedHeaders = value instanceof messy.Headers ? value : new messy.Headers(value, true),
                        remainingSubjectHeaders = subject.clone();

                    subject.getNames().forEach(function (headerName) {
                        // First pass: Find exact matches
                        var subjectHeaderValues = subject.getAll(headerName),
                            i;
                        for (i = 0 ; i < subjectHeaderValues.length ; i += 1) {
                            var subjectHeaderValue = subjectHeaderValues[i];
                            if (remainingExpectedHeaders.has(headerName)) {
                                var satisfiedIndex = -1;
                                for (var j = 0 ; j < remainingExpectedHeaders.valuesByName[headerName] ; j += 1) {
                                    try {
                                        expect(subjectHeaderValue, 'to satisfy', remainingExpectedHeaders.valuesByName[j]);
                                        satisfiedIndex = j;
                                        break;
                                    } catch (e) {}
                                }
                                if (satisfiedIndex !== -1) {
                                    outputHeader(headerName, subjectHeaderValue);
                                    subject.remove(headerName, i);
                                    remainingExpectedHeaders.remove(headerName, satisfiedIndex);
                                }
                            }
                        }
                        // Second pass: Find changed headers
                        subjectHeaderValues = remainingSubjectHeaders.getAll(headerName);
                        if (subjectHeaderValues) {
                            for (i = 0 ; i < subjectHeaderValues.length ; i += 1) {
                                outputHeader(headerName, subjectHeaderValues[i]);
                                if (remainingExpectedHeaders.has(headerName)) {
                                    var expectedHeaderValue = remainingExpectedHeaders.get(headerName); // Will be the first if multiple
                                    try {
                                        expect(subjectHeaderValue, 'to satisfy', expectedHeaderValue);
                                        output.sp().error('// FIXME: Should not happen');
                                    } catch (e) {
                                        output.sp().error('// should satisfy ').text(expectedHeaderValue);
                                    }
                                    remainingExpectedHeaders.remove(headerName, 0);
                                } else if (flags.exhaustively) {
                                    output.sp().error('// should be removed');
                                }
                            }
                        }
                    });
                    if (flags.exhaustively) {
                        // All the headers remaining in remainingExpectedHeaders are missing:
                        remainingExpectedHeaders.getNames().forEach(function (headerName) {
                            remainingExpectedHeaders.getAll(headerName).forEach(function (headerValue) {
                                output.error('// missing: ');
                                outputHeader(headerName, headerValue).nl();
                            });
                        });
                    }
                    return {
                        diff: output
                    };
                }
            }
            expect.fail(e);
        }
    }).addType({
        name: 'messy.Message',
        identify: function (obj) {
            return obj instanceof messy.Message;
        },
        equal: function (message1, message2) {
            return message1.equals(message2);
        },
        inspect: function (message, depth, output, inspect) {
            output.append(inspect(message.headers));
            if (!message.hasEmptyBody()) {
                message.upgradeBody();
                if (message.headers.getNames().length > 0) {
                    output.nl(2);
                }
                if (typeof message.body === 'string') {
                    output.text(message.body);
                } else {
                    // Buffer instance or parsed JSON
                    output.append(inspect(message.body, depth));
                }
            }
            return output;
        },
        diff: function (actual, expected, output, diff, inspect, equal) {
            output.append(diff(actual.headers, expected.headers).diff);

            output.nl();

            if (!actual.hasEmptyBody() || !expected.hasEmptyBody()) {
                if (!expected.hasEmptyBody()) {
                    var isJson = /^application\/json\b|\+json/i.test(expected.headers.get('Content-Type'));
                    if ((typeof Buffer === 'function' && Buffer.isBuffer(expected.body)) && isTextualContentType(expected.headers.get('Content-Type')) && bufferCanBeInterpretedAsUtf8(expected.body)) {
                        // TODO: Avoid mutating?
                        expected.body = expected.body.toString('utf-8');
                    }
                    if (isJson && typeof expected.body === 'string') {
                        try {
                            expected.body = JSON.parse(expected.body);
                        } catch (e) {
                            // The body cannot be parsed as JSON, keep as a string instance
                        }
                    }
                }
                expected.upgradeBody();

                actual.upgradeOrDowngradeBodyToMatchSpec(expected);

                var bodyDiff = diff(actual.body, expected.body);
                if (bodyDiff) {
                    output.append(bodyDiff.diff);
                } else {
                    if (typeof actual.body === 'string') {
                        var contentType = actual.headers.get('Content-Type');
                        if (contentType) {
                            var language = contentType.replace(/\s*;.*$/, ''); // Strip charset etc.
                            output.code(actual.body, language);
                        } else {
                            output.text(actual.body);
                        }
                    } else {
                        // Buffer instance or parsed JSON
                        output.append(inspect(actual.body));
                    }
                }
            }

            return {
                diff: output
            };
        }

    }).addAssertion('messy.Message', 'to [exhaustively] satisfy', expectMessageToSatisfy)
    .addType({
        name: 'messy.RequestLine',
        identify: function (obj) {
            return obj instanceof messy.RequestLine;
        },
        equal: function (requestLine1, requestLine2) {
            return requestLine1.equals(requestLine2);
        },
        inspect: function (requestLine, depth, output, inspect) {
            output
                .text(requestLine.method, 'blue')
                .sp()
                .text(requestLine.url, 'gray');
            if (typeof requestLine.protocolName !== 'undefined' || typeof requestLine.protocolVersion !== 'undefined') {
                output.sp();
                if (typeof requestLine.protocolName !== 'undefined') {
                    output.text(requestLine.protocolName, 'blue');
                }
                if (typeof requestLine.protocolVersion !== 'undefined') {
                    output.text('/' + requestLine.protocolVersion, 'cyan')
                }
            }
            return output;
        },
        diff: function (actual, expected, output, diff, inspect, equal) {
            output.append(inspect(actual));
            if (!equal(actual, expected)) {
                var shouldBeFragments = [];
                ['method', 'url', 'protocol'].forEach(function (propertyName) {
                    if (shouldBeFragments.length > 0 || actual[propertyName] !== expected[propertyName]) {
                        shouldBeFragments.push(expected[propertyName]);
                    }
                });
                output.sp().error('// should be').sp().text(shouldBeFragments.join(' '));
            }
            return {
                diff: output
            };
        }
    }).addAssertion('messy.RequestLine', 'to [exhaustively] satisfy', function (expect, subject, value) {
        try {
            if (value && typeof value === 'object') {
                expect(_.pick(subject, messy.RequestLine.propertyNames), 'to [exhaustively] satisfy', value);
            } else {
                expect(subject.toString(), 'to [exhaustively] satisfy', value);
            }
        } catch (e) {
            if (e._isUnexpected) {
                var flags = this.flags;
                e.createDiff = function (output, diff, inspect, equal) {
                    if (typeof value !== 'object') {
                        value = new messy.RequestLine(value);
                    }
                    output.append(inspect(subject)).sp();
                    if (messy.RequestLine.propertyNames.some(function (propertyName) {
                        return typeof value[propertyName] === 'function' || isRegExp(value[propertyName]);
                    })) {
                        output.error('// should ' + (flags.exhaustively ? 'exhaustively ' : '') + 'satisfy ').append(inspect(value));
                    } else {
                        output.error('// should be ').append(inspect(new messy.RequestLine(value)));
                    }
                    return {
                        diff: output
                    };
                };
            }
            expect.fail(e);
        }
    }).addType({
        name: 'messy.HttpRequest',
        base: 'messy.Message',
        identify: function (obj) {
            return obj instanceof messy.HttpRequest;
        },
        equal: function (httpRequest1, httpRequest2) {
            return httpRequest1.equals(httpRequest2);
        },
        inspect: function (httpRequest, depth, output, inspect) {
            output.append(inspect(httpRequest.requestLine, depth));
            if (httpRequest.headers.getNames().length > 0) {
                output.nl();
            } else if (typeof httpRequest.body !== 'undefined') {
                output.nl(2);
            }
            output.append(this.baseType.inspect(httpRequest, depth, output.clone(), inspect));
            return output;
        },
        diff: function (actual, expected, output, diff, inspect, equal) {
            output
                .append(diff(actual.requestLine, expected.requestLine).diff)
                .nl()
                .append(this.baseType.diff(actual, expected, output.clone(), diff, inspect, equal).diff);

            return {
                diff: output
            };
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
            return statusLine1.equals(statusLine2);
        },
        inspect: function (statusLine, depth, output, inspect) {
            if (typeof statusLine.protocolName !== 'undefined' || typeof statusLine.protocolVersion !== 'undefined') {
                if (typeof statusLine.protocolName !== 'undefined') {
                    output.text(statusLine.protocolName, 'blue');
                }
                if (typeof statusLine.protocolVersion !== 'undefined') {
                    output.text('/' + statusLine.protocolVersion, 'cyan')
                }
                output.sp();
            }
            output.text(statusLine.statusCode, 'cyan');
            if (typeof statusLine.statusMessage !== 'undefined') {
                output.sp()
                    .text(statusLine.statusMessage, 'yellow')
            }
            return output;

        },
        diff: function (actual, expected, output, diff, inspect, equal) {
            output.append(inspect(actual));
            if (!equal(actual, expected)) {
                var shouldBeFragments = [];
                ['protocol', 'statusCode', 'statusMessage'].forEach(function (propertyName) {
                    if (shouldBeFragments.length > 0 || actual[propertyName] !== expected[propertyName]) {
                        shouldBeFragments.push(expected[propertyName]);
                    }
                });
                output.sp().error('// should be').sp().text(shouldBeFragments.join(' '));
            }
            return {
                diff: output
            };
        }
    }).addAssertion('messy.StatusLine', 'to [exhaustively] satisfy', function (expect, subject, value) {
        try {
            if (value && typeof value === 'object') {
                expect(_.pick(subject, messy.StatusLine.propertyNames), 'to [exhaustively] satisfy', value);
            } else {
                expect(subject.toString(), 'to [exhaustively] satisfy', value);
            }
        } catch (e) {
            if (e._isUnexpected) {
                var flags = this.flags;
                e.createDiff = function (output, diff, inspect, equal) {
                    if (typeof value !== 'object') {
                        value = new messy.StatusLine(value);
                    }
                    output.append(inspect(subject)).sp();
                    if (messy.StatusLine.propertyNames.some(function (propertyName) {
                        return typeof value[propertyName] === 'function' || isRegExp(value[propertyName]);
                    })) {
                        output.error('// should ' + (flags.exhaustively ? 'exhaustively ' : '') + 'satisfy ').append(inspect(value));
                    } else {
                        var expectedStatusLine = new messy.StatusLine(value);
                        if (typeof expectedStatusLine.statusMessage === 'undefined') {
                            expectedStatusLine.statusMessage = statusMessageByStatusCode[expectedStatusLine.statusCode];
                        }
                        output.error('// should be ').append(inspect(expectedStatusLine));
                    }
                    return {
                        diff: output
                    };
                };
            }
            expect.fail(e);
        }
    }).addType({
        name: 'messy.HttpResponse',
        base: 'messy.Message',
        equal: function (httpResponse1, httpResponse2) {
            return httpResponse1.equals(httpResponse2);
        },
        identify: function (obj) {
            return obj instanceof messy.HttpResponse;
        },
        inspect: function (httpResponse, depth, output, inspect) {
            output.append(inspect(httpResponse.statusLine, depth));
            if (httpResponse.headers.getNames().length > 0) {
                output.nl();
            } else if (typeof httpResponse.body !== 'undefined') {
                output.nl(2);
            }
            output.append(this.baseType.inspect(httpResponse, depth, output.clone(), inspect));
            return output;
        },
        diff: function (actual, expected, output, diff, inspect, equal) {
            output
                .append(diff(actual.statusLine, expected.statusLine).diff)
                .nl()
                .append(this.baseType.diff(actual, expected, output.clone(), diff, inspect, equal).diff);

            return {
                diff: output
            };
        }
    }).addAssertion('messy.HttpResponse', 'to [exhaustively] satisfy', function (expect, subject, value) {
        try {
            if ('statusLine' in value) {
                expect(subject.statusLine, 'to [exhaustively] satisfy', value.statusLine);
            } else {
                // Make the StatusLine properties available for matching:
                expect(subject.statusLine, 'to [exhaustively] satisfy', _.pick(value, messy.StatusLine.propertyNames));
            }
            expectMessageToSatisfy.call(this, expect, subject, value);
        } catch (e) {
            if (e._isUnexpected) {
                var that = this;
                e.createDiff = function (output, diff, inspect, equal) {
                    try {
                        if ('statusLine' in value) {
                            expect(subject.statusLine, 'to [exhaustively] satisfy', value.statusLine);
                        } else {
                            // Make the StatusLine properties available for matching:
                            expect(subject.statusLine, 'to [exhaustively] satisfy', _.pick(value, messy.StatusLine.propertyNames));
                        }
                        output.append(expect.inspect(subject.statusLine));
                    } catch (e) {
                        output.append(e.createDiff(output.clone(), diff, inspect, equal).diff);
                    }
                    output.nl();
                    try {
                        expectMessageToSatisfy.call(that, expect, subject, value);
                        output.append(expect.findTypeOf(new messy.Message()).inspect(subject, 3, output.clone(), inspect, equal));
                    } catch (e) {
                        output.append(e.createDiff(output.clone(), diff, inspect, equal).diff);
                    }
                    return {
                        diff: output
                    };
                };
            }
            expect.fail(e);
        }
    }).addType({
        name: 'messy.HttpExchange',
        equal: function (httpExchange1, httpExchange2) {
            return httpExchange1.equals(httpExchange2);
        },
        identify: function (obj) {
            return obj instanceof messy.HttpExchange;
        },
        inspect: function (httpExchange, depth, output, inspect) {
            if (httpExchange.request) {
                output.append(inspect(httpExchange.request, depth));
            } else {
                output.text('<no request>', 'yellow');
            }
            output.nl(2);
            if (httpExchange.response) {
                output.append(inspect(httpExchange.response, depth));
            } else {
                output.text('<no response>', 'yellow');
            }
            return output;
        },
        diff: function (actual, expected, output, diff, inspect, equal) {
            output
                .append(diff(actual.request, expected.request).diff)
                .nl(2)
                .append(diff(actual.response, expected.response).diff);

            return {
                diff: output
            };
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
            return httpConversation1.equals(httpConversation2);
        },
        identify: function (obj) {
            return obj instanceof messy.HttpConversation;
        },
        inspect: function (httpConversation, depth, output, inspect) {
            httpConversation.exchanges.forEach(function (httpExchange, i) {
                if (i > 0) {
                    output.nl(2);
                }
                output.append(inspect(httpExchange, depth));
            });
            return output;
        },
        diff: function (actual, expected, output, diff, inspect, equal) {
            for (var i = 0 ; i < Math.max(actual.exchanges.length, expected.exchanges.length) ; i += 1) {
                if (i > 0) {
                    output.nl(2);
                }
                if (i < actual.exchanges.length && i < expected.exchanges.length) {
                    output.append(diff(actual.exchanges[i], expected.exchanges[i]).diff);
                } else if (actual.exchanges.length > expected.exchanges.length) {
                    output.block(function () {
                        this.error('should be removed:').nl().append(inspect(actual.exchanges[i]))
                            .prependLinesWith(function () {
                                this.error('//').sp();
                            });
                    });
                } else {
                    // expected.exchanges.length > actual.exchanges.length
                    output.block(function () {
                        this.error('missing:').nl().append(inspect(expected.exchanges[i]))
                            .prependLinesWith(function () {
                                this.error('//').sp();
                            });
                    });
                }
            }

            return {
                diff: output
            };
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
