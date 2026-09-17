const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const wixHeader = fs.readFileSync(path.join(root, 'woodson-unified-header.js'), 'utf8');
const webTrackHeader = fs.readFileSync(path.join(root, 'headermodern.js'), 'utf8');
const urlSanitizer = fs.readFileSync(path.join(root, 'URLSanitize.js'), 'utf8');

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

test('WebTrack account links use reliable Woodson-owned destinations', () => {
  assert.match(webTrackHeader, /function buildReturnToPageSignInUrl\(\)/);
  assert.match(webTrackHeader, /signIn\.searchParams\.set\("Redirect", current\.toString\(\)\)/);
  assert.match(webTrackHeader, /WEBTRACK \+ "\/AccountInfo_R\.aspx"/);
  assert.match(webTrackHeader, /setAccountLinkLabel\(link, "My Account"\)/);
  assert.match(webTrackHeader, /"my account": "fa-user-circle"/);

  const firstUpgrade = webTrackHeader.indexOf('changed = upgradeAccountNavigation() || changed;');
  const mobileMenu = webTrackHeader.indexOf('changed = buildMobileAccountMenu() || changed;');
  const secondUpgrade = webTrackHeader.indexOf('changed = upgradeAccountNavigation() || changed;', firstUpgrade + 1);
  assert.ok(firstUpgrade > -1 && firstUpgrade < mobileMenu);
  assert.ok(secondUpgrade > mobileMenu);
});

test('URL cleanup preserves only the trusted same-site header return link', () => {
  assert.match(urlSanitizer, /function isTrustedHeaderSignInLink\(anchor, urlObj\)/);
  assert.match(urlSanitizer, /data-wl-account-link"\) !== "sign-in"/);
  assert.match(urlSanitizer, /destination\.origin !== window\.location\.origin/);
  assert.match(urlSanitizer, /return !\/\\\/SignIn\\\.aspx\$\/i\.test\(destination\.pathname\)/);
  assert.equal((urlSanitizer.match(/isTrustedHeaderSignInLink\(a, url\)/g) || []).length, 2);
});
