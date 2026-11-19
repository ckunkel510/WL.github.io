'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const read = file => fs.readFileSync(require.resolve('../' + file), 'utf8');
const header = read('config/webtrack-payment-google-header.html').match(/<script>([\s\S]*?)<\/script>/)[1];

function headerFixture(path) {
  const requests = [], meta = {}, attributes = {};
  const first = { parentNode: { insertBefore(node) { requests.push(node.src); } } };
  const document = {
    documentElement: { setAttribute(key, value) { attributes[key] = value; } },
    querySelector() { return null; },
    createElement(tag) { return tag === 'meta' ? meta : {}; },
    head: { appendChild(node) { if (node.src) requests.push(node.src); } },
    getElementsByTagName() { return [first]; }
  };
  const window = { location: new URL(path, 'https://webtrack.woodsonlumber.com') };
  vm.runInNewContext(header, { window, document, decodeURIComponent });
  return { requests, meta, attributes, window };
}

const privatePaths = [
  '/Payment.aspx', '/payment.ASPX?utm=ccverify',
  '/Payment.aspx?PaymentForOrderID=opaque&MinPaymentAmount=opaque',
  '/SignIn.aspx?Redirect=' + encodeURIComponent('https://webtrack.woodsonlumber.com/Payment.aspx?PaymentForOrderID=opaque'),
  '/SignIn.aspx?Redirect=' + encodeURIComponent(encodeURIComponent('/Payment.aspx?MinPaymentAmount=opaque')),
  '/Products.aspx?PaymentForOrderID=opaque&bad=%'
];

test('the early header makes zero Google requests for payment links and secret-bearing sign-in returns', () => {
  for (const path of privatePaths) {
    const f = headerFixture(path);
    assert.deepEqual(f.requests, [], path);
    assert.equal(f.window.dataLayer, undefined, path);
    assert.equal(f.meta.content, 'no-referrer', path);
    assert.equal(f.attributes['data-wl-payment-privacy'], '1', path);
  }
});

test('ordinary product, cart, and account pages retain both original Google tags', () => {
  for (const path of ['/Products.aspx?searchText=drill', '/ProductDetail.aspx?pid=85', '/ShoppingCart.aspx', '/AccountInfo_R.aspx']) {
    const f = headerFixture(path);
    assert.equal(f.requests.length, 2, path);
    assert.ok(f.requests[0].endsWith('gtm.js?id=GTM-THH9MLK7'));
    assert.ok(f.requests[1].endsWith('gtag/js?id=AW-676092620'));
  }
});

test('every analytics entry exits before touching document, storage, or transport on private payment contexts', () => {
  for (const file of ['wl-site.js', 'Analytics.js', 'wl-commerce.js', 'wl-events.js']) {
    for (const path of privatePaths) {
      const document = new Proxy({}, { get() { throw Error('analytics touched the page'); } });
      const window = { location: new URL(path, 'https://webtrack.woodsonlumber.com') };
      vm.runInNewContext(read(file), { window, document, decodeURIComponent });
      assert.equal(window.WLAnalytics, undefined, file + path);
    }
  }
});

test('the header loader and all compatibility aliases use the same privacy predicate', () => {
  const predicate = source => source.slice(source.indexOf('  function paymentPageIsPrivate('), source.indexOf('\n  }', source.indexOf('  function paymentPageIsPrivate(')) + 4);
  for (const file of ['headermodern.js', 'wl-site.js', 'Analytics.js', 'wl-commerce.js', 'wl-events.js']) {
    assert.equal(predicate(read(file)), predicate(header), file);
  }
  assert.match(read('headermodern.js'), /function loadAnalytics\(\) \{\s+if \(paymentPageIsPrivate\(window.location\)\) return;/);
});
