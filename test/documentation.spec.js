/*global unexpected*/
// THIS FILE IS AUTOGENERATED! DO NOT CHANGE IT MANUALLY.
// It is built based on the examples in the documentation folder
// when the documentation site gets build by running "make site-build".
it.skipIf = function (condition) {
    (condition ? it.skip : it).apply(it, Array.prototype.slice.call(arguments, 1));
};

describe("documentation tests", function () {
    var isBrowser = typeof weknowhow !== 'undefined';
    var isPhantom = typeof mochaPhantomJS !== 'undefined';
    var expect;
    beforeEach(function () {
        expect = unexpected.clone();
        expect.output.preferredWidth = 80;

    });

    it("index.md contains correct examples", function () {
        var testPromises = [];
        try {
            expect(new messy.HttpResponse(
                'HTTP/1.1 200 OK\r\n' +
                'Content-Type: application/json\r\n' +
                '\r\n' +
                '{"foo":"bar","baz":456}'
            ), 'to satisfy', {statusCode: 404, body: {baz: expect.it('to be greater than', 1024)}});
            expect.fail(function (output) {
                output.error("expected:").nl();
                output.code("expect(new messy.HttpResponse(").nl();
                output.code("    'HTTP/1.1 200 OK\\r\\n' +").nl();
                output.code("    'Content-Type: application/json\\r\\n' +").nl();
                output.code("    '\\r\\n' +").nl();
                output.code("    '{\"foo\":\"bar\",\"baz\":456}'").nl();
                output.code("), 'to satisfy', {statusCode: 404, body: {baz: expect.it('to be greater than', 1024)}});").nl();
                output.error("to throw");
            });
        } catch (e) {
            expect(e, "to have message",
                "expected\n" +
                "HTTP/1.1 200 OK\n" +
                "Content-Type: application/json\n" +
                "\n" +
                "{ foo: 'bar', baz: 456 }\n" +
                "to satisfy { statusCode: 404, body: { baz: expect.it('to be greater than', 1024) } }\n" +
                "\n" +
                "HTTP/1.1 200 OK // should be 404 Not Found\n" +
                "Content-Type: application/json\n" +
                "\n" +
                "{\n" +
                "  foo: 'bar',\n" +
                "  baz: 456 // expected 456 to be greater than 1024\n" +
                "}"
            );
        }
        return expect.promise.all(testPromises);
    });
});