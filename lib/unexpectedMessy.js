const qs = require('qs');
const messy = require('messy');
const _ = require('underscore');
const isRegExp = require('./isRegExp');
const statusMessageByStatusCode = {
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
  418: "I'm a teapot",
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
  511: 'Network Authentication Required',
};

function omitUndefinedProperties(obj) {
  const result = {};
  Object.keys(obj).forEach(function (key) {
    if (typeof obj[key] !== 'undefined') {
      result[key] = obj[key];
    }
  });
  return result;
}

function sanitizeContentType(contentType) {
  return contentType && contentType.trim().replace(/\s*;.*$/, ''); // Strip charset etc.
}

function convertSatisfySpecToInstance(obj, Constructor) {
  const satisfySpec = {};

  let instance;
  if (obj instanceof Constructor) {
    instance = obj;
  } else if (!obj || typeof obj !== 'object') {
    instance = new Constructor(obj);
  } else {
    instance = new Constructor(
      (function traverse(obj, path) {
        if (Array.isArray(obj)) {
          return obj.map(function (item, i) {
            return traverse(item, path.concat(i));
          });
        } else if (Object.prototype.toString.call(obj) === '[object Error]') {
          const errorSpec = {};
          if (typeof obj.statusCode === 'number') {
            errorSpec.statusCode = obj.statusCode;
          }
          return errorSpec;
        } else if (
          obj &&
          typeof obj === 'object' &&
          !obj.isMessyHeaders &&
          Object.prototype.toString.call(obj) !== '[object RegExp]'
        ) {
          if (typeof Buffer !== 'undefined' && Buffer.isBuffer(obj)) {
            return obj;
          }
          if (obj.toJSON) {
            obj = obj.toJSON();
          }
          const result = {};
          Object.keys(obj).forEach(function (key) {
            const val = traverse(obj[key], path.concat(key));
            if (typeof val !== 'undefined') {
              result[key] = val;
            }
          });
          return result;
        } else if (
          typeof obj === 'string' ||
          typeof obj === 'number' ||
          typeof obj === 'boolean'
        ) {
          return obj;
        } else {
          let satisfySpecCursor = satisfySpec;
          for (let i = 0; i < path.length - 1; i += 1) {
            satisfySpecCursor = satisfySpecCursor[path[i]] =
              satisfySpecCursor[path[i]] || {};
          }
          satisfySpecCursor[path[path.length - 1]] = obj;
          return '';
        }
      })(obj, [])
    );
  }
  return { instance, satisfySpec };
}

function isAll7BitBuffer(buffer) {
  return !Array.prototype.some.call(buffer, function (octet) {
    return octet > 127;
  });
}

