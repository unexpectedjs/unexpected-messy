A specific implementation of the [to satisfy](http://unexpectedjs.github.io/assertions/any/to-satisfy/) assertion
for use with [messy.HttpRequest](https://github.com/papandreou/messy) instances.

```js
var httpRequest = new messy.HttpRequest(
    'GET /foo HTTP/1.1\n' +
    'Content-Type: text/plain; charset=UTF-8\n' +
    'Content-Length: 13\n' +
    '\n' +
    'Hello, world!'
);

expect(httpRequest, 'to satisfy', {
    headers: {
        Foo: 'bar',
        'Content-Length': 13
    },
    body: /Hi/
});
```

```output
expected
GET /foo HTTP/1.1
Content-Type: text/plain; charset=UTF-8
Content-Length: 13

Hello, world!
to satisfy { headers: { Foo: 'bar', 'Content-Length': 13 }, body: /Hi/ }

GET /foo HTTP/1.1
Content-Type: text/plain; charset=UTF-8
Content-Length: 13
// missing Foo: bar

Hello, world! // should match /Hi/
```
