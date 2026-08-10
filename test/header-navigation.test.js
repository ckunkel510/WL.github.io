const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const wixHeader = fs.readFileSync(path.join(root, 'woodson-unified-header.js'), 'utf8');
const webTrackHeader = fs.readFileSync(path.join(root, 'headermodern.js'), 'utf8');

test('both desktop headers expose the same compact primary navigation', () => {
  for (const source of [wixHeader, webTrackHeader]) {
    assert.match(source, /"Shop"/);
    assert.match(source, /"Locations"/);
    assert.match(source, /"About Woodson"/);
    assert.match(source, /"Credit"/);
    assert.match(source, /"Our History"/);
    assert.match(source, /"Careers"/);
  }
});

test('location menus use the public Woodson store pages', () => {
  for (const source of [wixHeader, webTrackHeader]) {
    for (const slug of ['brenham', 'bryan', 'buffalo', 'caldwell', 'groesbeck', 'lexington', 'mexia']) {
      assert.match(source, new RegExp('MAIN_SITE \\+ "/' + slug + '"'));
    }
  }
  assert.doesNotMatch(webTrackHeader, /LOCATIONS_URL = "\/Default\.aspx\?view=storelocations"/);
});

test('Woodson header receives only sanitized WebTrack header state', () => {
  assert.match(wixHeader, /event\.origin !== WEBTRACK/);
  assert.match(wixHeader, /event\.data\.type !== "WL_HEADER_STATE"/);
  assert.match(webTrackHeader, /cartCount:/);
  assert.match(webTrackHeader, /savedCount:/);
  assert.match(webTrackHeader, /signedIn:/);
  assert.match(webTrackHeader, /accountName:/);
  assert.match(webTrackHeader, /storeName:/);
  assert.doesNotMatch(webTrackHeader, /document\.cookie/);
});