module.exports = {
  name: 'unexpected-messy',
  version: require('../package.json').version,
  installInto: function unexpectedMessy(expect) {
    expect = expect.child();

    function bubbleError(body) {
      return expect.withError(body, function (err) {
        err.errorMode = 'bubble';
        throw err;
      });
    }

    expect.use(require('magicpen-media'));

    expect.addStyle('messyHeaderValue', function (value) {
      if (typeof value === 'string') {
        this.text(value, 'cyan');
      } else {
        this.append(expect.inspect(value, null, this.clone()));
      }
    });

    expect.addStyle('messyHeader', function (name, value) {
      this.text(`${messy.formatHeaderName(name)}:`, 'gray')
        .text(' ')
        .messyHeaderValue(value);
    });

    expect.addStyle('messyMessageBody', function (message, depth) {
      let upgradedBody = message.body;
      const contentType = message.headers.get('Content-Type');
      if (
        typeof Buffer !== 'undefined' &&
        Buffer.isBuffer(upgradedBody) &&
        !contentType &&
        /^\s*form-data(?:\s|;|$)/.test(
          message.headers.get('Content-Disposition')
        ) &&
        isAll7BitBuffer(upgradedBody)
      ) {
        upgradedBody = upgradedBody.toString('utf-8');
      }
      if (message.isMultipart && Array.isArray(message.parts)) {
        message.parts.forEach(function (part) {
          this.text(`--${message.boundary}`, 'green')
            .nl()
            .appendInspected(part, depth)
            .nl();
        }, this);
        this.text(`--${message.boundary}--`, 'green');
      } else if (typeof upgradedBody === 'string') {
        if (contentType) {
          this.code(upgradedBody, sanitizeContentType(contentType));
        } else {
          this.text(upgradedBody);
        }
      } else {
        // Buffer instance or parsed JSON
        const majorContentType = contentType && contentType.replace(/\/.*/, '');
        if (
          typeof Buffer !== 'undefined' &&
          Buffer.isBuffer(upgradedBody) &&
          /^(?:audio|video|image)$/.test(majorContentType)
        ) {
          this.media(upgradedBody, {
            contentType: sanitizeContentType(contentType),
            link: true,
          });
        } else {
          this.appendInspected(upgradedBody, depth);
        }
      }
    });

    expect.exportType({
      name: 'messyHeaders',
      base: 'object',
      identify: function (obj) {
        return obj && obj.isMessyHeaders;
      },
      equal: function (headers1, headers2) {
        return headers1.equals(headers2);
      },
      inspect: function (headers, depth, output, inspect) {
        output.block(function () {
          let isFirst = true;
          headers.getNames().forEach(function (headerName) {
            headers.getAll(headerName).forEach(function (headerValue) {
              if (isFirst) {
                isFirst = false;
              } else {
                this.nl();
              }
              this.text(`${messy.formatHeaderName(headerName)}:`, 'gray')
                .sp()
                .text(headerValue, 'cyan');
            }, this);
          }, this);
        });
      },
      diff: function (actual, expected, output, diff, inspect, equal) {
        output.block(function (output) {
          let isFirstHeader = true;
          function outputHeader(name, value, suppressLeadingNewline) {
            output
              .nl(isFirstHeader || suppressLeadingNewline ? 0 : 1)
              .messyHeader(name, value);
            isFirstHeader = false;
            return output;
          }

          const remainingExpectedHeaders = expected.clone();

          const remainingActualHeaders = actual.clone();

          actual.getNames().forEach(function (headerName) {
            // First pass: Find exact matches
            let actualHeaderValues = actual.getAll(headerName);

            let actualHeaderValue;

            let i;
            for (i = 0; i < actualHeaderValues.length; i += 1) {
              actualHeaderValue = actualHeaderValues[i];
              if (
                remainingExpectedHeaders.remove(headerName, actualHeaderValue)
              ) {
                remainingActualHeaders.remove(headerName, actualHeaderValue);
                outputHeader(headerName, actualHeaderValue);
              }
            }
            // Second pass: Find changed headers
            actualHeaderValues = remainingActualHeaders.getAll(headerName);
            if (actualHeaderValues) {
              for (i = 0; i < actualHeaderValues.length; i += 1) {
                actualHeaderValue = actualHeaderValues[i];
                outputHeader(headerName, actualHeaderValue);
                if (remainingExpectedHeaders.has(headerName)) {
                  const expectedHeaderValue =
                    remainingExpectedHeaders.get(headerName);
                  output
                    .sp(actualHeaderValue === '' ? 0 : 1)
                    .error('// should be ')
                    .text(expectedHeaderValue);
                  remainingExpectedHeaders.remove(
                    headerName,
                    expectedHeaderValue
                  );
                } else {
                  output
                    .sp(actualHeaderValue === '' ? 0 : 1)
                    .error('// should be removed');
                }
              }
            }
          });
          // All the headers remaining in remainingExpectedHeaders are missing:
          remainingExpectedHeaders.getNames().forEach(function (headerName) {
            remainingExpectedHeaders
              .getAll(headerName)
              .forEach(function (headerValue) {
                output.nl(isFirstHeader ? 0 : 1).error('// missing ');
                isFirstHeader = false;
                outputHeader(headerName, headerValue, true);
              });
          });
        });
        return output;
      },
    });

    expect.exportAssertion(
      '<messyHeaders> to [exhaustively] satisfy <regexp>',
      function (expect, subject, value) {
        return expect(subject.toString(), 'to match', value);
      }
    );

    expect.exportAssertion(
      '<messyHeaders> to [exhaustively] satisfy <any>',
      function (expect, subject, value) {
        const expectedHeaders =
          value && value.isMessyHeaders
            ? value
            : new messy.Headers(value, true);

        const promiseByKey = {
          headersPresent: expect.promise(function () {
            if (value && typeof value === 'object') {
              (value.isMessyHeaders
                ? value.getNames()
                : Object.keys(value)
              ).forEach(function (headerName) {
                if (
                  !value.isMessyHeaders &&
                  typeof value[headerName] === 'undefined'
                ) {
                  expect(subject.has(headerName), 'to be false');
                } else {
                  expect(subject.has(headerName), 'to be true');
                }
              });
            }
            if (expect.flags.exhaustively) {
              subject.getNames().forEach(function (headerName) {
                expect(expectedHeaders.has(headerName), 'to be true');
              });
            }
          }),
          headers: {},
        };

        const promisesByHeaderNameAndValue = {};
        subject.getNames().forEach(function (headerName) {
          let satisfySpecs = expectedHeaders.getAll(headerName);
          if (!satisfySpecs || satisfySpecs.length === 0) {
            return;
          }
          satisfySpecs = satisfySpecs.map(function (satisfySpec) {
            if (
              typeof satisfySpec !== 'undefined' &&
              typeof satisfySpec !== 'object' &&
              typeof satisfySpec !== 'function'
            ) {
              return String(satisfySpec);
            } else {
              return satisfySpec;
            }
          });
          const promisesByHeaderValue = (promisesByHeaderNameAndValue[
            headerName
          ] = {});
          subject.getAll(headerName).forEach(function (headerValue) {
            if (promisesByHeaderValue[headerValue]) {
              // Duplicate value
            } else {
              promisesByHeaderValue[headerValue] = satisfySpecs.map(function (
                satisfySpec
              ) {
                return expect.promise(function () {
                  return expect(headerValue, 'to satisfy', satisfySpec);
                });
              });
            }
          });

          if (expect.flags.exhaustively) {
            promiseByKey.headers[headerName] = expect.promise.all(
              Object.keys(promisesByHeaderValue).map(function (headerValue) {
                return expect.promise.any(promisesByHeaderValue[headerValue]);
              })
            );
          } else {
            promiseByKey.headers[headerName] = expect.promise.all(
              satisfySpecs.map(function (satisfySpec, i) {
                return expect.promise.any(
                  Object.keys(promisesByHeaderValue).map(function (
                    headerValue
                  ) {
                    return promisesByHeaderValue[headerValue][i];
                  })
                );
              })
            );
          }
        });

        return expect.promise.all(promiseByKey).caught(function () {
          return expect.promise.settle(promiseByKey).then(function (promises) {
            expect.fail({
              diff: function (output, diff, inspect, equal) {
                const remainingSatisfySpecPromisesByHeaderNameAndValue = {};
                Object.keys(promisesByHeaderNameAndValue).forEach(function (
                  headerName
                ) {
                  remainingSatisfySpecPromisesByHeaderNameAndValue[headerName] =
                    {};
                  Object.keys(promisesByHeaderNameAndValue[headerName]).forEach(
                    function (headerValue) {
                      remainingSatisfySpecPromisesByHeaderNameAndValue[
                        headerName
                      ][headerValue] = [].concat(
                        promisesByHeaderNameAndValue[headerName][headerValue]
                      );
                    }
                  );
                });

                output.block(function (output) {
                  let isFirstHeader = true;
                  function outputHeader(name, value, suppressLeadingNewline) {
                    output
                      .nl(isFirstHeader || suppressLeadingNewline ? 0 : 1)
                      .messyHeader(name, value);
                    isFirstHeader = false;
                    return output;
                  }

                  const remainingExpectedHeaders =
                    value && value.isMessyHeaders
                      ? value.clone()
                      : new messy.Headers(value, true);

                  const remainingSubjectHeaders = subject.clone();

                  subject.getNames().forEach(function (headerName) {
                    // First pass: Find exact matches
                    let subjectHeaderValues = subject.getAll(headerName);

                    let subjectHeaderValue;

                    let i;
                    for (i = 0; i < subjectHeaderValues.length; i += 1) {
                      subjectHeaderValue = subjectHeaderValues[i];
                      if (remainingExpectedHeaders.has(headerName)) {
                        for (
                          let j = 0;
                          j <
                          remainingExpectedHeaders.getAll(headerName).length;
                          j += 1
                        ) {
                          if (
                            remainingSatisfySpecPromisesByHeaderNameAndValue[
                              headerName
                            ][subjectHeaderValue][j].isFulfilled()
                          ) {
                            outputHeader(headerName, subjectHeaderValue);
                            remainingSubjectHeaders.remove(headerName, i);
                            remainingExpectedHeaders.remove(headerName, j);
                            remainingSatisfySpecPromisesByHeaderNameAndValue[
                              headerName
                            ][subjectHeaderValue].splice(j, 1);
                            break;
                          }
                        }
                      }
                    }
                    // Second pass: Find changed headers
                    subjectHeaderValues =
                      remainingSubjectHeaders.getAll(headerName);
                    if (subjectHeaderValues) {
                      for (i = 0; i < subjectHeaderValues.length; i += 1) {
                        subjectHeaderValue = subjectHeaderValues[i];
                        outputHeader(headerName, subjectHeaderValue);
                        if (remainingExpectedHeaders.has(headerName)) {
                          const expectedHeaderValue =
                            remainingExpectedHeaders.get(headerName); // Will be the first if multiple
                          if (typeof expectedHeaderValue === 'undefined') {
                            output
                              .sp(subjectHeaderValue === '' ? 0 : 1)
                              .error('// should be removed');
                          } else {
                            const promise =
                              remainingSatisfySpecPromisesByHeaderNameAndValue[
                                headerName
                              ][subjectHeaderValue][i];
                            if (promise.isRejected()) {
                              const e = promise.reason();
                              output
                                .sp(subjectHeaderValue === '' ? 0 : 1)
                                .annotationBlock(function () {
                                  this.error(
                                    `${e.getLabel() || 'should satisfy'} `
                                  ).messyHeaderValue(expectedHeaderValue);
                                  const diff = e.getDiff(output);
                                  if (diff) {
                                    this.nl(2).block(diff);
                                  }
                                });
                            }
                            remainingExpectedHeaders.remove(headerName, 0);
                            remainingSatisfySpecPromisesByHeaderNameAndValue[
                              headerName
                            ][subjectHeaderValue].shift();
                          }
                        } else if (expect.flags.exhaustively) {
                          output
                            .sp(subjectHeaderValue === '' ? 0 : 1)
                            .error('// should be removed');
                        }
                      }
                    }
                  });
                  // All the headers remaining in remainingExpectedHeaders are missing,
                  // except the ones with a value of undefined:
                  remainingExpectedHeaders
                    .getNames()
                    .forEach(function (headerName) {
                      remainingExpectedHeaders
                        .getAll(headerName)
                        .forEach(function (headerValue) {
                          if (typeof headerValue !== 'undefined') {
                            output
                              .nl(isFirstHeader ? 0 : 1)
                              .error('// missing ');
                            outputHeader(headerName, headerValue, true);
                            isFirstHeader = false;
                          }
                        });
                    });
                });
                return output;
              },
            });
          });
        });
      }
    );

    expect.exportType({
      name: 'messyMessage',
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
            this.messyMessageBody(message, depth);
          }
        });
      },
      diff: function (actual, expected, output, diff, inspect, equal) {
        output.block(function (output) {
          output.append(diff(actual.headers, expected.headers));

          if (!actual.hasEmptyBody() || !expected.hasEmptyBody()) {
            output.nl(2);
            const bodyDiff = diff(actual.body, expected.body);
            if (bodyDiff) {
              output.append(bodyDiff);
            } else {
              output.messyMessageBody(actual);
            }
          }
        });
        return output;
      },
    });

    expect.exportAssertion(
      '<messyMessage> to [exhaustively] satisfy <undefined>',
      function (expect, subject, value) {
        return expect(subject, 'to [exhaustively] satisfy', {});
      }
    );

    expect.exportAssertion(
      '<messyMessage> to [exhaustively] satisfy <string|Buffer>',
      function (expect, subject, value) {
        return expect(
          subject,
          'to [exhaustively] satisfy',
          omitUndefinedProperties(
            _.pick(
              new messy.Message(value),
              _.difference(messy.Message.propertyNames, [
                'decodedBody',
                'unchunkedBody',
                'parts',
                'rawBody',
              ])
            )
          )
        );
      }
    );

    expect.exportAssertion(
      '<messyMessage> to [exhaustively] satisfy <object>',
      function (expect, subject, value) {
        const promiseByKey = {
          headers: expect.promise(function () {
            if ('headers' in value) {
              return expect(
                subject.headers,
                'to [exhaustively] satisfy',
                value.headers
              );
            }
          }),
          body: expect.promise(function () {
            if ('body' in value) {
              if (subject.isJson && typeof value.body === 'string') {
                return expect(subject.decodedBody, 'to satisfy', value.body);
              } else if (
                subject.isJson &&
                typeof Buffer === 'function' &&
                Buffer.isBuffer(value.body)
              ) {
                return expect(subject.unchunkedBody, 'to satisfy', value.body);
              } else if (
                typeof value.body === 'string' &&
                typeof Buffer !== 'undefined' &&
                Buffer.isBuffer(subject.body) &&
                !subject.headers.get('Content-Type') &&
                /^\s*form-data(?:\s|;|$)/.test(
                  subject.headers.get('Content-Disposition')
                ) &&
                isAll7BitBuffer(subject.body)
              ) {
                return expect(
                  subject.unchunkedBody.toString('utf-8'),
                  'to satisfy',
                  value.body
                );
              } else {
                return expect(subject.body, 'to satisfy', value.body);
              }
            } else if (expect.flags.exhaustively) {
              expect(subject.hasEmptyBody(), 'to be true');
            }
          }),
        };

        if (value && typeof value === 'object' && !value.isMessyMessage) {
          const unsupportedKeys = Object.keys(value).filter(function (key) {
            return messy.Message.propertyNames.indexOf(key) === -1; // key !== 'body' && key !== 'fileName' && key !== 'rawBody' && key !== 'unchunkedBody' && key !== 'text' && key !== 'headers' && key !== 'parts';
          });
          if (unsupportedKeys.length > 0) {
            throw new Error(
              `messy.Message to satisfy: Unsupported keys: ${unsupportedKeys.join(
                ', '
              )}`
            );
          }

          promiseByKey.fileName = expect.promise(function () {
            if ('fileName' in value) {
              return expect(
                subject,
                'to have file name satisfying',
                value.fileName
              );
            }
          });
          promiseByKey.rawBody = expect.promise(function () {
            if ('rawBody' in value) {
              return expect(
                subject,
                'to have raw body satisfying',
                value.rawBody
              );
            }
          });
          promiseByKey.unchunkedBody = expect.promise(function () {
            if ('unchunkedBody' in value) {
              return expect(
                subject,
                'to have unchunked body satisfying',
                value.unchunkedBody
              );
            }
          });
          promiseByKey.text = expect.promise(function () {
            if ('text' in value) {
              return expect(subject.toString(), 'to equal', value.text);
            }
          });

          if (
            typeof value.parts !== 'undefined' &&
            typeof value.parts !== 'function'
          ) {
            Object.keys(value.parts).forEach(function (key) {
              promiseByKey[key] = expect.promise(function () {
                return expect(
                  subject.parts && subject.parts[key],
                  'to satisfy',
                  value.parts[key]
                );
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
                Object.keys(value.parts).forEach(function (key) {
                  expect(key, 'to match', /^\d+/);
                });
              }
            }
          });
        }

        return expect.promise.all(promiseByKey).caught(function () {
          return expect.promise.settle(promiseByKey).then(function () {
            expect.fail({
              diff: function (output, diff, inspect, equal) {
                output.block(function (output) {
                  if (promiseByKey.headers.isRejected()) {
                    const comparison = promiseByKey.headers
                      .reason()
                      .getDiff(output);
                    if (comparison) {
                      output.append(comparison);
                    }
                  } else {
                    output.append(inspect(subject.headers));
                  }
                  const bodySatisfyError =
                    promiseByKey.body.isRejected() &&
                    promiseByKey.body.reason();

                  const bodyDiff =
                    bodySatisfyError && bodySatisfyError.getDiff(output);

                  if (bodyDiff) {
                    output.nl(2).append(bodyDiff);
                  } else if (!subject.hasEmptyBody()) {
                    output.nl(2);
                    if (subject.isMultipart) {
                      subject.parts.forEach(function (part, i) {
                        output.text(`--${subject.boundary}`, 'green').nl();
                        const partSatisfyError =
                          promiseByKey[i] &&
                          promiseByKey[i].isRejected() &&
                          promiseByKey[i].reason();

                        const partSatisfyDiff =
                          partSatisfyError && partSatisfyError.getDiff(output);
                        if (
                          typeof value.parts !== 'function' &&
                          i in value.parts
                        ) {
                          if (partSatisfyDiff) {
                            output.append(partSatisfyDiff);
                          } else {
                            output.append(inspect(part));
                            if (partSatisfyError) {
                              output
                                .sp()
                                .error(
                                  `// ${
                                    partSatisfyError.getLabel() ||
                                    'should satisfy'
                                  } `
                                )
                                .append(inspect(value.parts[i]));
                            }
                          }
                        } else {
                          output.append(inspect(part));
                        }
                        output.nl();
                      });
                      output.text(`--${subject.boundary}--`, 'green');
                    } else {
                      output.messyMessageBody(subject);
                    }
                    if (bodySatisfyError) {
                      output
                        .sp()
                        .error(
                          `// ${
                            bodySatisfyError.getLabel() || 'should satisfy'
                          } `
                        )
                        .append(inspect(value.body));
                    }
                  } else if (bodySatisfyError) {
                    output
                      .nl(2)
                      .error(
                        `// ${bodySatisfyError.getLabel() || 'should satisfy'} `
                      )
                      .append(inspect(value.body));
                  } else if (
                    expect.flags.exhaustively &&
                    !subject.hasEmptyBody()
                  ) {
                    this.messyMessageBody(subject);
                    output.sp().error('// should be removed');
                  }

                  if (
                    promiseByKey.fileName &&
                    promiseByKey.fileName.isRejected()
                  ) {
                    const fileNameError = promiseByKey.fileName.reason();
                    output
                      .nl()
                      .error('// should have file name satisfying')
                      .sp()
                      .append(inspect(value.fileName));
                    const fileNameDiff = fileNameError.getDiff(output);
                    if (fileNameDiff) {
                      output.nl().append(fileNameDiff);
                    }
                  }

                  if (promiseByKey.text && promiseByKey.text.isRejected()) {
                    const textError = promiseByKey.text.reason();
                    output.nl().annotationBlock(function () {
                      this.error('should have text satisfying')
                        .sp()
                        .append(inspect(value.text));
                      const textDiff = textError.getDiff(output);
                      if (textDiff) {
                        output.nl().append(textDiff);
                      }
                    });
                  }

                  if (
                    promiseByKey.rawBody &&
                    promiseByKey.rawBody.isRejected()
                  ) {
                    const rawBodyError = promiseByKey.rawBody.reason();
                    output.nl().annotationBlock(function () {
                      this.error('should have raw body satisfying')
                        .sp()
                        .append(inspect(value.rawBody));
                      const rawBodyDiff = rawBodyError.getDiff(output);
                      if (rawBodyDiff) {
                        this.nl().append(rawBodyDiff);
                      }
                    });
                  }
                  if (
                    promiseByKey.unchunkedBody &&
                    promiseByKey.unchunkedBody.isRejected()
                  ) {
                    const unchunkedBodyError =
                      promiseByKey.unchunkedBody.reason();
                    output.nl().annotationBlock(function () {
                      this.error('should have unchunked body satisfying')
                        .sp()
                        .append(inspect(value.unchunkedBody));
                      const unchunkedBodyDiff =
                        unchunkedBodyError.getDiff(output);
                      if (unchunkedBodyDiff) {
                        this.nl().append(unchunkedBodyDiff);
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
                      if (
                        !subject.parts ||
                        value.parts.length !== subject.parts.length
                      ) {
                        output.nl().annotationBlock(function () {
                          this.error('should have number of parts')
                            .sp()
                            .jsNumber(value.parts.length);
                        });
                      }
                    } else if (typeof value.parts === 'function') {
                      if (promiseByKey.parts.isRejected()) {
                        const partsError = promiseByKey.parts.reason();
                        output
                          .nl()
                          .annotationBlock(partsError.getDiffMessage(output));
                      }
                    } else if (value.parts && typeof value.parts === 'object') {
                      const nonNumericPartIds = Object.keys(value.parts).filter(
                        function (partId) {
                          return !/^\d+/.test(partId);
                        }
                      );
                      if (nonNumericPartIds.length > 0) {
                        output.nl().annotationBlock(function () {
                          this.error('invalid part specifier(s):').sp();
                          nonNumericPartIds.forEach(function (partId, i) {
                            if (i > 0) {
                              output.text(',').sp();
                            }
                            this.append(inspect(partId));
                          }, this);
                        });
                      }
                    }
                  }
                });
                return output;
              },
            });
          });
        });
      }
    );

    expect.exportAssertion(
      '<messyMessage> to have raw body satisfying <any>',
      function (expect, subject, value) {
        expect(subject.rawBody, 'to satisfy', value);
      }
    );

    expect.exportAssertion(
      '<messyMessage> to have unchunked body satisfying <any>',
      function (expect, subject, value) {
        expect(subject.unchunkedBody, 'to satisfy', value);
      }
    );

    expect.exportAssertion(
      '<messyMessage> to have file name satisfying <any>',
      function (expect, subject, value) {
        expect(subject.fileName, 'to satisfy', value);
      }
    );

    expect.exportAssertion(
      '<messyMessage> to have text satisfying <any>',
      function (expect, subject, value) {
        expect(subject.toString(), 'to satisfy', value);
      }
    );

    expect.exportAssertion(
      '<messyMessage> [not] to be a multipart message',
      function (expect, subject) {
        expect(subject.isMultipart, '[not] to be truthy');
      }
    );

    expect.exportAssertion(
      '<messyMessage> [not] to have number of parts <number>',
      function (expect, subject, value) {
        expect(subject.parts, '[not] to have length', value);
      }
    );

    expect.exportType({
      name: 'messyRequestLine',
      base: 'object',
      identify: function (obj) {
        return obj && obj.isMessyRequestLine;
      },
      equal: function (requestLine1, requestLine2) {
        return requestLine1.equals(requestLine2);
      },
      inspect: function (requestLine, depth, output, inspect) {
        let isFirstFragment = true;
        if (requestLine.method) {
          isFirstFragment = false;
          output.text(requestLine.method, 'blue');
        }
        if (requestLine.url) {
          output.sp(isFirstFragment ? 0 : 1).text(requestLine.url, 'gray');
          isFirstFragment = false;
        }
        if (
          typeof requestLine.protocolName !== 'undefined' ||
          typeof requestLine.protocolVersion !== 'undefined'
        ) {
          output.sp(isFirstFragment ? 0 : 1);
          if (typeof requestLine.protocolName !== 'undefined') {
            output.text(requestLine.protocolName, 'blue');
          }
          if (typeof requestLine.protocolVersion !== 'undefined') {
            output.text(`/${requestLine.protocolVersion}`, 'cyan');
          }
        }
        return output;
      },
      diff: function (actual, expected, output, diff, inspect, equal) {
        output.append(inspect(actual));
        if (!equal(actual, expected)) {
          const shouldBeFragments = [];
          ['method', 'url', 'protocol'].forEach(function (propertyName) {
            if (
              shouldBeFragments.length > 0 ||
              actual[propertyName] !== expected[propertyName]
            ) {
              shouldBeFragments.push(expected[propertyName]);
            }
          });
          const error = output.clone().annotationBlock(function () {
            this.error('should be')
              .sp()
              .text(shouldBeFragments.join(' '))
              .nl(2)
              .append(diff(actual.toString(), expected.toString()));
          });
          if (
            error.size().width + output.size().width + 1 >
            output.preferredWidth
          ) {
            output.nl();
          } else {
            output.sp();
          }
          output.append(error);
        }
        return output;
      },
    });

    expect.exportAssertion(
      '<messyRequestLine> to satisfy <undefined>',
      function (expect, subject, value) {
        return expect(subject, 'to [exhaustively] satisfy', {});
      }
    );

    expect.exportAssertion(
      '<messyRequestLine> to satisfy <string>',
      function (expect, subject, value) {
        return expect(
          subject,
          'to [exhaustively] satisfy',
          omitUndefinedProperties(
            _.pick(
              new messy.RequestLine(value),
              messy.RequestLine.propertyNames
            )
          )
        );
      }
    );

    expect.exportAssertion(
      '<messyRequestLine> to satisfy <object>',
      function (expect, subject, value) {
        const promiseByKey = {};
        Object.keys(value).forEach(function (key) {
          promiseByKey[key] = expect.promise(function () {
            if (key === 'query') {
              const queryStr = subject.query;
              if (
                value.query &&
                (typeof value.query === 'object' ||
                  typeof value.query === 'function')
              ) {
                return expect(qs.parse(queryStr), 'to satisfy', value.query);
              } else if (typeof value.query === 'undefined') {
                expect(queryStr, 'to equal', '');
              } else {
                return expect(queryStr, 'to equal', value.query);
              }
            } else {
              return expect(subject[key], 'to satisfy', value[key]);
            }
          });
        });
        return expect.promise.all(promiseByKey).caught(function () {
          return expect.promise.settle(promiseByKey).then(function () {
            expect.fail({
              diff: function (output, diff, inspect, equal) {
                if (typeof value !== 'object') {
                  value = new messy.RequestLine(value);
                }
                output.appendInspected(subject);
                const error = output.clone().annotationBlock(function () {
                  if (
                    messy.RequestLine.propertyNames.some(function (
                      propertyName
                    ) {
                      const type = typeof value[propertyName];
                      return (
                        type === 'function' ||
                        type === 'object' ||
                        isRegExp(value[propertyName])
                      );
                    })
                  ) {
                    // Complex case: At least one property matched against an expect.it or regexp.
                    // Render the failing properties one by one, along with the associated diffs (if available):
                    Object.keys(promiseByKey).forEach(function (propertyName) {
                      const promise = promiseByKey[propertyName];
                      const error =
                        promise && promise.isRejected() && promise.reason();
                      if (error) {
                        this.error(propertyName).sp();
                        const type = typeof value[propertyName];
                        if (
                          type === 'function' ||
                          type === 'object' ||
                          isRegExp(value[propertyName])
                        ) {
                          this.error('should satisfy')
                            .sp()
                            .appendInspected(value[propertyName]);
                          const diff = error.getDiff(output);
                          if (diff) {
                            this.nl(2).append(diff);
                          }
                        } else {
                          this.error('should be')
                            .sp()
                            .appendInspected(value[propertyName]);
                        }
                      }
                    }, this);
                  } else {
                    // Simple case, render a regular diff
                    const shouldBeRequestLine = new messy.RequestLine(value);
                    this.error('should be')
                      .sp()
                      .append(inspect(shouldBeRequestLine))
                      .nl(2)
                      .append(
                        diff(
                          subject.toString(),
                          _.defaults(
                            shouldBeRequestLine.clone(),
                            _.pick(
                              subject,
                              messy.RequestLine.nonComputedPropertyNames
                            )
                          ).toString()
                        )
                      );
                  }
                });
                if (
                  error.size().width + output.size().width + 1 >
                  output.preferredWidth
                ) {
                  output.nl();
                } else {
                  output.sp();
                }
                output.append(error);
                return output;
              },
            });
          });
        });
      }
    );

    expect.exportType({
      name: 'messyHttpRequest',
      base: 'messyMessage',
      identify: function (obj) {
        return obj && obj.isMessyHttpRequest;
      },
      equal: function (httpRequest1, httpRequest2) {
        return httpRequest1.equals(httpRequest2);
      },
      inspect: function (httpRequest, depth, output, inspect) {
        const baseType = this.baseType;
        return output.block(function () {
          this.append(inspect(httpRequest.requestLine, depth));
          if (httpRequest.headers.getNames().length > 0) {
            this.nl();
          } else if (!httpRequest.hasEmptyBody()) {
            this.nl(2);
          }
          this.append(
            baseType.inspect(httpRequest, depth, output.clone(), inspect)
          );
        });
      },
      diff: function (actual, expected, output, diff, inspect, equal) {
        const baseType = this.baseType;
        output.block(function () {
          this.append(diff(actual.requestLine, expected.requestLine))
            .nl()
            .append(
              baseType.diff(
                actual,
                expected,
                output.clone(),
                diff,
                inspect,
                equal
              )
            );
          const actualMetadata = _.pick(
            actual,
            messy.HttpRequest.metadataPropertyNames
          );

          const expectedMetadata = _.pick(
            expected,
            messy.HttpRequest.metadataPropertyNames
          );
          if (!equal(actualMetadata, expectedMetadata)) {
            this.nl()
              .text('Metadata:')
              .sp()
              .append(diff(actualMetadata, expectedMetadata));
          }
        });
        return output;
      },
    });

    expect.exportAssertion(
      '<messyHttpRequest> to [exhaustively] satisfy <undefined>',
      function (expect, subject, value) {
        return expect(subject, 'to [exhaustively] satisfy', {});
      }
    );

    expect.exportAssertion(
      '<messyHttpRequest> to [exhaustively] satisfy <string|Buffer>',
      function (expect, subject, value) {
        return expect(
          subject,
          'to [exhaustively] satisfy',
          omitUndefinedProperties(
            _.pick(
              new messy.HttpRequest(value),
              _.difference(messy.HttpRequest.propertyNames, [
                'decodedBody',
                'unchunkedBody',
                'parts',
                'rawBody',
              ])
            )
          )
        );
      }
    );

    expect.exportAssertion(
      '<messyHttpRequest> to [exhaustively] satisfy <object>',
      function (expect, subject, value) {
        const requestLineSpec = _.pick(value, messy.RequestLine.propertyNames);

        const messageValue = _.extend({}, value);
        delete messageValue.requestLine;

        messy.HttpRequest.metadataPropertyNames.forEach(function (
          metadataPropertyName
        ) {
          delete messageValue[metadataPropertyName];
        });
        Object.keys(requestLineSpec).forEach(function (requestLineKey) {
          delete messageValue[requestLineKey];
        });
        const promiseByKey = {
          message: expect.promise(function () {
            return expect(
              Object.create(subject, { isMessyHttpRequest: { value: false } }),
              'to [exhaustively] satisfy',
              messageValue
            );
          }),
          requestLine: expect.promise(function () {
            if ('requestLine' in value) {
              return expect(
                subject.requestLine,
                'to satisfy',
                value.requestLine
              );
            }
          }),
          requestLineSpec: expect.promise(function () {
            // Make the RequestLine properties available for matching:
            return expect(subject.requestLine, 'to satisfy', requestLineSpec);
          }),
        };

        messy.HttpRequest.metadataPropertyNames.forEach(function (
          metadataPropertyName
        ) {
          promiseByKey[metadataPropertyName] = expect.promise(function () {
            if (metadataPropertyName in value) {
              return bubbleError(function () {
                return expect(
                  subject[metadataPropertyName],
                  'to satisfy',
                  value[metadataPropertyName]
                );
              });
            }
          });
        });

        return expect.promise.all(promiseByKey).caught(function () {
          return expect.promise.settle(promiseByKey).then(function () {
            expect.fail({
              diff: function (output, diff, inspect, equal) {
                output.block(function (output) {
                  let requestLineDiff;
                  if (promiseByKey.requestLine.isRejected()) {
                    const requestLineError = promiseByKey.requestLine.reason();
                    requestLineDiff = requestLineError.getDiff(output);
                    if (requestLineDiff) {
                      output.append(requestLineDiff);
                    } else {
                      output.annotationBlock(
                        requestLineError.getErrorMessage(output)
                      );
                    }
                  } else if (promiseByKey.requestLineSpec.isRejected()) {
                    const requestLineSpecError =
                      promiseByKey.requestLineSpec.reason();
                    requestLineDiff = requestLineSpecError.getDiff(output);
                    if (requestLineDiff) {
                      output.append(requestLineDiff);
                    } else {
                      output.annotationBlock(
                        requestLineSpecError.getErrorMessage(output)
                      );
                    }
                  } else {
                    output.append(inspect(subject.requestLine));
                  }
                  output.nl();
                  if (promiseByKey.message.isRejected()) {
                    const messageError = promiseByKey.message.reason();
                    requestLineDiff = messageError.getDiff(output);
                    if (requestLineDiff) {
                      output.append(requestLineDiff);
                    } else {
                      output.annotationBlock(
                        messageError.getErrorMessage(output)
                      );
                    }
                  } else {
                    output.append(
                      expect
                        .findTypeOf(new messy.Message())
                        .inspect(subject, 3, output.clone(), inspect, equal)
                    );
                  }
                  messy.HttpRequest.metadataPropertyNames.forEach(function (
                    metadataPropertyName
                  ) {
                    const metadataPropertyError =
                      promiseByKey[metadataPropertyName].isRejected() &&
                      promiseByKey[metadataPropertyName].reason();
                    if (metadataPropertyError) {
                      if (
                        metadataPropertyName === 'encrypted' &&
                        value.encrypted === true
                      ) {
                        output.nl().error('// expected an encrypted request');
                      } else if (
                        metadataPropertyName === 'encrypted' &&
                        value.encrypted === false
                      ) {
                        output.nl().error('// expected an unencrypted request');
                      } else {
                        output.nl().annotationBlock(function () {
                          this.text(metadataPropertyName)
                            .text(':')
                            .sp()
                            .append(
                              metadataPropertyError.getErrorMessage(output)
                            );
                        });
                      }
                    }
                  });
                });
                return output;
              },
            });
          });
        });
      }
    );

    expect.exportType({
      name: 'messyStatusLine',
      base: 'object',
      identify: function (obj) {
        return obj && obj.isMessyStatusLine;
      },
      equal: function (statusLine1, statusLine2) {
        return statusLine1.equals(statusLine2);
      },
      inspect: function (statusLine, depth, output, inspect) {
        let isFirstFragment = true;
        if (
          typeof statusLine.protocolName !== 'undefined' ||
          typeof statusLine.protocolVersion !== 'undefined'
        ) {
          if (typeof statusLine.protocolName !== 'undefined') {
            output.text(statusLine.protocolName, 'blue');
          }
          if (typeof statusLine.protocolVersion !== 'undefined') {
            output.text(`/${statusLine.protocolVersion}`, 'cyan');
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
          output
            .sp(isFirstFragment ? 0 : 1)
            .text(statusLine.statusMessage, 'yellow');
        }
        return output;
      },
      diff: function (actual, expected, output, diff, inspect, equal) {
        output.append(inspect(actual));
        if (!equal(actual, expected)) {
          const shouldBeFragments = [];
          ['protocol', 'statusCode', 'statusMessage'].forEach(function (
            propertyName
          ) {
            if (
              typeof expected[propertyName] !== 'undefined' &&
              (shouldBeFragments.length > 0 ||
                actual[propertyName] !== expected[propertyName])
            ) {
              shouldBeFragments.push(expected[propertyName]);
            }
          });
          const error = output.clone().annotationBlock(function () {
            this.error('should be')
              .sp()
              .text(shouldBeFragments.join(' '))
              .nl(2)
              .append(diff(actual.toString(), expected.toString()));
          });
          if (
            error.size().width + output.size().width + 1 >
            output.preferredWidth
          ) {
            output.nl();
          } else {
            output.sp();
          }
          output.append(error);
        }
        return output;
      },
    });

    expect.exportAssertion(
      '<messyStatusLine> to [exhaustively] satisfy <undefined>',
      function (expect, subject, value) {
        return expect(subject, 'to [exhaustively] satisfy', {});
      }
    );

    expect.exportAssertion(
      '<messyStatusLine> to [exhaustively] satisfy <string>',
      function (expect, subject, value) {
        return expect(
          subject,
          'to [exhaustively] satisfy',
          omitUndefinedProperties(
            _.pick(new messy.StatusLine(value), messy.StatusLine.propertyNames)
          )
        );
      }
    );

    expect.exportAssertion(
      '<messyStatusLine> to [exhaustively] satisfy <number>',
      function (expect, subject, value) {
        if (subject.statusCode !== value) {
          expect.fail({
            diff: function (output, diff, inspect, equal) {
              return output
                .append(inspect(subject))
                .sp()
                .annotationBlock(function () {
                  this.error('should be').sp().append(inspect(value));
                  if (statusMessageByStatusCode[value]) {
                    this.sp().text(statusMessageByStatusCode[value]);
                  }
                });
            },
          });
        }
      }
    );

    expect.exportAssertion(
      '<messyStatusLine> to [exhaustively] satisfy <function|object>',
      function (expect, subject, value) {
        return expect.withError(
          function () {
            if (typeof value === 'function') {
              return expect(subject.statusCode, 'to satisfy', value);
            } else if (value && typeof value === 'object') {
              return expect(
                _.pick(subject, messy.StatusLine.propertyNames),
                'to satisfy',
                _.pick(value, messy.StatusLine.propertyNames)
              );
            } else {
              return expect(subject.toString(), 'to satisfy', value);
            }
          },
          function (err) {
            expect.fail({
              diff: function (output, diff, inspect, equal) {
                output.append(inspect(subject));
                const error = output.clone().annotationBlock(function () {
                  if (
                    typeof value === 'number' ||
                    typeof value === 'function'
                  ) {
                    if (value._expectIt) {
                      const comparison = err.getDiff(output);
                      if (comparison) {
                        this.append(comparison);
                      }
                    } else {
                      this.error(err.getLabel() || 'should satisfy')
                        .sp()
                        .append(inspect(value));
                    }
                  } else if (
                    messy.StatusLine.propertyNames.some(function (
                      propertyName
                    ) {
                      return (
                        typeof value[propertyName] === 'function' ||
                        isRegExp(value[propertyName])
                      );
                    })
                  ) {
                    this.error('should satisfy').sp().append(inspect(value));
                  } else {
                    const expectedStatusLine = new messy.StatusLine(value);
                    if (
                      typeof expectedStatusLine.statusMessage === 'undefined' &&
                      typeof subject.statusMessage !== 'undefined'
                    ) {
                      expectedStatusLine.statusMessage =
                        statusMessageByStatusCode[
                          expectedStatusLine.statusCode
                        ];
                    }
                    this.error('should be')
                      .sp()
                      .append(inspect(expectedStatusLine))
                      .nl(2)
                      .append(
                        diff(
                          subject.toString(),
                          _.defaults(
                            expectedStatusLine.clone(),
                            _.pick(
                              subject,
                              messy.StatusLine.nonComputedPropertyNames
                            )
                          ).toString()
                        )
                      );
                  }
                });
                if (
                  error.size().width + output.size().width + 1 >
                  output.preferredWidth
                ) {
                  output.nl();
                } else {
                  output.sp();
                }
                output.append(error);
                return output;
              },
            });
          }
        );
      }
    );

    expect.exportType({
      name: 'messyHttpResponse',
      base: 'messyMessage',
      equal: function (httpResponse1, httpResponse2) {
        return httpResponse1.equals(httpResponse2);
      },
      identify: function (obj) {
        return obj && obj.isMessyHttpResponse;
      },
      inspect: function (httpResponse, depth, output, inspect) {
        const baseType = this.baseType;
        return output.block(function () {
          this.append(inspect(httpResponse.statusLine, depth));
          if (httpResponse.headers.getNames().length > 0) {
            this.nl();
          } else if (!httpResponse.hasEmptyBody()) {
            this.nl(2);
          }
          this.append(
            baseType.inspect(httpResponse, depth, output.clone(), inspect)
          );
        });
      },
      diff: function (actual, expected, output, diff, inspect, equal) {
        const baseType = this.baseType;
        output.block(function (output) {
          output.append(diff(actual.statusLine, expected.statusLine));

          const messageDiff = baseType.diff(
            actual,
            expected,
            output.clone(),
            diff,
            inspect,
            equal
          );
          if (messageDiff && !messageDiff.isEmpty()) {
            output.nl().append(messageDiff);
          }
        });
        return output;
      },
    });

    expect.exportAssertion(
      '<messyHttpResponse> to [exhaustively] satisfy <undefined>',
      function (expect, subject, value) {
        return expect(subject, 'to [exhaustively] satisfy', {});
      }
    );

    expect.exportAssertion(
      '<messyHttpResponse> to [exhaustively] satisfy <string|Buffer>',
      function (expect, subject, value) {
        return expect(
          subject,
          'to [exhaustively] satisfy',
          omitUndefinedProperties(
            _.pick(
              new messy.HttpResponse(value),
              _.difference(messy.HttpResponse.propertyNames, [
                'decodedBody',
                'unchunkedBody',
                'parts',
                'rawBody',
              ])
            )
          )
        );
      }
    );

    expect.exportAssertion(
      '<messyHttpResponse> to [exhaustively] satisfy <number>',
      function (expect, subject, value) {
        return expect(subject, 'to [exhaustively] satisfy', {
          statusLine: value,
        });
      }
    );

    expect.exportAssertion(
      '<messyHttpResponse> to [exhaustively] satisfy <object>',
      function (expect, subject, value) {
        const statusLineSpec = _.pick(value, messy.StatusLine.propertyNames);

        const messageValue = _.extend({}, value);
        delete messageValue.statusLine;

        Object.keys(statusLineSpec).forEach(function (statusLineKey) {
          delete messageValue[statusLineKey];
        });
        const promiseByKey = {
          statusLine: expect.promise(function () {
            if ('statusLine' in value) {
              return expect(subject.statusLine, 'to satisfy', value.statusLine);
            }
          }),
          statusLineSpec: expect.promise(function () {
            // Make the StatusLine properties available for matching:
            return expect(subject.statusLine, 'to satisfy', statusLineSpec);
          }),
          message: expect.promise(function () {
            return expect(
              Object.create(subject, { isMessyHttpResponse: { value: false } }),
              'to [exhaustively] satisfy',
              messageValue
            );
          }),
        };

        return expect.promise.all(promiseByKey).caught(function () {
          return expect.promise.settle(promiseByKey).then(function () {
            expect.fail({
              diff: function (output, diff, inspect, equal) {
                output.block(function (output) {
                  let statusLineDiff;
                  if (promiseByKey.statusLine.isRejected()) {
                    const statusLineError = promiseByKey.statusLine.reason();
                    statusLineDiff = statusLineError.getDiff(output);
                    if (statusLineDiff) {
                      output.append(statusLineDiff);
                    } else {
                      output.annotationBlock(
                        statusLineError.getErrorMessage(output)
                      );
                    }
                  } else if (promiseByKey.statusLineSpec.isRejected()) {
                    const statusLineSpecError =
                      promiseByKey.statusLineSpec.reason();
                    statusLineDiff = statusLineSpecError.getDiff(output);
                    if (statusLineDiff) {
                      output.append(statusLineDiff);
                    } else {
                      output.annotationBlock(
                        statusLineSpecError.getErrorMessage(output)
                      );
                    }
                  } else {
                    output.append(inspect(subject.statusLine));
                  }
                  output.nl();
                  if (promiseByKey.message.isRejected()) {
                    const messageError = promiseByKey.message.reason();
                    const messageDiff = messageError.getDiff(output);
                    if (messageDiff) {
                      output.append(messageDiff);
                    } else {
                      output.annotationBlock(
                        messageError.getErrorMessage(output)
                      );
                    }
                  } else {
                    output.append(
                      expect
                        .findTypeOf(new messy.Message())
                        .inspect(subject, 3, output.clone(), inspect, equal)
                    );
                  }
                });
                return output;
              },
            });
          });
        });
      }
    );

    expect.exportType({
      name: 'messyHttpExchange',
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
          this.append(diff(actual.request, expected.request))
            .nl(2)
            .append(diff(actual.response, expected.response));
        });
        return output;
      },
    });

    expect.exportAssertion(
      '<messyHttpExchange> to [exhaustively] satisfy <undefined>',
      function (expect, subject, value) {
        return expect(subject, 'to [exhaustively] satisfy', {});
      }
    );

    expect.exportAssertion(
      '<messyHttpExchange> to [exhaustively] satisfy <object>',
      function (expect, subject, value) {
        const promiseByKey = {
          request: expect.promise(function () {
            if ('request' in value) {
              return expect(
                subject.request,
                'to [exhaustively] satisfy',
                value.request
              );
            } else {
              expect(expect.flags.exhaustively, 'to be false');
            }
          }),
          response: expect.promise(function () {
            if ('response' in value) {
              return expect(
                subject.response,
                'to [exhaustively] satisfy',
                value.response
              );
            } else {
              expect(expect.flags.exhaustively, 'to be false');
            }
          }),
        };

        return expect.promise.all(promiseByKey).caught(function () {
          return expect.promise.settle(promiseByKey).then(function () {
            expect.fail({
              diff: function (output, diff, inspect, equal) {
                output.block(function (output) {
                  if (promiseByKey.request.isRejected()) {
                    const requestError = promiseByKey.request.reason();
                    const requestDiff = requestError.getDiff(output);
                    if (requestDiff) {
                      output.append(requestDiff);
                    } else {
                      output.annotationBlock(
                        requestError.getErrorMessage(output)
                      );
                    }
                  } else if (subject.request) {
                    output.append(inspect(subject.request));
                  } else {
                    output.text('<no request>', 'yellow');
                  }
                  output.nl(2);
                  if (promiseByKey.response.isRejected()) {
                    const responseError = promiseByKey.response.reason();
                    const responseDiff = responseError.getDiff(output);
                    if (responseDiff) {
                      output.append(responseDiff);
                    } else {
                      output.annotationBlock(
                        responseError.getErrorMessage(output)
                      );
                    }
                  } else if (subject.response) {
                    output.append(inspect(subject.response));
                  } else {
                    output.text('<no response>', 'yellow');
                  }
                });
                return output;
              },
            });
          });
        });
      }
    );

    expect.exportType({
      name: 'messyHttpConversation',
      base: 'object',
      equal: function (httpConversation1, httpConversation2) {
        return httpConversation1.equals(httpConversation2);
      },
      identify: function (obj) {
        return obj && obj.isMessyHttpConversation;
      },
      inspect: function (httpConversation, depth, output, inspect) {
        if (httpConversation.exchanges.length === 0) {
          output.text('<empty conversation>', 'yellow');
        } else {
          httpConversation.exchanges.forEach(function (httpExchange, i) {
            if (i > 0) {
              output.nl(2);
            }
            output.append(inspect(httpExchange, depth));
          });
        }
        return output;
      },
      diff: function (actual, expected, output, diff, inspect, equal) {
        output.block(function () {
          for (
            let i = 0;
            i < Math.max(actual.exchanges.length, expected.exchanges.length);
            i += 1
          ) {
            if (i > 0) {
              this.nl(2);
            }
            if (i < actual.exchanges.length && i < expected.exchanges.length) {
              this.append(diff(actual.exchanges[i], expected.exchanges[i]));
            } else if (actual.exchanges.length > expected.exchanges.length) {
              this.block(function () {
                this.error('should be removed:')
                  .nl()
                  .append(inspect(actual.exchanges[i]))
                  .prependLinesWith(function () {
                    this.error('//').sp();
                  });
              });
            } else {
              // expected.exchanges.length > actual.exchanges.length
              this.block(function () {
                this.error('missing:')
                  .nl()
                  .append(inspect(expected.exchanges[i]))
                  .prependLinesWith(function () {
                    this.error('//').sp();
                  });
              });
            }
          }
        });
        return output;
      },
    });

    expect.exportAssertion(
      '<messyHttpConversation> [not] to have number of exchanges <number>',
      function (expect, subject, value) {
        expect(subject.exchanges, '[not] to have length', value);
      }
    );

    expect.exportAssertion(
      '<messyHttpConversation> to [exhaustively] satisfy <string|Buffer>',
      function (expect, subject, value) {
        return expect(
          subject,
          'to [exhaustively] satisfy',
          new messy.HttpConversation(value)
        );
      }
    );

    expect.exportAssertion(
      '<messyHttpConversation> to [exhaustively] satisfy <undefined>',
      function (expect, subject, value) {
        return expect(subject, 'to [exhaustively] satisfy', {});
      }
    );

    expect.exportAssertion(
      '<messyHttpConversation> to [exhaustively] satisfy <object>',
      function (expect, subject, value) {
        let numValueExchanges = 0;
        if (Array.isArray(value.exchanges)) {
          numValueExchanges = value.exchanges.length;
        } else if (value.exchanges && typeof value.exchanges === 'object') {
          const valueExchangesKeys = Object.keys(value.exchanges);
          if (valueExchangesKeys.length > 0) {
            numValueExchanges =
              valueExchangesKeys
                .map(function (str) {
                  return parseInt(str, 10);
                })
                .sort()
                .pop() + 1;
          }
        }

        const promiseByKey = {
          exchanges: expect.promise(function () {
            if (typeof value.exchanges !== 'undefined') {
              expect(subject.exchanges, 'to be an array');
              if (typeof value.exchanges === 'function') {
                return expect(subject.exchanges, 'to satisfy', value.exchanges);
              } else if (Array.isArray(value.exchanges)) {
                expect(
                  subject,
                  'to have number of exchanges',
                  value.exchanges.length
                );
              } else if (
                value.exchanges &&
                typeof value.exchanges === 'object'
              ) {
                Object.keys(value.exchanges).forEach(function (key) {
                  expect(key, 'to match', /^\d+/);
                });
              }
            }
          }),
        };

        if (
          !value.isMessyConversation &&
          typeof value.exchanges !== 'undefined' &&
          typeof value.exchanges !== 'function'
        ) {
          Object.keys(value.exchanges).forEach(function (key, i) {
            promiseByKey[key] = expect.promise(function () {
              if (i < subject.exchanges.length) {
                return expect(
                  subject.exchanges[key],
                  'to [exhaustively] satisfy',
                  value.exchanges[key]
                );
              } else {
                const instanceAndSatisfySpec = convertSatisfySpecToInstance(
                  value.exchanges[key],
                  messy.HttpExchange
                );
                return expect(
                  instanceAndSatisfySpec.instance,
                  'to [exhaustively] satisfy',
                  instanceAndSatisfySpec.satisfySpec
                );
              }
            });
          });
        }

        return expect.promise.all(promiseByKey).caught(function () {
          return expect.promise.settle(promiseByKey).then(function () {
            expect.fail({
              diff: function (output, diff, inspect, equal) {
                output.block(function (output) {
                  for (
                    let i = 0;
                    i < Math.max(subject.exchanges.length, numValueExchanges);
                    i += 1
                  ) {
                    if (i > 0) {
                      output.nl(2);
                    }

                    const exchangeSatisfyError =
                      promiseByKey[i] &&
                      promiseByKey[i].isRejected() &&
                      promiseByKey[i].reason();

                    const exchangeSatisfyDiff =
                      exchangeSatisfyError &&
                      exchangeSatisfyError.getDiff(output);
                    if (i < subject.exchanges.length && i < numValueExchanges) {
                      if (
                        typeof value.exchanges !== 'function' &&
                        i in value.exchanges
                      ) {
                        if (exchangeSatisfyDiff) {
                          output.append(exchangeSatisfyDiff);
                        } else {
                          output.append(inspect(subject.exchanges[i]));
                          if (exchangeSatisfyError) {
                            output.sp().annotationBlock(function () {
                              this.error(
                                `${
                                  exchangeSatisfyError.getLabel() ||
                                  'should satisfy'
                                } `
                              ).append(inspect(value.exchanges[i]));
                            });
                          }
                        }
                      } else {
                        output.append(inspect(subject.exchanges[i]));
                      }
                    } else if (i < numValueExchanges) {
                      output.annotationBlock(function () {
                        this.error('missing:').nl();
                        if (exchangeSatisfyDiff && exchangeSatisfyDiff) {
                          this.append(exchangeSatisfyDiff);
                        } else {
                          this.append(
                            inspect(
                              convertSatisfySpecToInstance(
                                value.exchanges[i],
                                messy.HttpExchange
                              ).instance
                            )
                          );
                        }
                      });
                    } else {
                      output.annotationBlock(function () {
                        this.error('should be removed:')
                          .nl()
                          .append(inspect(subject.exchanges[i]));
                      });
                    }
                  }
                });
                return output;
              },
            });
          });
        });
      }
    );
  },
};
