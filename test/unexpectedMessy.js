/*global describe, it*/
var messy = require('messy'),
    Headers = messy.Headers,
    Message = messy.Message,
    RequestLine = messy.RequestLine,
    HttpRequest = messy.HttpRequest,
    StatusLine = messy.StatusLine,
    HttpResponse = messy.HttpResponse,
    HttpExchange = messy.HttpExchange,
    HttpConversation = messy.HttpConversation,
    unexpected = require('unexpected'),
    unexpectedMessy = require('../lib/unexpectedMessy');

describe('unexpected-messy', function () {
    var expect = unexpected.clone()
        .installPlugin(unexpectedMessy)
        .addAssertion('to produce a diff of', function (expect, subject, value) {
            this.errorMode = 'bubble';
            expect(expect.diff(
                subject[0],
                subject[1]
            ).diff.toString(), 'to equal', value);
        })
        .addAssertion('to inspect as', function (expect, subject, value) {
            this.errorMode = 'bubble';
            expect(expect.inspect(subject).toString(), 'to equal', value);
        });


    describe('Headers', function () {
        describe('#inspect', function () {
            it('should render no headers as the empty string', function () {
                expect(new Headers(''), 'to inspect as', '');
            });

            it('should render a single header headers with no newline at the end', function () {
                expect(new Headers({foo: 'bar'}), 'to inspect as', 'Foo: bar');
            });

            it('should render two headers single header headers with no newline at the end', function () {
                expect(new Headers({foo: 'bar', quux: 'baz'}), 'to inspect as', 'Foo: bar\nQuux: baz');
            });
        });

        describe('#diff', function () {
            it('must show missing headers', function () {
                expect([
                    new Headers('Foo: Bar\nQuux: Baz'),
                    new Headers('Foo: Bar\nBaz: Blah\nQuux: Baz')
                ], 'to produce a diff of',
                    'Foo: Bar\n' +
                    'Quux: Baz\n' +
                    '// missing: Baz: Blah\n'
                );
            });

            it('must show extraneous headers', function () {
                expect([
                    new Headers('Foo: Bar\nBaz: Blah\nQuux: Baz'),
                    new Headers('Foo: Bar\nQuux: Baz')
                ], 'to produce a diff of',
                    'Foo: Bar\n' +
                    'Baz: Blah // should be removed\n' +
                    'Quux: Baz\n'
                );
            });

            it('must show headers that have a wrong value', function () {
                expect([
                    new Headers('Foo: Bar\nQuux: Baz'),
                    new Headers('Foo: Baz\nQuux: Blaz')
                ], 'to produce a diff of',
                    'Foo: Bar // should be: Baz\n' +
                    'Quux: Baz // should be: Blaz\n'
                );
            });

            it('must show repeated headers where the first has a wrong value', function () {
                expect([
                    new Headers('Foo: Bar\nFoo: Baz'),
                    new Headers('Foo: Blah\nFoo: Baz')
                ], 'to produce a diff of',
                    'Foo: Baz\n' +
                    'Foo: Bar // should be: Blah\n'
                );
            });

            it('must show repeated headers where the second has a wrong value', function () {
                expect([
                    new Headers('Foo: Bar\nFoo: Baz'),
                    new Headers('Foo: Bar\nFoo: Blaz')
                ], 'to produce a diff of',
                    'Foo: Bar\n' +
                    'Foo: Baz // should be: Blaz\n'
                );
            });
        });

        describe('"to satisfy" assertion', function () {
            it('must match an empty object', function () {
                expect(new Headers({foo: 'a'}), 'to satisfy', {});
            });

            it('must match an empty object exhaustively', function () {
                expect(new Headers({}), 'to exhaustively satisfy', {});
            });

            it('must match a single-valued header', function () {
                expect(new Headers({foo: 'a'}), 'to satisfy', {foo: 'a'});
            });

            it('must match a single-valued header specified with a different casing', function () {
                expect(new Headers({Foo: 'a'}), 'to satisfy', {fOO: 'a'});
            });

            it('must match exhaustively when a single header is matched', function () {
                expect(new Headers({foo: 'a'}), 'to exhaustively satisfy', {foo: 'a'});
            });

            it('must match a different value type (should stringify everything)', function () {
                expect(new Headers({foo: '123'}), 'to satisfy', {foo: 123});
                expect(new Headers({foo: 123}), 'to satisfy', {foo: '123'});
            });

            it('should match in spite of excess headers when not matching exhaustively', function () {
                expect(new Headers({foo: 'a', bar: 'a'}), 'to satisfy', {foo: 'a'});
            });

            it('should not match exhaustively when there are excess headers', function () {
                expect(new Headers({foo: 'a', bar: 'a'}), 'not to exhaustively satisfy', {foo: 'a'});
            });

            it('should match in spite of excess values when not matching exhaustively', function () {
                expect(new Headers({foo: ['a', 'b']}), 'to satisfy', {foo: 'a'});
            });

            it('should not match exhaustively when there are excess values', function () {
                expect(new Headers({foo: ['a', 'b']}), 'not to exhaustively satisfy', {foo: 'a'});
            });

            it('should match multiple values exhaustively', function () {
                expect(new Headers({foo: ['a', 'b']}), 'to exhaustively satisfy', {foo: ['a', 'b']});
            });

            it('should match multiple values exhaustively when ordered differently', function () {
                expect(new Headers({foo: ['a', 'b']}), 'to exhaustively satisfy', {foo: ['b', 'a']});
            });

            it('should not match exhaustively unless all values are actually named', function () {
                expect(new Headers({foo: ['a', 'b']}), 'not to exhaustively satisfy', {foo: ['a', 'a']});
            });

            it('should assert the absence of a header when the value is given as undefined', function () {
                expect(new Headers({foo: 'a'}), 'to satisfy', {bar: undefined});
                expect(new Headers({foo: 'a'}), 'not to satisfy', {foo: undefined});
            });

            it('should match exhaustively even when absent headers are also asserted absent', function () {
                expect(new Headers({foo: 'a'}), 'to exhaustively satisfy', {foo: 'a', bar: undefined});
            });

            it('should support passing the expected set of headers as a string', function () {
                expect(new Headers({foo: 'a', bar: 'b'}), 'to satisfy', 'foo: a\r\nbar: b');
                expect(new Headers({foo: 'a', bar: 'b'}), 'to exhaustively satisfy', 'foo: a\r\nbar: b');

                expect(new Headers({foo: 'a'}), 'not to satisfy', 'foo: b');
                expect(new Headers({foo: 'a'}), 'to satisfy', '');
                expect(new Headers({foo: 'a'}), 'not to exhaustively satisfy', '');
            });

            it('should produce a diff when the assertion fails', function () {
                expect(function () {
                    expect(new Headers({foo: 'a', bar: 'b'}), 'to satisfy', {bar: /c/});
                }, 'to throw',
                    'expected\n' +
                    'Foo: a\n' +
                    'Bar: b\n' +
                    'to satisfy { bar: /c/ }\n' +
                    '\n' +
                    'Diff:\n' +
                    '\n' +
                    'Foo: a\n' +
                    'Bar: b // should satisfy /c/');
            });
        });
    });

    describe('Message', function () {
        describe('#inspect', function () {
            it('should render a message with no headers and no body as the empty string', function () {
                expect(new Message(), 'to inspect as', '');
            });

            it('should render a message with a single header and no body without a newline at the end', function () {
                expect(new Message({headers: {foo: 'bar'}}), 'to inspect as', 'Foo: bar');
            });

            it('should render a message with a single header and a body correctly', function () {
                expect(new Message({headers: {foo: 'bar'}, body: 'baz'}), 'to inspect as', 'Foo: bar\n\nbaz');
            });

            it('should render a message no headers and a body correctly', function () {
                expect(new Message({body: 'baz'}), 'to inspect as', 'baz');
            });
        });

        describe('#diff', function () {
            it('must show missing headers', function () {
                expect([
                    new Message('Content-Type: application/json\n\n{"foo":123}'),
                    new Message('Content-Type: application/json\nQuux: Baz\n\n{"foo":123}')
                ], 'to produce a diff of',
                    'Content-Type: application/json\n' +
                    '// missing: Quux: Baz\n' +
                    '\n' +
                    '{\n' +
                    '  foo: 123\n' +
                    '}'
                );
            });

            it('must diff object bodies', function () {
                expect([
                    new Message('Content-Type: application/json\n\n{"foo":123}'),
                    new Message('Content-Type: application/json\n\n{"foo":456}')
                ], 'to produce a diff of',
                    'Content-Type: application/json\n' +
                    '\n' +
                    '{\n' +
                    '  foo: 123 // should be: 456\n' +
                    '}'
                );
            });
        });

        describe('"to satisfy" assertion', function () {
            it('should support matching the headers', function () {
                expect(new Message({headers: {foo: 'a'}}), 'to satisfy', {headers: {foo: 'a'}});
            });

            it('should support matching the headers', function () {
                expect(new Message({headers: {foo: 'a'}}), 'to satisfy', {headers: {foo: 'a'}});

                expect(new Message({headers: {foo: 'a'}}), 'not to satisfy', {headers: {bar: 'a'}});
            });

            it('should support matching the serialized headers with a regular expression', function () {
                expect(new Message({headers: {foo: 'a', bar: 'b'}}), 'to satisfy', {headers: /a\r\nBar/});
            });

            it('should support matching individual headers with a regular expression', function () {
                expect(new Message({headers: {foo: 'abc'}}), 'to satisfy', {headers: {foo: /bc$/}});
            });

            it('should support passing the expected properties as a string', function () {
                expect(new Message({headers: {foo: 'a'}}), 'to satisfy', 'foo: a');
                expect(new Message({headers: {foo: 'a'}}), 'not to satisfy', 'foo: b');
            });

            it('should support passing the expected headers as a string', function () {
                expect(new Message({headers: {foo: 'a'}}), 'to satisfy', {headers: 'foo: a'});
                expect(new Message({headers: {foo: 'a'}}), 'not to satisfy', {headers: 'foo: b'});
            });

            it('should support matching a string body with a string', function () {
                expect(new Message('foo: bar\n\nthe body'), 'to satisfy', {body: 'the body'});
            });

            it('should support matching a string body with a regular expression', function () {
                expect(new Message('foo: bar\n\nthe body'), 'to satisfy', {body: /he b/});
            });

            it('should support matching a Buffer body with a Buffer', function () {
                expect(new Message(new Buffer('foo: bar\n\nthe body', 'utf-8')), 'to satisfy', {body: new Buffer('the body', 'utf-8')});
            });

            it('should support matching a Buffer body with a string', function () {
                expect(new Message(new Buffer('foo: bar\n\nthe body', 'utf-8')), 'to satisfy', {body: 'the body'});
            });

            it('should support matching a Buffer body with a regular expression', function () {
                expect(new Message(new Buffer('foo: bar\n\nthe body', 'utf-8')), 'to satisfy', {body: /he b/});
            });

            it('should support matching a string body with a Buffer', function () {
                expect(new Message('foo: bar\n\nthe body'), 'to satisfy', {body: new Buffer('the body', 'utf-8')});
            });

            it('should support matching a Buffer body with an object when the Content-Type is application/json', function () {
                expect(new Message(new Buffer('Content-Type: application/json\n\n{"the": "body"}', 'utf-8')), 'to satisfy', {body: {the: 'body'}});
            });

            it('should not support matching a Buffer body with an object when the Content-Type is not application/json', function () {
                expect(new Message(new Buffer('Content-Type: text/plain\n\n{"the": "body"}', 'utf-8')), 'not to satisfy', {body: {the: 'body'}});
            });

            it('should support matching a Buffer body containing invalid JSON with an object when the Content-Type is application/json', function () {
                expect(new Message(new Buffer('Content-Type: application/json\n\n{"the": "body', 'utf-8')), 'not to satisfy', {body: {the: 'body'}});
            });

            it('should support matching a string body with an object when the Content-Type is application/json', function () {
                expect(new Message('Content-Type: application/json\n\n{"the": "body"}'), 'to satisfy', {body: {the: 'body'}});
            });

            it('should not support matching a string body with an object when the Content-Type is not application/json', function () {
                expect(new Message('Content-Type: text/plain\n\n{"the": "body"}'), 'not to satisfy', {body: {the: 'body'}});
            });

            it('should support matching a string body containing invalid JSON with an object when the Content-Type is application/json', function () {
                expect(new Message('Content-Type: application/json\n\n{"the": "body'), 'not to satisfy', {body: {the: 'body'}});
            });

            it('should support matching an object body with a string when the Content-Type is application/json', function () {
                expect(new Message({headers: 'Content-Type: application/json', body: {the: 'body'}}), 'to satisfy', {body: '{"the": "body"}'});
            });

            it('should not support matching an object body with a string when the Content-Type is not application/json', function () {
                expect(new Message({headers: 'Content-Type: text/plain', body: {the: 'body'}}), 'not to satisfy', {body: '{"the": "body"}'});
            });

            it('should support matching an object body with a regular expression when the Content-Type is application/json', function () {
                expect(new Message({headers: 'Content-Type: application/json', body: {the: 'body'}}), 'to satisfy', {body: /he": "bod/});
            });

            it('should support matching an object body with a string containing invalid JSON when the Content-Type is application/json', function () {
                expect(new Message({headers: 'Content-Type: application/json', body: {the: 'body'}}), 'not to satisfy', {body: '{"the": "body'});
            });

            it('should support matching an object body with a Buffer when the Content-Type is application/json', function () {
                expect(new Message({headers: 'Content-Type: application/json', body: {the: 'body'}}), 'to satisfy', {body: new Buffer('{"the": "body"}', 'utf-8')});
            });

            it('should not support matching an object body with a Buffer when the Content-Type is not application/json', function () {
                expect(new Message({headers: 'Content-Type: text/plain', body: {the: 'body'}}), 'not to satisfy', {body: new Buffer('{"the": "body"}', 'utf-8')});
            });

            it('should support matching an object body with a Buffer containing invalid JSON when the Content-Type is application/json', function () {
                expect(new Message({headers: 'Content-Type: application/json', body: {the: 'body'}}), 'not to satisfy', {body: new Buffer('{"the": "body', 'utf-8')});
            });

            it('should support matching an object body (JSON) with an object', function () {
                expect(new Message({body: {foo: 'bar', bar: 'baz'}}), 'to satisfy', {body: {bar: 'baz', foo: 'bar'}});
            });

            it('should produce a diff when the assertion fails', function () {
                expect(function () {
                    expect(new Message({headers: {foo: 'a', bar: 'b'}, body: 'foo'}), 'to satisfy', {headers: {bar: /c/}, body: /bar/});
                }, 'to throw',
                    'expected\n' +
                    'Foo: a\n' +
                    'Bar: b\n' +
                    '\n' +
                    'foo\n' +
                    'to satisfy { headers: { bar: /c/ }, body: /bar/ }\n' +
                    '\n' +
                    'Diff:\n' +
                    '\n' +
                    'Foo: a\n' +
                    'Bar: b // should satisfy /c/\n' +
                    '\n' +
                    'foo // should satisfy /bar/');
            });
        });
    });

    describe('RequestLine', function () {
        describe('#diff', function () {
            it('must diff when the methods differ', function () {
                expect([
                    new RequestLine('GET / HTTP/1.1'),
                    new RequestLine('POST / HTTP/1.1')
                ], 'to produce a diff of',
                    'GET / HTTP/1.1 // should be POST / HTTP/1.1'
                );
            });

            it('must diff when the protocol differs', function () {
                expect([
                    new RequestLine('GET / HTTP/1.1'),
                    new RequestLine('GET / HTTP/1.0')
                ], 'to produce a diff of',
                    'GET / HTTP/1.1 // should be HTTP/1.0'
                );
            });

            it('must diff the status line when the url differs', function () {
                expect([
                    new RequestLine('GET /foo HTTP/1.1'),
                    new RequestLine('GET /bar HTTP/1.1')
                ], 'to produce a diff of',
                    'GET /foo HTTP/1.1 // should be /bar HTTP/1.1'
                );
            });
        });

        describe('"to satisfy" assertion', function () {
            it('should produce a diff when the assertion fails', function () {
                expect(function () {
                    expect(new RequestLine('GET / HTTP/1.1'), 'to satisfy', {method: /^P(?:UT|POST)$/});
                }, 'to throw',
                    'expected GET / HTTP/1.1 to satisfy { method: /^P(?:UT|POST)$/ }\n' +
                    '\n' +
                    'Diff:\n' +
                    '\n' +
                    'GET / HTTP/1.1 // should satisfy { method: /^P(?:UT|POST)$/ }'
                );
            });

            it('should produce a simple diff when a failed assertion only contains equality criteria', function () {
                expect(function () {
                    expect(new RequestLine('GET / HTTP/1.1'), 'to satisfy', {method: 'POST', url: '/'});
                }, 'to throw',
                    "expected GET / HTTP/1.1 to satisfy { method: 'POST', url: '/' }\n" +
                    '\n' +
                    'Diff:\n' +
                    '\n' +
                    'GET / HTTP/1.1 // should be POST /'
                );
            });
        });
    });

    describe('HttpRequest', function () {
        describe('#inspect', function () {
            it('should render an http request with no headers and no body as just the request line with no newline at the end', function () {
                expect(new HttpRequest('GET / HTTP/1.1'), 'to inspect as', 'GET / HTTP/1.1');
            });

            it('should render an http request with no headers as the request line, then two newlines followed by the body', function () {
                expect(new HttpRequest({requestLine: 'GET / HTTP/1.1', body: 'foo'}), 'to inspect as', 'GET / HTTP/1.1\n\nfoo');
            });

            it('should render an http request with a single header correctly', function () {
                expect(new HttpRequest({requestLine: 'GET / HTTP/1.1', headers: {bar: 'baz'}, body: 'foo'}), 'to inspect as', 'GET / HTTP/1.1\nBar: baz\n\nfoo');
            });
        });

        describe('#diff', function () {
            it('must diff the request line', function () {
                expect([
                    new HttpRequest('GET / HTTP/1.1\nContent-Type: application/json\n\n{"foo":123}'),
                    new HttpRequest('POST /foo HTTP/1.1\nContent-Type: application/json\n\n{"foo":123}')
                ], 'to produce a diff of',
                    'GET / HTTP/1.1 // should be POST /foo HTTP/1.1\n' +
                    'Content-Type: application/json\n' +
                    '\n' +
                    '{\n' +
                    '  foo: 123\n' +
                    '}'
                );
            });

            it('must diff the headers', function () {
                expect([
                    new HttpRequest('GET / HTTP/1.1\nContent-Type: application/json\nQuux: Baz\n\n{"foo":123}'),
                    new HttpRequest('GET / HTTP/1.1\nContent-Type: application/json\n\n{"foo":123}')
                ], 'to produce a diff of',
                    'GET / HTTP/1.1\n' +
                    'Content-Type: application/json\n' +
                    'Quux: Baz // should be removed\n' +
                    '\n' +
                    '{\n' +
                    '  foo: 123\n' +
                    '}'
                );
            });
        });

        describe('"to satisfy" assertion', function () {
            it('should match on properties defined by Message', function () {
                expect(new HttpRequest('GET /foo HTTP/1.1\r\nContent-Type: text/html'), 'to satisfy', {
                    headers: {
                        'Content-Type': 'text/html'
                    }
                });
            });

            it('should support regexp matching', function () {
                expect(new HttpRequest('GET /foo HTTP/1.1\r\nContent-Type: text/html'), 'to satisfy', {
                    protocolName: /ttp/i
                });
            });

            it('should fail when matching on properties defined by Message', function () {
                expect(new HttpRequest('GET /foo HTTP/1.1\r\nContent-Type: text/html'), 'not to satisfy', {
                    headers: {
                        'Content-Type': 'text/plain'
                    }
                });
            });

            it('should match on properties', function () {
                expect(new HttpRequest('GET /foo HTTP/1.1\r\nContent-Type: text/html'), 'to satisfy', {
                    method: 'GET',
                    url: '/foo',
                    protocolVersion: '1.1'
                });
            });

            it('should match exhaustively on properties', function () {
                expect(new HttpRequest('GET /foo?hey HTTP/1.1\r\nContent-Type: text/html'), 'to exhaustively satisfy', {
                    requestLine: 'GET /foo?hey HTTP/1.1',
                    method: 'GET',
                    url: '/foo?hey',
                    path: '/foo',
                    search: '?hey',
                    query: 'hey',
                    protocol: 'HTTP/1.1',
                    protocolName: 'HTTP',
                    protocolVersion: '1.1',
                    headers: {
                        'Content-Type': 'text/html'
                    }
                });
            });

            it('should fail to match exhaustively on properties when a property is omitted', function () {
                expect(new HttpRequest('GET /foo?hey HTTP/1.1\r\nContent-Type: text/html'), 'not to exhaustively satisfy', {
                    requestLine: 'GET /foo?hey HTTP/1.1',
                    url: '/foo?hey',
                    path: '/foo',
                    search: '?hey',
                    query: 'hey',
                    protocol: 'HTTP/1.1',
                    protocolName: 'HTTP',
                    protocolVersion: '1.1',
                    headers: {
                        'Content-Type': 'text/html'
                    }
                });
            });

            it('should fail to match exhaustively on properties when a property defined by Message is omitted', function () {
                expect(new HttpRequest('GET /foo?hey HTTP/1.1\r\nContent-Type: text/html\r\nargh'), 'not to exhaustively satisfy', {
                    requestLine: 'GET /foo?hey HTTP/1.1',
                    method: 'GET',
                    url: '/foo?hey',
                    path: '/foo',
                    search: '?hey',
                    query: 'hey',
                    protocol: 'HTTP/1.1',
                    protocolName: 'HTTP',
                    protocolVersion: '1.1',
                    headers: {
                        'Content-Type': 'text/html'
                    }
                });
            });
        });
    });

    describe('StatusLine', function () {
        describe('#diff', function () {
            it('must diff the status line when the status code and status message differ', function () {
                expect([
                    new StatusLine('HTTP/1.1 200 OK'),
                    new StatusLine('HTTP/1.1 412 Precondition Failed')
                ], 'to produce a diff of',
                    'HTTP/1.1 200 OK // should be 412 Precondition Failed'
                );
            });

            it('must diff the status line when the protocol differs', function () {
                expect([
                    new StatusLine('HTTP/1.1 200 OK'),
                    new StatusLine('HTTP/1.0 200 OK')
                ], 'to produce a diff of',
                    'HTTP/1.1 200 OK // should be HTTP/1.0 200 OK'
                );
            });

            it('must diff the status line when the status mesage', function () {
                expect([
                    new StatusLine('HTTP/1.1 200 Okie-dokie'),
                    new StatusLine('HTTP/1.1 200 OK')
                ], 'to produce a diff of',
                    'HTTP/1.1 200 Okie-dokie // should be OK'
                );
            });
        });

        describe('"to satisfy" assertion', function () {
            it('should produce a diff when the assertion fails', function () {
                expect(function () {
                    expect(new StatusLine('HTTP/1.1 200 OK'), 'to satisfy', {protocolVersion: /^2\.\d+$/});
                }, 'to throw',
                    'expected HTTP/1.1 200 OK to satisfy { protocolVersion: /^2\\.\\d+$/ }\n' +
                    '\n' +
                    'Diff:\n' +
                    '\n' +
                    'HTTP/1.1 200 OK // should satisfy { protocolVersion: /^2\\.\\d+$/ }'
                );
            });

            it('should produce a simple diff when a failed assertion only contains equality criteria', function () {
                expect(function () {
                    expect(new StatusLine('HTTP/1.1 200 OK'), 'to satisfy', {statusCode: 412});
                }, 'to throw',
                    "expected HTTP/1.1 200 OK to satisfy { statusCode: 412 }\n" +
                    '\n' +
                    'Diff:\n' +
                    '\n' +
                    'HTTP/1.1 200 OK // should be 412 Precondition Failed'
                );
            });
        });
    });

    describe('HttpResponse', function () {
        describe('#inspect', function () {
            it('should render an http response with no headers and no body as just the status line with no newline at the end', function () {
                expect(new HttpResponse('HTTP/1.1 200 OK'), 'to inspect as', 'HTTP/1.1 200 OK');
            });

            it('should render an http response with no headers as the status line, then two newlines followed by the body', function () {
                expect(new HttpResponse({statusLine: 'HTTP/1.1 200 OK', body: 'foo'}), 'to inspect as', 'HTTP/1.1 200 OK\n\nfoo');
            });

            it('should render an http response with a single header correctly', function () {
                expect(new HttpResponse({statusLine: 'HTTP/1.1 200 OK', headers: {bar: 'baz'}, body: 'foo'}), 'to inspect as', 'HTTP/1.1 200 OK\nBar: baz\n\nfoo');
            });
        });

        describe('#diff', function () {
            it('must diff the status line', function () {
                expect([
                    new HttpResponse('HTTP/1.1 200 OK\nContent-Type: application/json\n\n{"foo":123}'),
                    new HttpResponse('HTTP/1.1 412 Precondition Failed\nContent-Type: application/json\n\n{"foo":123}')
                ], 'to produce a diff of',
                    'HTTP/1.1 200 OK // should be 412 Precondition Failed\n' +
                    'Content-Type: application/json\n' +
                    '\n' +
                    '{\n' +
                    '  foo: 123\n' +
                    '}'
                );
            });

            it('must diff the headers', function () {
                expect([
                    new HttpResponse('HTTP/1.1 200 OK\nContent-Type: application/json\n\n{"foo":123}'),
                    new HttpResponse('HTTP/1.1 200 OK\nContent-Type: application/json\nQuux: Baz\n\n{"foo":123}')
                ], 'to produce a diff of',
                    'HTTP/1.1 200 OK\n' +
                    'Content-Type: application/json\n' +
                    '// missing: Quux: Baz\n' +
                    '\n' +
                    '{\n' +
                    '  foo: 123\n' +
                    '}'
                );
            });
        });

        describe('"to satisfy" assertion', function () {
            it('should match on properties defined by Message', function () {
                expect(new HttpResponse('HTTP/1.1 200 OK\r\nContent-Type: text/html'), 'to satisfy', {
                    headers: {
                        'Content-Type': 'text/html'
                    }
                });
            });

            it('should support regexp matching', function () {
                expect(new HttpResponse('HTTP/1.1 200 OK\r\nContent-Type: text/html'), 'to satisfy', {
                    protocolName: /ttp/i
                });
            });

            it('should fail when matching on properties defined by Message', function () {
                expect(new HttpResponse('HTTP/1.1 200 OK\r\nContent-Type: text/html'), 'not to satisfy', {
                    headers: {
                        'Content-Type': 'text/plain'
                    }
                });
            });

            it('should match on properties', function () {
                expect(new HttpResponse('HTTP/1.1 200 OK\r\nContent-Type: text/html'), 'to satisfy', {
                    statusCode: 200,
                    protocolVersion: '1.1'
                });
            });

            it('should match exhaustively on properties', function () {
                expect(new HttpResponse('HTTP/1.1 200 OK\r\nContent-Type: text/html'), 'to exhaustively satisfy', {
                    statusLine: 'HTTP/1.1 200 OK',
                    statusCode: 200,
                    statusMessage: 'OK',
                    protocol: 'HTTP/1.1',
                    protocolName: 'HTTP',
                    protocolVersion: '1.1',
                    body: undefined,
                    headers: {
                        'Content-Type': 'text/html'
                    }
                });
            });

            it('should fail to match exhaustively on properties when a property is omitted', function () {
                expect(new HttpResponse('HTTP/1.1 200 OK\r\nContent-Type: text/html'), 'not to exhaustively satisfy', {
                    statusLine: 'HTTP/1.1 200 OK',
                    statusCode: 200,
                    statusMessage: 'OK',
                    protocol: 'HTTP/1.1',
                    protocolVersion: '1.1',
                    body: undefined,
                    headers: {}
                });
            });

            it('should fail to match exhaustively on properties when a property defined by Message is omitted', function () {
                expect(new HttpResponse('HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nargh'), 'not to exhaustively satisfy', {
                    statusLine: 'HTTP/1.1 200 OK',
                    statusCode: 200,
                    statusMessage: 'OK',
                    protocol: 'HTTP/1.1',
                    protocolName: 'HTTP',
                    protocolVersion: '1.1',
                    headers: {
                        'Content-Type': 'text/html'
                    }
                });
            });

            it('should produce a diff when the assertion fails', function () {
                expect(function () {
                    expect(new HttpResponse('HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\nargh'), 'to satisfy', {statusLine: {statusCode: 412}, headers: {'Content-Type': 'application/json'}, body: 'blah'});
                }, 'to throw',
                    'expected\n' +
                    'HTTP/1.1 200 OK\n' +
                    'Content-Type: text/html\n' +
                    '\n' +
                    'argh\n' +
                    'to satisfy\n' +
                    '{\n' +
                    '  statusLine: { statusCode: 412 },\n' +
                    "  headers: { 'Content-Type': 'application/json' },\n" +
                    "  body: 'blah'\n" +
                    '}\n' +
                    '\n' +
                    'Diff:\n' +
                    '\n' +
                    'HTTP/1.1 200 OK // should be 412 Precondition Failed\n' +
                    'Content-Type: text/html // should satisfy application/json\n' +
                    '\n' +
                    '-argh\n' +
                    '+blah'
                );
            });

            it('should produce a diff when the assertion fails but there is no diff in the status line', function () {
                expect(function () {
                    expect(new HttpResponse('HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\nargh'), 'to satisfy', {statusLine: {statusCode: 200}, headers: {'Content-Type': 'application/json'}, body: 'blah'});
                }, 'to throw',
                    'expected\n' +
                    'HTTP/1.1 200 OK\n' +
                    'Content-Type: text/html\n' +
                    '\n' +
                    'argh\n' +
                    'to satisfy\n' +
                    '{\n' +
                    '  statusLine: { statusCode: 200 },\n' +
                    "  headers: { 'Content-Type': 'application/json' },\n" +
                    "  body: 'blah'\n" +
                    '}\n' +
                    '\n' +
                    'Diff:\n' +
                    '\n' +
                    'HTTP/1.1 200 OK\n' +
                    'Content-Type: text/html // should satisfy application/json\n' +
                    '\n' +
                    '-argh\n' +
                    '+blah'
                );
            });

            it('should produce a diff when the assertion fails but there is no diff in the headers', function () {
                expect(function () {
                    expect(new HttpResponse('HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\nargh'), 'to satisfy', {statusLine: {statusCode: 200}, headers: {'Content-Type': 'application/json'}, body: 'blah'});
                }, 'to throw',
                    'expected\n' +
                    'HTTP/1.1 200 OK\n' +
                    'Content-Type: text/html\n' +
                    '\n' +
                    'argh\n' +
                    'to satisfy\n' +
                    '{\n' +
                    '  statusLine: { statusCode: 200 },\n' +
                    "  headers: { 'Content-Type': 'application/json' },\n" +
                    "  body: 'blah'\n" +
                    '}\n' +
                    '\n' +
                    'Diff:\n' +
                    '\n' +
                    'HTTP/1.1 200 OK\n' +
                    'Content-Type: text/html // should satisfy application/json\n' +
                    '\n' +
                    '-argh\n' +
                    '+blah'
                );
            });

            it('should produce a diff when the assertion fails, but there is no diff in the body', function () {
                expect(function () {
                    expect(new HttpResponse('HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\nargh'), 'to satisfy', {statusLine: {statusCode: 412}, headers: {'Content-Type': 'application/json'}});
                }, 'to throw',
                    'expected\n' +
                    'HTTP/1.1 200 OK\n' +
                    'Content-Type: text/html\n' +
                    '\n' +
                    'argh\n' +
                    'to satisfy\n' +
                    '{\n' +
                    '  statusLine: { statusCode: 412 },\n' +
                    "  headers: { 'Content-Type': 'application/json' }\n" +
                    '}\n' +
                    '\n' +
                    'Diff:\n' +
                    '\n' +
                    'HTTP/1.1 200 OK // should be 412 Precondition Failed\n' +
                    'Content-Type: text/html // should satisfy application/json\n' +
                    '\n' +
                    'argh'
                );
            });
        });
    });

    describe('HttpExchange', function () {
        describe('#inspect', function () {
            it('should render an exchange', function () {
                expect(new HttpExchange({
                    request: 'GET / HTTP/1.1\nContent-Type: application/json\n\n{"foo":123}',
                    response: 'HTTP/1.1 200 OK\nContent-Type: application/json\nQuux: Baz\n\n{"foo":123}'
                }), 'to inspect as',
                    'GET / HTTP/1.1\n' +
                    'Content-Type: application/json\n' +
                    '\n' +
                    '{ foo: 123 }\n' +
                    '\n' +
                    'HTTP/1.1 200 OK\n' +
                    'Content-Type: application/json\n' +
                    'Quux: Baz\n' +
                    '\n' +
                    '{ foo: 123 }'
                );
            });

            it('should render an exchange without a request', function () {
                expect(new HttpExchange({
                    response: 'HTTP/1.1 200 OK\nContent-Type: application/json\nQuux: Baz\n\n{"foo":123}'
                }), 'to inspect as',
                    '<no request>\n' +
                    '\n' +
                    'HTTP/1.1 200 OK\n' +
                    'Content-Type: application/json\n' +
                    'Quux: Baz\n' +
                    '\n' +
                    '{ foo: 123 }'
                );
            });

            it('should render an exchange without a response', function () {
                expect(new HttpExchange({
                    request: 'GET / HTTP/1.1\nContent-Type: application/json\n\n{"foo":123}'
                }), 'to inspect as',
                    'GET / HTTP/1.1\n' +
                    'Content-Type: application/json\n' +
                    '\n' +
                    '{ foo: 123 }\n' +
                    '\n' +
                    '<no response>'
                );
            });
        });

        describe('#diff', function () {
            it('should diff two HttpExchange instances', function () {
                expect([
                    new HttpExchange({
                        request: 'GET / HTTP/1.1\nContent-Type: application/json\n\n{"foo":123}',
                        response: 'HTTP/1.1 200 OK\nContent-Type: application/json\nQuux: Baz\n\n{"foo":123}'
                    }),
                    new HttpExchange({
                        request: 'GET / HTTP/1.1\nContent-Type: application/json\n\n{"foo":123}',
                        response: 'HTTP/1.1 412 Precondition Failed\nContent-Type: application/json\n\n{"foo":456}'
                    })
                ], 'to produce a diff of',
                    'GET / HTTP/1.1\n' +
                    'Content-Type: application/json\n' +
                    '\n' +
                    '{\n' +
                    '  foo: 123\n' +
                    '}\n' +
                    '\n' +
                    'HTTP/1.1 200 OK // should be 412 Precondition Failed\n' +
                    'Content-Type: application/json\n' +
                    'Quux: Baz // should be removed\n' +
                    '\n' +
                    '{\n' +
                    '  foo: 123 // should be: 456\n' +
                    '}'
                );
            });
        });
    });

    describe('HttpConversation', function () {
        describe('#inspect', function () {
            it('should render a conversation with two exchanges', function () {
                expect(new HttpConversation({
                    exchanges: [
                        {
                            request: 'GET / HTTP/1.1\nContent-Type: application/json\n\n{"foo":123}',
                            response: 'HTTP/1.1 200 OK\nContent-Type: application/json\nQuux: Baz\n\n{"foo":123}'
                        },
                        {
                            request: 'GET / HTTP/1.1\nContent-Type: application/json\n\n{"foo":123}',
                            response: 'HTTP/1.1 200 OK\nContent-Type: application/json\nQuux: Baz\n\n{"foo":123}'
                        }
                    ]
                }), 'to inspect as',
                    'GET / HTTP/1.1\n' +
                    'Content-Type: application/json\n' +
                    '\n' +
                    '{ foo: 123 }\n' +
                    '\n' +
                    'HTTP/1.1 200 OK\n' +
                    'Content-Type: application/json\n' +
                    'Quux: Baz\n' +
                    '\n' +
                    '{ foo: 123 }\n' +
                    '\n' +
                    'GET / HTTP/1.1\n' +
                    'Content-Type: application/json\n' +
                    '\n' +
                    '{ foo: 123 }\n' +
                    '\n' +
                    'HTTP/1.1 200 OK\n' +
                    'Content-Type: application/json\n' +
                    'Quux: Baz\n' +
                    '\n' +
                    '{ foo: 123 }'
                );
            });
        });

        describe('#diff', function () {
            it('should diff two conversations of the same length', function () {
                expect([
                    new HttpConversation({
                        exchanges: [
                            {
                                request: 'GET / HTTP/1.1\nContent-Type: application/json\n\n{"foo":123}',
                                response: 'HTTP/1.1 200 OK\nContent-Type: application/json\nQuux: Baz\n\n{"foo":123}'
                            },
                            {
                                request: 'GET / HTTP/1.1\nContent-Type: application/json\n\n{"foo":123}',
                                response: 'HTTP/1.1 200 OK\nContent-Type: application/json\nQuux: Baz\n\n{"foo":123}'
                            }
                        ]
                    }),
                    new HttpConversation({
                        exchanges: [
                            {
                                request: 'GET / HTTP/1.1\nContent-Type: application/json\n\n{"foo":123}',
                                response: 'HTTP/1.1 412 Precondition Failed\nContent-Type: application/json\n\n{"foo":456}'
                            },
                            {
                                request: 'GET / HTTP/1.1\nContent-Type: application/json\n\n{"foo":123}',
                                response: 'HTTP/1.1 412 Precondition Failed\nContent-Type: application/json\n\n{"foo":456}'
                            }
                        ]
                    })
                ], 'to produce a diff of',
                    'GET / HTTP/1.1\n' +
                    'Content-Type: application/json\n' +
                    '\n' +
                    '{\n' +
                    '  foo: 123\n' +
                    '}\n' +
                    '\n' +
                    'HTTP/1.1 200 OK // should be 412 Precondition Failed\n' +
                    'Content-Type: application/json\n' +
                    'Quux: Baz // should be removed\n' +
                    '\n' +
                    '{\n' +
                    '  foo: 123 // should be: 456\n' +
                    '}\n' +
                    '\n' +
                    'GET / HTTP/1.1\n' +
                    'Content-Type: application/json\n' +
                    '\n' +
                    '{\n' +
                    '  foo: 123\n' +
                    '}\n' +
                    '\n' +
                    'HTTP/1.1 200 OK // should be 412 Precondition Failed\n' +
                    'Content-Type: application/json\n' +
                    'Quux: Baz // should be removed\n' +
                    '\n' +
                    '{\n' +
                    '  foo: 123 // should be: 456\n' +
                    '}'
                );
            });

            it('should diff conversations where the first has more exchanges', function () {
                expect([
                    new HttpConversation({
                        exchanges: [
                            {
                                request: 'GET / HTTP/1.1\nContent-Type: application/json\n\n{"foo":123}',
                                response: 'HTTP/1.1 200 OK\nContent-Type: application/json\nQuux: Baz\n\n{"foo":123}'
                            },
                            {
                                request: 'GET / HTTP/1.1\nContent-Type: application/json\n\n{"foo":123}',
                                response: 'HTTP/1.1 200 OK\nContent-Type: application/json\nQuux: Baz\n\n{"foo":123}'
                            }
                        ]
                    }),
                    new HttpConversation({
                        exchanges: [
                            {
                                request: 'GET / HTTP/1.1\nContent-Type: application/json\n\n{"foo":123}',
                                response: 'HTTP/1.1 412 Precondition Failed\nContent-Type: application/json\n\n{"foo":456}'
                            }
                        ]
                    })
                ], 'to produce a diff of',
                    'GET / HTTP/1.1\n' +
                    'Content-Type: application/json\n' +
                    '\n' +
                    '{\n' +
                    '  foo: 123\n' +
                    '}\n' +
                    '\n' +
                    'HTTP/1.1 200 OK // should be 412 Precondition Failed\n' +
                    'Content-Type: application/json\n' +
                    'Quux: Baz // should be removed\n' +
                    '\n' +
                    '{\n' +
                    '  foo: 123 // should be: 456\n' +
                    '}\n' +
                    '\n' +
                    '// should be removed:\n' +
                    '// GET / HTTP/1.1\n' +
                    '// Content-Type: application/json\n' +
                    '// \n' +
                    '// { foo: 123 }\n' +
                    '// \n' +
                    '// HTTP/1.1 200 OK\n' +
                    '// Content-Type: application/json\n' +
                    '// Quux: Baz\n' +
                    '// \n' +
                    '// { foo: 123 }'
                );
            });

            it('should diff conversations where the second has more exchanges', function () {
                expect([
                    new HttpConversation({
                        exchanges: [
                            {
                                request: 'GET / HTTP/1.1\nContent-Type: application/json\n\n{"foo":123}',
                                response: 'HTTP/1.1 200 OK\nContent-Type: application/json\nQuux: Baz\n\n{"foo":123}'
                            }
                        ]
                    }),
                    new HttpConversation({
                        exchanges: [
                            {
                                request: 'GET / HTTP/1.1\nContent-Type: application/json\n\n{"foo":123}',
                                response: 'HTTP/1.1 412 Precondition Failed\nContent-Type: application/json\n\n{"foo":456}'
                            },
                            {
                                request: 'GET / HTTP/1.1\nContent-Type: application/json\n\n{"foo":123}',
                                response: 'HTTP/1.1 412 Precondition Failed\nContent-Type: application/json\n\n{"foo":456}'
                            }
                        ]
                    })
                ], 'to produce a diff of',
                    'GET / HTTP/1.1\n' +
                    'Content-Type: application/json\n' +
                    '\n' +
                    '{\n' +
                    '  foo: 123\n' +
                    '}\n' +
                    '\n' +
                    'HTTP/1.1 200 OK // should be 412 Precondition Failed\n' +
                    'Content-Type: application/json\n' +
                    'Quux: Baz // should be removed\n' +
                    '\n' +
                    '{\n' +
                    '  foo: 123 // should be: 456\n' +
                    '}\n' +
                    '\n' +
                    '// missing:\n' +
                    '// GET / HTTP/1.1\n' +
                    '// Content-Type: application/json\n' +
                    '// \n' +
                    '// { foo: 123 }\n' +
                    '// \n' +
                    '// HTTP/1.1 412 Precondition Failed\n' +
                    '// Content-Type: application/json\n' +
                    '// \n' +
                    '// { foo: 456 }'
                );
            });
        });
    });
});
