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

// Copied from unexpected (lib/utils.js)
var errorMethodBlacklist = ['message', 'line', 'sourceId', 'sourceURL', 'stack', 'stackArray'].reduce(function (result, prop) {
    result[prop] = true;
    return result;
}, {});

function cloneError(e) {
    var newError = new Error();
    Object.keys(e).forEach(function (key) {
        if (!errorMethodBlacklist[key]) {
            newError[key] = e[key];
        }
    });
    return newError;
}

function convertSatisfySpecToInstance(obj, Constructor) {
    var satisfySpec = {},
        instance;
    if (obj instanceof Constructor) {
        instance = obj;
    } else if (!obj || typeof obj !== 'object') {
        instance = new Constructor(obj);
    } else {
        instance = new Constructor((function traverse(obj, path) {
            if (Array.isArray(obj)) {
                return obj.map(function (item, i) {
                    return traverse(item, path.concat(i));
                });
            } else if (obj && typeof obj === 'object' && !obj.isMessyHeaders && Object.prototype.toString.call(obj) !== '[object RegExp]') {
                var result = {};
                Object.keys(obj).forEach(function (key) {
                    var val = traverse(obj[key], path.concat(key));
                    if (typeof val !== 'undefined') {
                        result[key] = val;
                    }
                });
                return result;
            } else if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
                return obj;
            } else {
                var satisfySpecCursor = satisfySpec;
                for (var i = 0 ; i < path.length - 1 ; i += 1) {
                    satisfySpecCursor = (satisfySpecCursor[path[i]] = satisfySpecCursor[path[i]] || {});
                }
                satisfySpecCursor[path[path.length - 1]] = obj;
                return '';
            }
        }(obj, [])));
    }
    return { instance: instance, satisfySpec: satisfySpec };
}

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


function isStringOrBufferThatCanBeInterpretedAsUtf8(obj) {
    return typeof obj === 'string' || (typeof Buffer === 'function' && Buffer.isBuffer(obj) && bufferCanBeInterpretedAsUtf8(obj));
}

function isTextualMessage(message) {
    var contentType = message.headers.get('Content-Type');
    if (contentType) {
        return isTextualContentType(contentType) && isStringOrBufferThatCanBeInterpretedAsUtf8(message.body);
    } else if (/^form-data(?:;|$)/.test(message.headers.get('Content-Disposition'))) {
        // Content-Disposition: form-data without Content-Type
        // Say OK if the value can be decoded as text
        return isStringOrBufferThatCanBeInterpretedAsUtf8(message.body);
    }
    return false;
}

function isNonBufferNonRegExpObject(obj) {
    return obj && typeof obj === 'object' && (typeof Buffer === 'undefined' || !Buffer.isBuffer(obj)) && !isRegExp(obj);
}

function canonicalizeObject(obj, stack) {
    stack = stack || [];

    if (stack.indexOf(obj) !== -1) return '[Circular]';

    var canonicalizedObject;

    if ({}.toString.call(obj) === '[object Array]') {
        stack.push(obj);
        canonicalizedObject = obj.map(function (item) {
            return canonicalizeObject(item, stack);
        });
        stack.pop();
    } else if (typeof obj === 'object' && obj !== null) {
        stack.push(obj);
        canonicalizedObject = {};
        Object.keys(obj).sort().forEach(function (key) {
            canonicalizedObject[key] = canonicalizeObject(obj[key], stack);
        });
        stack.pop();
    } else {
        canonicalizedObject = obj;
    }

    return canonicalizedObject;
}

function getUpgradedBody(message) {
    var body = message.body;
    if (typeof body !== 'undefined') {
        var contentType = message.headers.get('Content-Type'),
            isJson = /^application\/json\b/i.test(contentType);
        if (typeof Buffer === 'function' && Buffer.isBuffer(body) && isTextualMessage(message)) {
            body = body.toString('utf-8');
        }
        if (isJson && typeof body === 'string') {
            try {
                body = JSON.parse(body);
            } catch (e) {
                // The body cannot be parsed as JSON, keep as a string instance
            }
        }
    }
    return body;
}

function upgradeOrDowngradeMessageBodyToMatchSpecBody(message, spec) {
    var messageBody = message.body,
        specBody = spec.body;
    if (typeof messageBody !== 'undefined') {
        var isJson = /^application\/json\b/i.test(message.headers.get('Content-Type'));
        if (isNonBufferNonRegExpObject(messageBody) && isJson) {
            if (typeof specBody === 'string' || (typeof Buffer === 'function' && Buffer.isBuffer(specBody))) {
                var parsedSpecBody;
                try {
                    parsedSpecBody = JSON.parse(specBody);
                } catch (e) {}
                if (typeof parsedSpecBody !== 'undefined') {
                    specBody = JSON.stringify(canonicalizeObject(parsedSpecBody), undefined, '  ');
                    messageBody = JSON.stringify(messageBody, undefined, '  ');
                }
            } else if (isRegExp(specBody)) {
                messageBody = JSON.stringify(messageBody, undefined, '  ');
            }
        }
        if (typeof Buffer === 'function' && Buffer.isBuffer(messageBody) && ((typeof specBody === 'string' || isRegExp(specBody) || isNonBufferNonRegExpObject(specBody)) || isTextualMessage(message))) {
            try {
                messageBody = messageBody.toString('utf-8');
            } catch (e) {
                // The body cannot be intepreted as utf-8, keep it as a Buffer instance
            }
        }
        if (isJson && typeof messageBody === 'string' && (typeof specBody === 'undefined' || typeof specBody === 'function' || isNonBufferNonRegExpObject(specBody))) {
            try {
                messageBody = JSON.parse(messageBody);
            } catch (e) {
                // The body cannot be parsed as JSON, keep as a string instance
            }
        } else if (typeof Buffer === 'function' && Buffer.isBuffer(specBody) && (!messageBody || typeof messageBody === 'string')) {
            messageBody = new Buffer(messageBody, 'utf-8');
        }
    } else if (typeof Buffer === 'function' && Buffer.isBuffer(specBody) && specBody.length === 0) {
        messageBody = new Buffer([]);
    } else if (specBody === '') {
        messageBody = '';
    }
    return {
        messageBody: messageBody,
        specBody: specBody
    };
}

