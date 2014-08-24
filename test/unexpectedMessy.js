/*global describe, it*/
var messy = require('messy'),
    Headers = messy.Headers,
    HttpRequest = messy.HttpRequest,
    HttpResponse = messy.HttpResponse,
    Message = messy.Message,
    unexpected = require('unexpected'),
    unexpectedMessy = require('../lib/unexpectedMessy');

describe('unexpected-messy', function () {
    var expect = unexpected.clone().installPlugin(unexpectedMessy);
    describe('Headers', function () {
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
        });
    });

    describe('HttpRequest', function () {
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

    describe('HttpResponse', function () {
        describe('to satisfy assertion', function () {
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
                    headers: {
                        'Content-Type': 'text/html'
                    }
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
        });
    });

    describe('Message', function () {
        describe('to satisfy assertion', function () {
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
        });
    });
});
