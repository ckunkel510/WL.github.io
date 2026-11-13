(function () {
  'use strict';
  var errors = [], nativeActions = 0;
  window.addEventListener('error', function (event) { errors.push(event.message); });
  document.getElementById('fixture-native-action').addEventListener('click', function () {
    nativeActions++;
    document.getElementById('native-result').textContent = 'Native action invoked ' + nativeActions + ' time(s).';
  });
  Tawk_API.onLoad();

  document.getElementById('run-layout-checks').addEventListener('click', function () {
    var results = document.getElementById('layout-results'), passed = 0, failed = 0;
    results.replaceChildren();
    function check(name, assertion) {
      var row = document.createElement('li');
      try { if (!assertion()) throw new Error('Assertion failed'); row.className = 'pass'; row.textContent = 'PASS — ' + name; passed++; }
      catch (error) { row.className = 'fail'; row.textContent = 'FAIL — ' + name + ': ' + error.message; failed++; }
      results.appendChild(row);
    }
    function box(selector) { return document.querySelector(selector).getBoundingClientRect(); }
    check('logo and store hours stay in normal flow with legacy tablet styles installed', function () {
      return getComputedStyle(document.querySelector('#wlcheader>a')).position === 'static' && getComputedStyle(document.getElementById('wl-store-hours')).position === 'static';
    });
    check('store hours sit below the logo inside the branding row', function () {
      var logo = box('#wlcheader>a:first-child'), hours = box('#wl-store-hours'), brand = box('#brandingLogo');
      return hours.top >= logo.bottom - 1 && hours.left >= brand.left - 1 && hours.right <= brand.right + 1 && hours.bottom <= brand.bottom + 1;
    });
    check('branding has no legacy float, shadow or forty-pixel bottom margin', function () {
      var style = getComputedStyle(document.getElementById('brandingLogo'));
      return style.cssFloat === 'none' && style.boxShadow === 'none' && parseFloat(style.marginBottom) === 0;
    });
    check('all page buttons fit on one row and retain their destinations', function () {
      var links = Array.from(document.querySelectorAll('.pagination .page-link')), top = links[0].getBoundingClientRect().top;
      return links.every(function (link) { return Math.abs(link.getBoundingClientRect().top - top) < 1; }) && links[2].getAttribute('href') === '#2';
    });
    check('pagination and document have no horizontal overflow', function () {
      var pager = document.querySelector('.pagination');
      return pager.scrollWidth <= pager.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1;
    });
    check('the native sort menu retains a full touch target in Safari and Chrome', function () {
      return box('.searchDropDown').height >= 44 && document.querySelector('.searchDropDown').options.length === 2;
    });
    check('utility links inherit one background color', function () {
      return getComputedStyle(document.querySelector('.menu-t1')).backgroundColor === 'rgba(0, 0, 0, 0)';
    });
    check('chat lives in the utility bar and the floating prompt is hidden', function () {
      var button = document.getElementById('wl-chat-launcher');
      return button && !button.hidden && button.closest('.main-nav') && document.getElementById('fixture-native-widget').hidden;
    });
    check('chat opens on request, preserves the original load callback and stays open on refresh', function () {
      var before = fixtureChat.loadCalls;
      document.getElementById('wl-chat-launcher').click();
      Tawk_API.onLoad();
      return fixtureChat.open && !document.getElementById('fixture-chat-panel').hidden && fixtureChat.loadCalls === before + 1;
    });
    check('minimizing chat preserves its callback and returns focus without a floating launcher', function () {
      var before = fixtureChat.minimizeCalls;
      Tawk_API.minimize();
      var button = document.getElementById('wl-chat-launcher');
      return fixtureChat.minimizeCalls === before + 1 && button.getAttribute('aria-expanded') === 'false' && document.activeElement === button && document.getElementById('fixture-native-widget').hidden;
    });
    check('native field value and exactly-once action handler are preserved', function () {
      var before = nativeActions;
      document.getElementById('fixture-native-action').click();
      return nativeActions === before + 1 && document.getElementById('fixture-quantity').value === '2' && document.getElementById('fixture-quantity').name === 'nativeQuantity';
    });
    check('no uncaught runtime errors', function () { return errors.length === 0; });
    document.getElementById('layout-summary').textContent = passed + ' passed · ' + failed + ' failed at ' + innerWidth + ' × ' + innerHeight;
    document.documentElement.dataset.layoutResult = failed ? 'fail' : 'pass';
  });
})();