module.exports = {
    name: 'unexpected-messy',
    installInto: function unexpectedMessy(expect) {
        var topLevelExpect = expect;

        expect.output.addStyle('messyHeaderValue', function (value) {
            if (typeof value === 'string') {
                this.text(value, 'cyan');
            } else {
                this.append(expect.inspect(value));
            }
        });

        expect.output.addStyle('messyHeader', function (name, value) {
            this.text(messy.formatHeaderName(name) + ':', 'gray')
                .text(' ').messyHeaderValue(value);
        });

        expect.addType({
            name: 'messy.Headers',
            base: 'object',
            identify: function (obj) {
                return obj && obj.isMessyHeaders;
            },
            equal: function (headers1, headers2) {
                return headers1.equals(headers2);
            },
            inspect: function (headers, depth, output, inspect) {
                output.block(function () {
                    var isFirst = true;
                    headers.getNames().forEach(function (headerName) {
                        headers.valuesByName[headerName].forEach(function (headerValue) {
                            if (isFirst) {
                                isFirst = false;
                            } else {
                                this.nl();
                            }
                            this
                                .text(messy.formatHeaderName(headerName + ':'), 'gray')
                                .sp()
                                .text(headerValue, 'cyan');
                        }, this);
                    }, this);
                });
            },
            diff: function (actual, expected, output, diff, inspect, equal) {
                output.block(function () {
                    var output = this; // Sorry for shadowing
                    var isFirstHeader = true;
                    function outputHeader(name, value, suppressLeadingNewline) {
                        output
                            .nl(isFirstHeader || suppressLeadingNewline ? 0 : 1)
                            .messyHeader(name, value);
                        isFirstHeader = false;
                        return output;
                    }

                    var remainingExpectedHeaders = expected.clone(),
                        remainingActualHeaders = actual.clone();

                    actual.getNames().forEach(function (headerName) {
                        // First pass: Find exact matches
                        var actualHeaderValues = actual.getAll(headerName),
                            actualHeaderValue,
                            i;
                        for (i = 0 ; i < actualHeaderValues.length ; i += 1) {
                            actualHeaderValue = actualHeaderValues[i];
                            if (remainingExpectedHeaders.remove(headerName, actualHeaderValue)) {
                                remainingActualHeaders.remove(headerName, actualHeaderValue);
                                outputHeader(headerName, actualHeaderValue);
                            }
                        }
                        // Second pass: Find changed headers
                        actualHeaderValues = remainingActualHeaders.getAll(headerName);
                        if (actualHeaderValues) {
                            for (i = 0 ; i < actualHeaderValues.length ; i += 1) {
                                actualHeaderValue = actualHeaderValues[i];
                                outputHeader(headerName, actualHeaderValue);
                                if (remainingExpectedHeaders.has(headerName)) {
                                    var expectedHeaderValue = remainingExpectedHeaders.get(headerName);
                                    output.sp(actualHeaderValue === '' ? 0 : 1).error('// should be ').text(expectedHeaderValue);
                                    remainingExpectedHeaders.remove(headerName, expectedHeaderValue);
                                } else {
                                    output.sp(actualHeaderValue === '' ? 0 : 1).error('// should be removed');
                                }
                            }
                        }
                    });
                    // All the headers remaining in remainingExpectedHeaders are missing:
                    remainingExpectedHeaders.getNames().forEach(function (headerName) {
                        remainingExpectedHeaders.getAll(headerName).forEach(function (headerValue) {
                            output.nl(isFirstHeader ? 0 : 1).error('// missing ');
                            isFirstHeader = false;
                            outputHeader(headerName, headerValue, true);
                        });
                    });
                });
                return { inline: true, diff: output };
            }
        }).addAssertion('messy.Headers', 'to [exhaustively] satisfy', function (expect, subject, value) {
            var exhaustively = this.flags.exhaustively;
            try {
                if (isRegExp(value)) {
                    expect(subject.toString(), 'to match', value);
                } else {
                    if (value && typeof value === 'object' && !value.isMessyHeaders) {
                        expect(value, 'to be a hash whose keys satisfy', function (headerName) {
                            expect(typeof value[headerName] !== 'undefined' || !subject.has(headerName), 'to be true');
                        });
                    }

                    var remainingExpectedHeaders = value && value.isMessyHeaders ? value : new messy.Headers(value, true),
                        remainingSubjectHeaders = subject.clone();

                    remainingSubjectHeaders.getNames().forEach(function (headerName) {
                        // First pass: Find exact matches
                        var subjectHeaderValues = remainingSubjectHeaders.getAll(headerName),
                            subjectHeaderValue,
                            i;
                        for (i = 0 ; i < subjectHeaderValues.length ; i += 1) {
                            subjectHeaderValue = remainingSubjectHeaders.get(headerName, i);
                            if (remainingExpectedHeaders.has(headerName)) {
                                var satisfiedIndex = -1;
                                for (var j = 0 ; j < remainingExpectedHeaders.valuesByName[headerName].length ; j += 1) {
                                    try {
                                        var expectedValue = remainingExpectedHeaders.valuesByName[headerName][j];
                                        if (typeof expectedValue !== 'undefined' && typeof expectedValue !== 'object') {
                                            expectedValue = String(expectedValue);
                                        }
                                        expect(subjectHeaderValue, 'to satisfy', expectedValue);
                                        satisfiedIndex = j;
                                        break;
                                    } catch (e) {}
                                }

                                if (satisfiedIndex !== -1) {
                                    remainingSubjectHeaders.remove(headerName, i);
                                    remainingExpectedHeaders.remove(headerName, satisfiedIndex);
                                    i -= 1;
                                }
                            }
                        }
                        // Second pass: Find changed headers
                        subjectHeaderValues = remainingSubjectHeaders.getAll(headerName);
                        if (subjectHeaderValues) {
                            for (i = 0 ; i < subjectHeaderValues.length ; i += 1) {
                                subjectHeaderValue = subjectHeaderValues[i];
                                if (remainingExpectedHeaders.has(headerName)) {
                                    var expectedHeaderValue = remainingExpectedHeaders.get(headerName); // Will be the first if multiple
                                    if (typeof expectedHeaderValue === 'undefined') {
                                        expect.fail();
                                    } else {
                                        expect(subjectHeaderValue, 'to satisfy', expectedHeaderValue);
                                        remainingExpectedHeaders.remove(headerName, 0);
                                    }
                                } else if (exhaustively) {
                                    expect.fail();
                                }
                            }
                        }
                    });
                    // All the headers remaining in remainingExpectedHeaders are missing,
                    // except the ones with a value of undefined:
                    remainingExpectedHeaders.getNames().forEach(function (headerName) {
                        remainingExpectedHeaders.getAll(headerName).forEach(function (headerValue) {
                            if (typeof headerValue !== 'undefined') {
                                expect.fail();
                            }
                        });
                    });
                }
            } catch (e) {
                if (e._isUnexpected) {
                    e.createDiff = function (output, diff, inspect, equal) {
                        output.block(function () {
                            var output = this; // Sorry for shadowing
                            var isFirstHeader = true;
                            function outputHeader(name, value, suppressLeadingNewline) {
                                output
                                    .nl(isFirstHeader || suppressLeadingNewline ? 0 : 1)
                                    .messyHeader(name, value);
                                isFirstHeader = false;
                                return output;
                            }

                            var remainingExpectedHeaders = value && value.isMessyHeaders ? value : new messy.Headers(value, true),
                                remainingSubjectHeaders = subject.clone();

                            subject.getNames().forEach(function (headerName) {
                                // First pass: Find exact matches
                                var subjectHeaderValues = subject.getAll(headerName),
                                    subjectHeaderValue,
                                    i;
                                for (i = 0 ; i < subjectHeaderValues.length ; i += 1) {
                                    subjectHeaderValue = subjectHeaderValues[i];
                                    if (remainingExpectedHeaders.has(headerName)) {
                                        var satisfiedIndex = -1;
                                        for (var j = 0 ; j < remainingExpectedHeaders.valuesByName[headerName].length ; j += 1) {
                                            try {
                                                expect(subjectHeaderValue, 'to satisfy', remainingExpectedHeaders.valuesByName[headerName][j]);
                                                satisfiedIndex = j;
                                                break;
                                            } catch (e) {}
                                        }

                                        if (satisfiedIndex !== -1) {
                                            outputHeader(headerName, subjectHeaderValue);
                                            remainingSubjectHeaders.remove(headerName, i);
                                            remainingExpectedHeaders.remove(headerName, satisfiedIndex);
                                        }
                                    }
                                }
                                // Second pass: Find changed headers
                                subjectHeaderValues = remainingSubjectHeaders.getAll(headerName);
                                if (subjectHeaderValues) {
                                    for (i = 0 ; i < subjectHeaderValues.length ; i += 1) {
                                        subjectHeaderValue = subjectHeaderValues[i];
                                        outputHeader(headerName, subjectHeaderValue);
                                        if (remainingExpectedHeaders.has(headerName)) {
                                            var expectedHeaderValue = remainingExpectedHeaders.get(headerName); // Will be the first if multiple
                                            if (typeof expectedHeaderValue === 'undefined') {
                                                output.sp(subjectHeaderValue === '' ? 0 : 1).error('// should be removed');
                                            } else {
                                                try {
                                                    expect(subjectHeaderValue, 'to satisfy', expectedHeaderValue);
                                                    output.sp(subjectHeaderValue === '' ? 0 : 1).error('// FIXME: Should not happen');
                                                } catch (e) {
                                                    output.sp(subjectHeaderValue === '' ? 0 : 1)
                                                        .annotationBlock(function () {
                                                            this.error((e.label || 'should satisfy') + ' ').messyHeaderValue(expectedHeaderValue);
                                                            var d = e.createDiff && e.createDiff(output.clone(), diff, inspect, equal);
                                                            if (d && d.diff) {
                                                                this.nl().block(d.diff);
                                                            }
                                                        });
                                                }
                                                remainingExpectedHeaders.remove(headerName, 0);
                                            }
                                        } else if (exhaustively) {
                                            output.sp(subjectHeaderValue === '' ? 0 : 1).error('// should be removed');
                                        }
                                    }
                                }
                            });
                            // All the headers remaining in remainingExpectedHeaders are missing,
                            // except the ones with a value of undefined:
                            remainingExpectedHeaders.getNames().forEach(function (headerName) {
                                remainingExpectedHeaders.getAll(headerName).forEach(function (headerValue) {
                                    if (typeof headerValue !== 'undefined') {
                                        output.nl(isFirstHeader ? 0 : 1).error('// missing ');
                                        outputHeader(headerName, headerValue, true);
                                        isFirstHeader = false;
                                    }
                                });
                            });
                        });
                        return { inline: true, diff: output };
                    };
                }
                expect.fail(e);
            }
        }).addType({
            name: 'messy.Message',
            base: 'object',
            identify: function (obj) {
                return obj && obj.isMessyMessage;
            },
            equal: function (message1, message2) {
                return message1.equals(message2);
            },
            inspect: function (message, depth, output, inspect) {
                return output.block(function () {
                    this.append(inspect(message.headers, depth));
                    if (!message.hasEmptyBody()) {
                        if (message.headers.getNames().length > 0) {
                            this.nl(2);
                        }
                        if (message.isMultipart) {
                            message.parts.forEach(function (part) {
                                this
                                    .text('--' + message.boundary, 'green')
                                    .nl()
                                    .append(inspect(part, depth))
                                    .nl();
                            }, this);
                            this.text('--' + message.boundary + '--', 'green');
                        } else {
                            var upgradedBody = getUpgradedBody(message);
                            if (typeof upgradedBody === 'string') {
                                var contentType = message.headers.get('Content-Type');
                                if (contentType) {
                                    var language = contentType.replace(/\s*;.*$/, ''); // Strip charset etc.
                                    this.code(upgradedBody, language);
                                } else {
                                    this.text(upgradedBody);
                                }
                            } else {
                                // Buffer instance or parsed JSON
                                this.append(inspect(upgradedBody, depth));
                            }
                        }
                    }
                });
            },
            diff: function (actual, expected, output, diff, inspect, equal) {
                output.block(function () {
                    var output = this; // Sorry for shadowing
                    output.append(diff(actual.headers, expected.headers).diff);

                    if (!actual.hasEmptyBody() || !expected.hasEmptyBody()) {
                        output.nl(2);
                        if (!expected.hasEmptyBody()) {
                            expected.body = getUpgradedBody(expected);
                        }
                        var upgradedOrDowngradedMessageBodyAndSpecBody = upgradeOrDowngradeMessageBodyToMatchSpecBody(actual, expected),
                            actualBody = upgradedOrDowngradedMessageBodyAndSpecBody.messageBody,
                            expectedBody = upgradedOrDowngradedMessageBodyAndSpecBody.specBody,
                            bodyDiff = diff(actualBody, expectedBody);
                        if (bodyDiff) {
                            output.append(bodyDiff.diff);
                        } else {
                            if (typeof actual.body === 'string') {
                                var contentType = actual.headers.get('Content-Type');
                                if (contentType) {
                                    var language = contentType.replace(/\s*;.*$/, ''); // Strip charset etc.
                                    output.code(actualBody, language);
                                } else {
                                    output.text(actualBody);
                                }
                            } else {
                                // Buffer instance or parsed JSON
                                output.append(inspect(actualBody));
                            }
                        }
                    }
                });
                return { inline: true, diff: output };
            }
        }).addAssertion('messy.Message', 'to [exhaustively] satisfy', function (expect, subject, value) {
            if (typeof value === 'undefined') {
                value = {};
            } else if (typeof value === 'string' || (typeof Buffer !== 'undefined' && Buffer.isBuffer(value))) {
                value = new messy.Message(value);
            }

            var upgradedOrDowngradedMessageBodyAndSpecBody = upgradeOrDowngradeMessageBodyToMatchSpecBody(subject, value),
                subjectBody = upgradedOrDowngradedMessageBodyAndSpecBody.messageBody,
                expectedBody = upgradedOrDowngradedMessageBodyAndSpecBody.specBody,
                flags = this.flags,
                promiseByKey = {
                    headers: expect.promise(function () {
                        if ('headers' in value) {
                            return expect(subject.headers, 'to [exhaustively] satisfy', value.headers);
                        }
                    }),
                    body: expect.promise(function () {
                        if ('body' in value) {
                            expect(subjectBody, 'to satisfy', expectedBody);
                        } else if (flags.exhaustively) {
                            expect(subject.hasEmptyBody(), 'to be true');
                        }
                    })
                };

            if (value && typeof value === 'object' && !value.isMessyMessage) {
                var unsupportedKeys = Object.keys(value).filter(function (key) {
                    return key !== 'body' && key !== 'fileName' && key !== 'rawBody' && key !== 'text' && key !== 'headers' && key !== 'parts';
                });
                if (unsupportedKeys.length > 0) {
                    throw new Error('messy.Message to satisfy: Unsupported keys: ' + unsupportedKeys.join(', '));
                }

                promiseByKey.fileName = expect.promise(function () {
                    if ('fileName' in value) {
                        return expect(subject, 'to have file name satisfying', value.fileName);
                    }
                });
                promiseByKey.rawBody = expect.promise(function () {
                    if ('rawBody' in value) {
                        return expect(subject, 'to have raw body satisfying', value.rawBody);
                    }
                });
                promiseByKey.text = expect.promise(function () {
                    if ('text' in value) {
                        return expect(subject.toString(), 'to equal', value.text);
                    }
                });

                if (typeof value.parts !== 'undefined' && typeof value.parts !== 'function') {
                    Object.keys(value.parts).forEach(function (key) {
                        promiseByKey[key] = expect.promise(function () {
                            return expect(subject.parts[key], 'to satisfy', value.parts[key]);
                        });
                    });
                }

                promiseByKey.parts = expect.promise(function () {
                    if (typeof value.parts !== 'undefined') {
                        expect(subject, 'to be a multipart message');
                        expect(subject.parts, 'to be an array');
                        if (typeof value.parts === 'function') {
                            return expect(subject.parts, 'to satisfy', value.parts);
                        } else if (Array.isArray(value.parts)) {
                            expect(subject, 'to have number of parts', value.parts.length);
                            return expect(subject.parts, 'to satisfy', value.parts);
                        } else if (value.parts && typeof value.parts === 'object') {
                            expect(value.parts, 'to be an object whose keys satisfy', /^\d+/);
                        }
                    }
                });
            }

            subject.body = subjectBody; // Not cool, but unexpected-express depends on it

            return expect.promise.all(promiseByKey).caught(function (err) {
                if (!err || !err._isUnexpected) {
                    expect.fail(err);
                }
                return expect.promise.settle(promiseByKey).then(function () {
                    Object.keys(promiseByKey).forEach(function (key) {
                        if (promiseByKey[key].isRejected() && !promiseByKey[key].reason()._isUnexpected) {
                            expect.fail(promiseByKey[key].reason());
                        }
                    });
                    err = cloneError(err);
                    err.createDiff = function (output, diff, inspect, equal) {
                        output.block(function () {
                            var output = this; // Sorry for shadowing
                            if (promiseByKey.headers.isRejected()) {
                                output.append(promiseByKey.headers.reason().createDiff(output.clone(), diff, inspect, equal).diff);
                            } else {
                                output.append(expect.inspect(subject.headers));
                            }
                            var bodySatisfyError = promiseByKey.body.isRejected() && promiseByKey.body.reason(),
                                bodyDiffResult = bodySatisfyError && bodySatisfyError.createDiff && bodySatisfyError.createDiff(output.clone(), diff, inspect, equal);

                            if (bodyDiffResult && bodyDiffResult.diff) {
                                output.nl(2).append(bodyDiffResult.diff);
                            } else if (!subject.hasEmptyBody()) {
                                output.nl(2);
                                if (subject.isMultipart) {
                                    subject.parts.forEach(function (part, i) {
                                        output.text('--' + subject.boundary, 'green').nl();
                                        var partSatisfyError = promiseByKey[i] && promiseByKey[i].isRejected() && promiseByKey[i].reason(),
                                            partSatisfyDiff = partSatisfyError && partSatisfyError.createDiff && partSatisfyError.createDiff(output.clone(), diff, inspect, equal);
                                        if (typeof value.parts !== 'function' && i in value.parts) {
                                            if (partSatisfyDiff) {
                                                output.append(partSatisfyDiff.diff);
                                            } else {
                                                output.append(inspect(part));
                                                if (partSatisfyError) {
                                                    output.sp().error('// ' + (partSatisfyError.label || 'should satisfy') + ' ').append(inspect(value.parts[i]));
                                                }
                                            }
                                        } else {
                                            output.append(inspect(part));
                                        }
                                        output.nl();
                                    });
                                    output.text('--' + subject.boundary + '--', 'green');
                                } else if (typeof subjectBody === 'string') {
                                    output.text(subjectBody);
                                } else {
                                    // Buffer instance or parsed JSON
                                    output.append(inspect(subjectBody));
                                }
                                if (bodySatisfyError) {
                                    output.sp().error('// ' + (bodySatisfyError.label || 'should satisfy') + ' ').append(inspect(expectedBody));
                                }
                            } else if (bodySatisfyError) {
                                output.nl(2).error('// ' + (bodySatisfyError.label || 'should satisfy') + ' ').append(inspect(expectedBody));
                            } else if (flags.exhaustively && !subject.hasEmptyBody()) {
                                if (typeof subjectBody === 'string') {
                                    output.text(subjectBody);
                                } else {
                                    // Buffer instance or parsed JSON
                                    output.append(inspect(subjectBody));
                                }
                                output.sp().error('// should be removed');
                            }

                            if (promiseByKey.fileName && promiseByKey.fileName.isRejected()) {
                                var fileNameError = promiseByKey.fileName.reason();
                                output.nl().error('// should have file name satisfying').sp().append(expect.inspect(value.fileName));
                                var d = fileNameError.createDiff && fileNameError.createDiff(output.clone(), diff, inspect, equal);
                                if (d && d.diff) {
                                    output.nl().append(d.diff);
                                }
                            }

                            if (promiseByKey.text && promiseByKey.text.isRejected()) {
                                var textError = promiseByKey.text.reason();
                                output.nl().annotationBlock(function () {
                                    this.error('should have text satisfying').sp().append(expect.inspect(value.text));
                                    var d = textError.createDiff && textError.createDiff(output.clone(), diff, inspect, equal);
                                    if (d && d.diff) {
                                        output.nl().append(d.diff);
                                    }
                                });
                            }

                            if (promiseByKey.rawBody && promiseByKey.rawBody.isRejected()) {
                                var rawBodyError = promiseByKey.rawBody.reason();
                                output.nl().annotationBlock(function () {
                                    this.error('should have raw body satisfying').sp().append(expect.inspect(value.rawBody));
                                    var d = rawBodyError.createDiff && rawBodyError.createDiff(output.clone(), diff, inspect, equal);
                                    if (d && d.diff) {
                                        this.nl().append(d.diff);
                                    }
                                });
                            }
                            if (typeof value.parts !== 'undefined') {
                                if (!subject.isMultipart) {
                                    output.nl().annotationBlock(function () {
                                        this.error('should be a multipart message');
                                    });
                                }
                                if (Array.isArray(value.parts)) {
                                    if (value.parts.length !== subject.parts.length) {
                                        output.nl().annotationBlock(function () {
                                            this.error('should have number of parts').sp().jsNumber(value.parts.length);
                                        });
                                    }
                                } else if (typeof value.parts === 'function') {
                                    if (promiseByKey.parts.isRejected()) {
                                        var partsError = promiseByKey.parts.reason();
                                        var d = partsError.createDiff && partsError.createDiff(output.clone(), diff, inspect, equal);
                                        output.nl().annotationBlock(function () {
                                            this.append((d && d.diff) || partsError.output);
                                        });
                                    }
                                } else if (value.parts && typeof value.parts === 'object') {
                                    var nonNumericPartIds = Object.keys(value.parts).filter(function (partId) {
                                        return !/^\d+/.test(partId);
                                    });
                                    if (nonNumericPartIds.length > 0) {
                                        output.nl().annotationBlock(function () {
                                            this.error('invalid part specifier(s):').sp();
                                            nonNumericPartIds.forEach(function (partId, i) {
                                                if (i > 0) {
                                                    output.text(',').sp();
                                                }
                                                this.append(expect.inspect(partId));
                                            }, this);
                                        });
                                    }
                                }
                            }
                        });
                        return { inline: true, diff: output };
                    };
                    expect.fail(err);
                });
            });
        }).addAssertion('messy.Message', 'to have raw body satisfying', function (expect, subject, value) {
            expect(subject.rawBody, 'to satisfy', value);
        })
        .addAssertion('messy.Message', 'to have file name satisfying', function (expect, subject, value) {
            expect(subject.fileName, 'to satisfy', value);
        })
        .addAssertion('messy.Message', 'to have text satisfying', function (expect, subject, value) {
            expect(subject.toString(), 'to satisfy', value);
        }).addAssertion('messy.Message', '[not] to be a multipart message', function (expect, subject) {
            expect(subject.isMultipart, '[not] to be truthy');
        })
        .addAssertion('messy.Message', '[not] to have number of parts', function (expect, subject, value) {
            expect(subject.parts, '[not] to have length', value);
        })
        .addType({
            name: 'messy.RequestLine',
            base: 'object',
            identify: function (obj) {
                return obj && obj.isMessyRequestLine;
            },
            equal: function (requestLine1, requestLine2) {
                return requestLine1.equals(requestLine2);
            },
            inspect: function (requestLine, depth, output, inspect) {
                var isFirstFragment = true;
                if (requestLine.method) {
                    isFirstFragment = false;
                    output
                        .text(requestLine.method, 'blue');
                }
                if (requestLine.url) {
                    output.sp(isFirstFragment ? 0 : 1)
                        .text(requestLine.url, 'gray');
                    isFirstFragment = false;
                }
                if (typeof requestLine.protocolName !== 'undefined' || typeof requestLine.protocolVersion !== 'undefined') {
                    output.sp(isFirstFragment ? 0 : 1);
                    if (typeof requestLine.protocolName !== 'undefined') {
                        output.text(requestLine.protocolName, 'blue');
                    }
                    if (typeof requestLine.protocolVersion !== 'undefined') {
                        output.text('/' + requestLine.protocolVersion, 'cyan');
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
                return { inline: true, diff: output };
            }
        }).addAssertion('messy.RequestLine', 'to [exhaustively] satisfy', function (expect, subject, value) {
            if (typeof value === 'undefined') {
                value = {};
            }
            var flags = this.flags;
            return expect.promise(function () {
                if (value && typeof value === 'object') {
                    return expect(_.pick(subject, messy.RequestLine.propertyNames), 'to [exhaustively] satisfy', value);
                } else {
                    return expect(subject.toString(), 'to [exhaustively] satisfy', value);
                }
            }).caught(function (e) {
                if (!e || !e._isUnexpected) {
                    expect.fail(e);
                }
                var err = cloneError(e);
                err.createDiff = function (output, diff, inspect, equal) {
                    if (typeof value !== 'object') {
                        value = new messy.RequestLine(value);
                    }
                    output.append(inspect(subject)).sp();
                    if (messy.RequestLine.propertyNames.some(function (propertyName) {
                        return typeof value[propertyName] === 'function' || isRegExp(value[propertyName]);
                    })) {
                        output.error('// should ' + (flags.exhaustively ? 'exhaustively ' : '') + 'satisfy ').append(inspect(value));
                    } else {
                        var expectedRequestLine = new messy.RequestLine(value);
                        output.error('// should be ').append(inspect(expectedRequestLine));
                    }
                    return { inline: true, diff: output };
                };
                expect.fail(err);
            });
        }).addType({
            name: 'messy.HttpRequest',
            base: 'messy.Message',
            identify: function (obj) {
                return obj && obj.isMessyHttpRequest;
            },
            equal: function (httpRequest1, httpRequest2) {
                return httpRequest1.equals(httpRequest2);
            },
            inspect: function (httpRequest, depth, output, inspect) {
                var baseType = this.baseType;
                return output.block(function () {
                    this.append(inspect(httpRequest.requestLine, depth));
                    if (httpRequest.headers.getNames().length > 0) {
                        this.nl();
                    } else if (!httpRequest.hasEmptyBody()) {
                        this.nl(2);
                    }
                    this.append(baseType.inspect(httpRequest, depth, output.clone(), inspect));
                });
            },
            diff: function (actual, expected, output, diff, inspect, equal) {
                var baseType = this.baseType;
                output.block(function () {
                    this
                        .append(diff(actual.requestLine, expected.requestLine).diff)
                        .nl()
                        .append(baseType.diff(actual, expected, output.clone(), diff, inspect, equal).diff);
                });
                return { inline: true, diff: output };
            }
        }).addAssertion('messy.HttpRequest', 'to [exhaustively] satisfy', function (expect, subject, value) {
            if (typeof value === 'undefined') {
                value = {};
            }
            var requestLineSpec = _.pick(value, messy.RequestLine.propertyNames),
                messageValue = _.extend({}, value);
            delete messageValue.requestLine;

            messy.HttpRequest.metadataPropertyNames.forEach(function (metadataPropertyName) {
                delete messageValue[metadataPropertyName];
            });
            Object.keys(requestLineSpec).forEach(function (requestLineKey) {
                delete messageValue[requestLineKey];
            });
            var promiseByKey = {
                message: expect.promise(function () {
                    return expect(Object.create(subject, {isMessyHttpRequest: {value: false}}), 'to [exhaustively] satisfy', messageValue);
                }),
                requestLine: expect.promise(function () {
                    if ('requestLine' in value) {
                        return expect(subject.requestLine, 'to [exhaustively] satisfy', value.requestLine);
                    }
                }),
                requestLineSpec: expect.promise(function () {
                    // Make the RequestLine properties available for matching:
                    return expect(subject.requestLine, 'to [exhaustively] satisfy', requestLineSpec);
                })
            };

            messy.HttpRequest.metadataPropertyNames.forEach(function (metadataPropertyName) {
                promiseByKey[metadataPropertyName] = expect.promise(function () {
                    if (metadataPropertyName in value) {
                        return topLevelExpect(subject[metadataPropertyName], 'to satisfy', value[metadataPropertyName]);
                    }
                });
            });

            return expect.promise.all(promiseByKey).caught(function (err) {
                if (!err || !err._isUnexpected) {
                    expect.fail(err);
                }
                return expect.promise.settle(promiseByKey).then(function () {
                    Object.keys(promiseByKey).forEach(function (key) {
                        if (promiseByKey[key].isRejected() && !promiseByKey[key].reason()._isUnexpected) {
                            expect.fail(promiseByKey[key].reason());
                        }
                    });
                    err = cloneError(err);
                    err.createDiff = function (output, diff, inspect, equal) {
                        output.block(function () {
                            var output = this; // Sorry for shadowing
                            if (promiseByKey.requestLine.isRejected()) {
                                var requestLineError = promiseByKey.requestLine.reason(),
                                    diffResult = requestLineError.createDiff && requestLineError.createDiff(output.clone(), diff, inspect, equal);
                                if (diffResult && diffResult.diff) {
                                    output.append(diffResult.diff);
                                } else {
                                    output.annotationBlock(function () {
                                        this.append(requestLineError.output);
                                    });
                                }
                            } else if (promiseByKey.requestLineSpec.isRejected()) {
                                var requestLineSpecError = promiseByKey.requestLineSpec.reason(),
                                    diffResult = requestLineSpecError.createDiff && requestLineSpecError.createDiff(output.clone(), diff, inspect, equal);
                                if (diffResult && diffResult.diff) {
                                    output.append(diffResult.diff);
                                } else {
                                    output.annotationBlock(function () {
                                        this.append(requestLineSpecError.output);
                                    });
                                }
                            } else {
                                output.append(inspect(subject.requestLine));
                            }
                            output.nl();
                            if (promiseByKey.message.isRejected()) {
                                var messageError = promiseByKey.message.reason(),
                                    diffResult = messageError.createDiff && messageError.createDiff(output.clone(), diff, inspect, equal);
                                if (diffResult && diffResult.diff) {
                                    output.append(diffResult.diff);
                                } else {
                                    output.annotationBlock(function () {
                                        this.append(messageError.output);
                                    });
                                }
                            } else {
                                output.append(expect.findTypeOf(new messy.Message()).inspect(subject, 3, output.clone(), inspect, equal));
                            }
                            messy.HttpRequest.metadataPropertyNames.forEach(function (metadataPropertyName) {
                                var metadataPropertyError = promiseByKey[metadataPropertyName].isRejected() && promiseByKey[metadataPropertyName].reason();
                                if (metadataPropertyError) {
                                    if (metadataPropertyName === 'encrypted' && value.encrypted === true) {
                                        output.nl().error('// expected an encrypted request');
                                    } else if (metadataPropertyName === 'encrypted' && value.encrypted === false) {
                                        output.nl().error('// expected an unencrypted request');
                                    } else {
                                        output.nl().annotationBlock(function () {
                                            this.text(metadataPropertyName).text(':').sp().append(metadataPropertyError.output);
                                        });
                                    }
                                }
                            });
                        });
                        return { inline: true, diff: output };
                    };
                    expect.fail(err);
                });
            });
        }).addType({
            name: 'messy.StatusLine',
            base: 'object',
            identify: function (obj) {
                return obj && obj.isMessyStatusLine;
            },
            equal: function (statusLine1, statusLine2) {
                return statusLine1.equals(statusLine2);
            },
            inspect: function (statusLine, depth, output, inspect) {
                var isFirstFragment = true;
                if (typeof statusLine.protocolName !== 'undefined' || typeof statusLine.protocolVersion !== 'undefined') {
                    if (typeof statusLine.protocolName !== 'undefined') {
                        output.text(statusLine.protocolName, 'blue');
                    }
                    if (typeof statusLine.protocolVersion !== 'undefined') {
                        output.text('/' + statusLine.protocolVersion, 'cyan');
                    }
                    isFirstFragment = false;
                }
                if (statusLine.statusCode) {
                    output
                        .sp(isFirstFragment ? 0 : 1)
                        .text(statusLine.statusCode, 'cyan');
                    isFirstFragment = false;
                }
                if (typeof statusLine.statusMessage !== 'undefined') {
                    output.sp(isFirstFragment ? 0 : 1)
                        .text(statusLine.statusMessage, 'yellow');
                }
                return output;
            },
            diff: function (actual, expected, output, diff, inspect, equal) {
                output.append(inspect(actual));
                if (!equal(actual, expected)) {
                    var shouldBeFragments = [];
                    ['protocol', 'statusCode', 'statusMessage'].forEach(function (propertyName) {
                        if (typeof expected[propertyName] !== 'undefined' && (shouldBeFragments.length > 0 || actual[propertyName] !== expected[propertyName])) {
                            shouldBeFragments.push(expected[propertyName]);
                        }
                    });
                    output.sp().error('// should be').sp().text(shouldBeFragments.join(' '));
                }
                return { inline: true, diff: output };
            }
        }).addAssertion('messy.StatusLine', 'to [exhaustively] satisfy', function (expect, subject, value) {
            if (typeof value === 'undefined') {
                value = {};
            }
            var flags = this.flags;
            return expect.promise(function () {
                if (typeof value === 'number' || typeof value === 'function') {
                    return expect(subject.statusCode, 'to satisfy', value);
                } else if (value && typeof value === 'object') {
                    return expect(_.pick(subject, messy.StatusLine.propertyNames), 'to [exhaustively] satisfy', value);
                } else {
                    return expect(subject.toString(), 'to [exhaustively] satisfy', value);
                }
            }).caught(function (e) {
                if (!e || !e._isUnexpected) {
                    expect.fail(e);
                }
                var err = cloneError(e);
                e.createDiff = function (output, diff, inspect, equal) {
                    output.append(inspect(subject)).sp();
                    if (typeof value === 'number' || typeof value === 'function') {
                        if (value._expectIt) {
                            output.error('//').sp().append(err.createDiff(output.clone(), diff, inspect, equal).diff);
                        } else {
                            output.error('// ' + (err.label || 'should satisfy')).sp().append(inspect(value));
                        }
                    } else if (messy.StatusLine.propertyNames.some(function (propertyName) {
                        return typeof value[propertyName] === 'function' || isRegExp(value[propertyName]);
                    })) {
                        output.error('// should ' + (flags.exhaustively ? 'exhaustively ' : '') + 'satisfy ').append(inspect(value));
                    } else {
                        var expectedStatusLine = new messy.StatusLine(value);
                        if (typeof expectedStatusLine.statusMessage === 'undefined' && typeof subject.statusMessage !== 'undefined') {
                            expectedStatusLine.statusMessage = statusMessageByStatusCode[expectedStatusLine.statusCode];
                        }
                        output.error('// should be ').append(inspect(expectedStatusLine));
                    }
                    return { inline: true, diff: output };
                };
                expect.fail(e);
            });
        }).addType({
            name: 'messy.HttpResponse',
            base: 'messy.Message',
            equal: function (httpResponse1, httpResponse2) {
                return httpResponse1.equals(httpResponse2);
            },
            identify: function (obj) {
                return obj && obj.isMessyHttpResponse;
            },
            inspect: function (httpResponse, depth, output, inspect) {
                var baseType = this.baseType;
                return output.block(function () {
                    this.append(inspect(httpResponse.statusLine, depth));
                    if (httpResponse.headers.getNames().length > 0) {
                        this.nl();
                    } else if (!httpResponse.hasEmptyBody()) {
                        this.nl(2);
                    }
                    this.append(baseType.inspect(httpResponse, depth, output.clone(), inspect));
                });
            },
            diff: function (actual, expected, output, diff, inspect, equal) {
                var baseType = this.baseType;
                output.block(function () {
                    var output = this; // Sorry for shadowing
                    output
                        .append(diff(actual.statusLine, expected.statusLine).diff);

                    var messageDiffResult = baseType.diff(actual, expected, output.clone(), diff, inspect, equal);
                    if (messageDiffResult.diff && !messageDiffResult.diff.isEmpty()) {
                        output
                            .nl()
                            .append(messageDiffResult.diff);
                    }
                });
                return { inline: true, diff: output };
            }
        }).addAssertion('messy.HttpResponse', 'to [exhaustively] satisfy', function (expect, subject, value) {
            if (typeof value === 'undefined') {
                value = {};
            }
            var statusLineSpec = _.pick(value, messy.StatusLine.propertyNames),
                messageValue = _.extend({}, value);
            delete messageValue.statusLine;

            Object.keys(statusLineSpec).forEach(function (statusLineKey) {
                delete messageValue[statusLineKey];
            });
            var promiseByKey = {
                statusLine: expect.promise(function () {
                    if ('statusLine' in value) {
                        return expect(subject.statusLine, 'to [exhaustively] satisfy', value.statusLine);
                    }
                }),
                statusLineSpec: expect.promise(function () {
                    // Make the StatusLine properties available for matching:
                    return expect(subject.statusLine, 'to [exhaustively] satisfy', statusLineSpec);
                }),
                message: expect.promise(function () {
                    return expect(Object.create(subject, {isMessyHttpResponse: {value: false}}), 'to [exhaustively] satisfy', messageValue);
                })
            };

            return expect.promise.all(promiseByKey).caught(function (err) {
                if (!err || !err._isUnexpected) {
                    expect.fail(err);
                }
                return expect.promise.settle(promiseByKey).then(function () {
                    Object.keys(promiseByKey).forEach(function (key) {
                        if (promiseByKey[key].isRejected() && !promiseByKey[key].reason()._isUnexpected) {
                            expect.fail(promiseByKey[key].reason());
                        }
                    });
                    err = cloneError(err);
                    err.createDiff = function (output, diff, inspect, equal) {
                        output.block(function () {
                            var output = this; // Sorry for shadowing
                            if (promiseByKey.statusLine.isRejected()) {
                                var statusLineError = promiseByKey.statusLine.reason(),
                                    diffResult = statusLineError.createDiff && statusLineError.createDiff(output.clone(), diff, inspect, equal);
                                if (diffResult && diffResult.diff) {
                                    output.append(diffResult.diff);
                                } else {
                                    output.annotationBlock(function () {
                                        this.append(statusLineError.output);
                                    });
                                }
                            } else if (promiseByKey.statusLineSpec.isRejected()) {
                                var statusLineSpecError = promiseByKey.statusLineSpec.reason(),
                                    diffResult = statusLineSpecError.createDiff && statusLineSpecError.createDiff(output.clone(), diff, inspect, equal);
                                if (diffResult && diffResult.diff) {
                                    output.append(diffResult.diff);
                                } else {
                                    output.annotationBlock(function () {
                                        this.append(statusLineSpecError.output);
                                    });
                                }
                            } else {
                                output.append(inspect(subject.statusLine));
                            }
                            output.nl();
                            if (promiseByKey.message.isRejected()) {
                                var messageError = promiseByKey.message.reason(),
                                    diffResult = messageError.createDiff && messageError.createDiff(output.clone(), diff, inspect, equal);
                                if (diffResult && diffResult.diff) {
                                    output.append(diffResult.diff);
                                } else {
                                    output.annotationBlock(function () {
                                        this.append(messageError.output);
                                    });
                                }
                            } else {
                                output.append(expect.findTypeOf(new messy.Message()).inspect(subject, 3, output.clone(), inspect, equal));
                            }
                        });
                        return { inline: true, diff: output };
                    };
                    expect.fail(err);
                });
            });
        }).addType({
            name: 'messy.HttpExchange',
            base: 'object',
            equal: function (httpExchange1, httpExchange2) {
                return httpExchange1.equals(httpExchange2);
            },
            identify: function (obj) {
                return obj && obj.isMessyHttpExchange;
            },
            inspect: function (httpExchange, depth, output, inspect) {
                return output.block(function () {
                    if (httpExchange.request) {
                        this.append(inspect(httpExchange.request, depth));
                    } else {
                        this.text('<no request>', 'yellow');
                    }
                    this.nl(2);
                    if (httpExchange.response) {
                        this.append(inspect(httpExchange.response, depth));
                    } else {
                        this.text('<no response>', 'yellow');
                    }
                });
            },
            diff: function (actual, expected, output, diff, inspect, equal) {
                output.block(function () {
                    this
                        .append(diff(actual.request, expected.request).diff)
                        .nl(2)
                        .append(diff(actual.response, expected.response).diff);
                });
                return { inline: true, diff: output };
            }
        }).addAssertion('messy.HttpExchange', 'to [exhaustively] satisfy', function (expect, subject, value) {
            if (typeof value === 'undefined') {
                value = {};
            }
            var flags = this.flags,
                promiseByKey = {
                    request: expect.promise(function () {
                        if ('request' in value) {
                            return expect(subject.request, 'to [exhaustively] satisfy', value.request);
                        } else {
                            expect(flags.exhaustively, 'to be false');
                        }
                    }),
                    response: expect.promise(function () {
                        if ('response' in value) {
                            expect(subject.response, 'to [exhaustively] satisfy', value.response);
                        } else {
                            expect(flags.exhaustively, 'to be false');
                        }
                    })
                };
            return expect.promise.all(promiseByKey).caught(function (err) {
                if (!err || !err._isUnexpected) {
                    expect.fail(err);
                }
                return expect.promise.settle(promiseByKey).then(function () {
                    Object.keys(promiseByKey).forEach(function (key) {
                        if (promiseByKey[key].isRejected() && !promiseByKey[key].reason()._isUnexpected) {
                            expect.fail(promiseByKey[key].reason());
                        }
                    });
                    err = cloneError(err);
                    err.createDiff = function (output, diff, inspect, equal) {
                        output.block(function () {
                            var output = this; // Sorry for shadowing
                            if (promiseByKey.request.isRejected()) {
                                var requestError = promiseByKey.request.reason(),
                                    diffResult = requestError.createDiff && requestError.createDiff(output.clone(), diff, inspect, equal);
                                if (diffResult && diffResult.diff) {
                                    output.append(diffResult.diff);
                                } else {
                                    output.annotationBlock(function () {
                                        this.append(requestError.output);
                                    });
                                }
                            } else if (subject.request) {
                                output.append(inspect(subject.request));
                            } else {
                                output.text('<no request>', 'yellow');
                            }
                            output.nl(2);
                            if (promiseByKey.response.isRejected()) {
                                var responseError = promiseByKey.response.reason(),
                                    diffResult = responseError.createDiff && responseError.createDiff(output.clone(), diff, inspect, equal);
                                if (diffResult && diffResult.diff) {
                                    output.append(diffResult.diff);
                                } else {
                                    output.annotationBlock(function () {
                                        this.append(responseError.output);
                                    });
                                }
                            } else if (subject.response) {
                                output.append(inspect(subject.response));
                            } else {
                                output.text('<no response>', 'yellow');
                            }
                        });
                        return { inline: true, diff: output };
                    };
                    expect.fail(err);
                });
            });
        }).addType({
            name: 'messy.HttpConversation',
            base: 'object',
            equal: function (httpConversation1, httpConversation2) {
                return httpConversation1.equals(httpConversation2);
            },
            identify: function (obj) {
                return obj && obj.isMessyHttpConversation;
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
                output.block(function () {
                    for (var i = 0 ; i < Math.max(actual.exchanges.length, expected.exchanges.length) ; i += 1) {
                        if (i > 0) {
                            this.nl(2);
                        }
                        if (i < actual.exchanges.length && i < expected.exchanges.length) {
                            this.append(diff(actual.exchanges[i], expected.exchanges[i]).diff);
                        } else if (actual.exchanges.length > expected.exchanges.length) {
                            this.block(function () {
                                this.error('should be removed:').nl().append(inspect(actual.exchanges[i]))
                                    .prependLinesWith(function () {
                                        this.error('//').sp();
                                    });
                            });
                        } else {
                            // expected.exchanges.length > actual.exchanges.length
                            this.block(function () {
                                this.error('missing:').nl().append(inspect(expected.exchanges[i]))
                                    .prependLinesWith(function () {
                                        this.error('//').sp();
                                    });
                            });
                        }
                    }
                });
                return { inline: true, diff: output };
            }
        }).addAssertion('messy.HttpConversation', '[not] to have number of exchanges', function (expect, subject, value) {
            expect(subject.exchanges, '[not] to have length', value);
        }).addAssertion('messy.HttpConversation', 'to [exhaustively] satisfy', function (expect, subject, value) {
            if (typeof value === 'undefined') {
                value = {};
            } else if (typeof value === 'string' || (typeof Buffer === 'function' && Buffer.isBuffer(value))) {
                value = new messy.HttpConversation(value);
            } else {
                value = value || {};
            }

            var numValueExchanges = 0;
            if (Array.isArray(value.exchanges)) {
                numValueExchanges = value.exchanges.length;
            } else if (value.exchanges && typeof value.exchanges === 'object') {
                var valueExchangesKeys = Object.keys(value.exchanges);
                if (valueExchangesKeys.length > 0) {
                    numValueExchanges = valueExchangesKeys.map(function (str) {
                        return parseInt(str, 10);
                    }).sort().pop() + 1;
                }
            }

            var promiseByKey = {
                exchanges: expect.promise(function () {
                    if (typeof value.exchanges !== 'undefined') {
                        expect(subject.exchanges, 'to be an array');
                        if (typeof value.exchanges === 'function') {
                            return expect(subject.exchanges, 'to satisfy', value.exchanges);
                        } else if (Array.isArray(value.exchanges)) {
                            expect(subject, 'to have number of exchanges', value.exchanges.length);
                        } else if (value.exchanges && typeof value.exchanges === 'object') {
                            expect(value.exchanges, 'to be an object whose keys satisfy', /^\d+/);
                        }
                    }
                })
            };

            if (!value.isMessyConversation && typeof value.exchanges !== 'undefined' && typeof value.exchanges !== 'function') {
                Object.keys(value.exchanges).forEach(function (key, i) {
                    promiseByKey[key] = expect.promise(function () {
                        if (i < subject.exchanges.length) {
                            return expect(subject.exchanges[key], 'to [exhaustively] satisfy', value.exchanges[key]);
                        } else {
                            var instanceAndSatisfySpec = convertSatisfySpecToInstance(value.exchanges[key], messy.HttpExchange);
                            return expect(instanceAndSatisfySpec.instance, 'to satisfy', instanceAndSatisfySpec.satisfySpec);
                        }
                    });
                });
            }

            return expect.promise.all(promiseByKey).caught(function (e) {
                if (!e || !e._isUnexpected) {
                    expect.fail(e);
                }
                return expect.promise.settle(promiseByKey).then(function () {
                    Object.keys(promiseByKey).forEach(function (key) {
                        if (promiseByKey[key].isRejected() && !promiseByKey[key].reason()._isUnexpected) {
                            expect.fail(promiseByKey[key].reason());
                        }
                    });
                    var err = cloneError(e);
                    err.createDiff = function (output, diff, inspect, equal) {
                        output.block(function () {
                            var output = this; // Sorry for shadowing
                            for (var i = 0 ; i < Math.max(subject.exchanges.length, numValueExchanges) ; i += 1) {
                                if (i > 0) {
                                    output.nl(2);
                                }

                                var exchangeSatisfyError = promiseByKey[i] && promiseByKey[i].isRejected() && promiseByKey[i].reason(),
                                    exchangeSatisfyDiff = exchangeSatisfyError && exchangeSatisfyError.createDiff && exchangeSatisfyError.createDiff(output.clone(), diff, inspect, equal);
                                if (i < subject.exchanges.length && i < numValueExchanges) {
                                    if (typeof value.exchanges !== 'function' && i in value.exchanges) {
                                        if (exchangeSatisfyDiff) {
                                            output.append(exchangeSatisfyDiff.diff);
                                        } else {
                                            output.append(inspect(subject.exchanges[i]));
                                            if (exchangeSatisfyError) {
                                                output.sp().error('// ' + (exchangeSatisfyError.label || 'should satisfy') + ' ').append(inspect(value.exchanges[i]));
                                            }
                                        }
                                    } else {
                                        output.append(inspect(subject.exchanges[i]));
                                    }
                                } else if (i < numValueExchanges) {
                                    output.annotationBlock(function () {
                                        this.error('missing:').nl();
                                        if (exchangeSatisfyDiff && exchangeSatisfyDiff.diff) {
                                            this.append(exchangeSatisfyDiff.diff);
                                        } else {
                                            this.append(inspect(convertSatisfySpecToInstance(value.exchanges[i], messy.HttpExchange).instance));
                                        }
                                    });
                                } else {
                                    output.annotationBlock(function () {
                                        this.error('should be removed:').nl().append(inspect(subject.exchanges[i]));
                                    });
                                }
                            }
                        });
                        return { inline: true, diff: output };
                    };
                    expect.fail(err);
                });
            });
        });
    }
};
