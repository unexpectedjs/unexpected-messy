Asserts that a messy.HttpResponse instance satisfies the given spec.

```js
var httpResponse = new messy.HttpResponse({
    headers: {
        'Content-Type': 'image/png'
    },
    body: require('fs').readFileSync('node_modules/unexpected/node_modules/magicpen/images/magic-pen-6-colours.jpg')
});

expect(httpResponse, 'to satisfy', { headers: { 'Content-Type': 'image/gif' } });
```

```output
expected

Content-Type: image/png

Buffer([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01 /* 13493 more */ ])
to satisfy { headers: { 'Content-Type': 'image/gif' } }


Content-Type: image/png // should equal image/gif
                        // -image/png
                        // +image/gif

Buffer([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01 /* 13493 more */ ])
```
