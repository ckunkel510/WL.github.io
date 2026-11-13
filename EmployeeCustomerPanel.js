/* Employee-only customer drawer. Workshop candidate; not loaded by the live header. */
(function (root, factory) {
  'use strict';
  var core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  else core.boot(root);
})(typeof window === 'object' ? window : null, function () {
  'use strict';
  var PANEL = 'ctl00_EmployeeStatusBar_LogonBarPanel';
  var CHANGE = 'ctl00_EmployeeStatusBar_SelectCustomerImageButton';
  var SUMMARY_FIELDS = ['Net Balance', 'Account Balance', 'Overdue', 'Credit Limit', 'Available Credit', 'Terms', 'Payment Terms', 'On Order'];
  var LINKS = [
    ['AccountInfo_R.aspx', 'Full account'], ['OpenOrders_r.aspx', 'Orders'],
    ['OpenQuotes_r.aspx', 'Quotes'], ['Invoices_r.aspx', 'Invoices'],
    ['AddressList_R.aspx', 'Addresses'], ['Contacts_r.aspx', 'Contacts']
  ];
  function text(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
  function setText(element, value) { if (element.textContent !== value) element.textContent = value; }
  function identity(value) {
    var match = text(value).match(/^(.+)\(\s*([^()]*)\s*\)$/);
    if (!match || !text(match[1]) || !/^[a-z0-9 ._\/-]{1,64}$/i.test(text(match[2]))) return null;
    return { name: text(match[1]), code: text(match[2]), key: text(match[2]).toUpperCase() };
  }
  function nativeLabel(panel) {
    return panel && panel.querySelector('.d-flex.flex-wrap.trunc-width');
  }
  function context(doc) {
    var panel = doc.getElementById(PANEL), label = nativeLabel(panel);
    return panel && label ? identity(label.textContent) : null;
  }
  function followingSection(doc, label) {
    var cells = Array.from(doc.querySelectorAll('.panelAccountInfo td'));
    var heading = cells.find(function (cell) { return text(cell.textContent).toLowerCase() === label.toLowerCase(); });
    return heading && heading.parentElement.nextElementSibling;
  }
  function accountSummary(doc, expected, origin) {
    var staff = context(doc);
    var heading = identity(text(doc.querySelector('.panel.panelAccountInfo .listPageHeader')?.textContent).replace(/^Account Information for\s*/i, ''));
    if (!expected || !staff || !heading || staff.key !== expected.key || heading.key !== expected.key) {
      throw new Error('customer-context-changed');
    }
    var address = Array.from(doc.querySelectorAll('.accountInfoAddress li')).map(function (e) { return text(e.textContent).slice(0, 180); }).filter(Boolean).slice(0, 5);
    var contact = [], contactSection = followingSection(doc, 'Contact details');
    Array.from(contactSection?.querySelectorAll('tr') || []).forEach(function (row) {
      var cells = Array.from(row.children), label = text(cells[0]?.textContent).replace(/:$/, ''), value = text(cells[1]?.textContent);
      if (/^(Tel|Telephone|Phone|Fax|Contact|Email)$/i.test(label) && value) contact.push({ label: label, value: value.slice(0, 180) });
    });
    var stats = [];
    Array.from(doc.querySelectorAll('#ctl00_PageBody_AccountActivity_AccountActivityLeftColumn tr')).forEach(function (row) {
      var cells = Array.from(row.children), label = text(cells[0]?.textContent).replace(/:$/, ''), value = text(cells[1]?.textContent);
      if (SUMMARY_FIELDS.includes(label) && value) stats.push({ label: label, value: value.slice(0, 100) });
    });
    var links = LINKS.filter(function (entry) {
      return Array.from(doc.querySelectorAll('a[href]')).some(function (anchor) {
        try {
          var url = new URL(anchor.getAttribute('href'), origin);
          return url.origin === origin && url.pathname.toLowerCase() === '/' + entry[0].toLowerCase() && !url.search && !url.hash;
        } catch (_) { return false; }
      });
    }).map(function (entry) { return { label: entry[1], href: '/' + entry[0] }; });
    var rep = text(followingSection(doc, 'Sales Rep(s)')?.textContent).replace(/^Contact:\s*/i, '').slice(0, 180);
    return { customer: heading, address: address, contact: contact, stats: stats, salesRep: rep, links: links };
  }
  function installStyle(doc) {
    if (doc.getElementById('wl-staff-customer-style')) return;
    var style = doc.createElement('style'); style.id = 'wl-staff-customer-style';
    style.textContent = `
      .sticky-header .wl-staff-slot{min-width:0!important;margin-right:auto!important;flex:0 0 auto}
      #${PANEL}.wl-staff-customer-ready{height:38px!important;min-height:0!important;overflow:visible!important;display:flex!important;align-items:center!important}
      .wl-staff-customer-ready>.d-flex{height:100%;min-width:0}
      .wl-staff-customer-source-label{display:none!important}
      .wl-staff-customer-toggle{display:flex;align-items:center;gap:8px;min-width:0;width:clamp(112px,18vw,220px);height:38px;padding:3px 12px!important;border:0!important;border-radius:0!important;background:transparent!important;color:#fff!important;text-align:left;font:600 13px/1.2 Arial,sans-serif;cursor:pointer}
      .wl-staff-customer-toggle>span{min-width:0}.wl-staff-customer-toggle>span:not([aria-hidden]){flex:1}.wl-staff-customer-toggle>span[aria-hidden]{flex:0 0 auto}.wl-staff-customer-toggle small{display:block;font-size:9px;letter-spacing:.06em;text-transform:uppercase;opacity:.85}.wl-staff-customer-toggle strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}
      .wl-staff-customer-toggle:hover{background:#ffffff1f!important}.wl-staff-customer-toggle:focus-visible{outline:2px solid #fff!important;outline-offset:-3px}
      .wl-staff-customer-backdrop{position:fixed;inset:0;background:#10151d66;z-index:2147483099}
      .wl-staff-customer-drawer{box-sizing:border-box;position:fixed;inset:0 0 0 auto;width:min(430px,100%);height:100vh;height:100dvh;display:flex;flex-direction:column;background:#f7f7f8;box-shadow:-12px 0 36px #10151d26;z-index:2147483100;color:#25262b;font:14px/1.5 Arial,sans-serif}
      .wl-staff-customer-drawer *, .wl-staff-customer-drawer *::before{box-sizing:border-box}.wl-staff-customer-drawer[hidden],.wl-staff-customer-backdrop[hidden]{display:none!important}
      .wl-staff-customer-head{display:flex;gap:12px;align-items:flex-start;padding:22px 20px;background:#fff;border-bottom:1px solid #e1e1e5}.wl-staff-customer-head>div{flex:1;min-width:0}.wl-staff-customer-head small{display:block;color:#6b0016;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.08em}.wl-staff-customer-head h2{margin:4px 0;font-size:24px;line-height:1.2;overflow-wrap:anywhere;color:#25262b}.wl-staff-customer-code{color:#666a74;font-size:12px}
      .wl-staff-customer-close{flex:none;width:44px;height:44px;border:1px solid #d9d9df;border-radius:50%;background:#fff;color:#333;font:24px Arial;cursor:pointer}
      .wl-staff-customer-content{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:18px 20px}.wl-staff-customer-card{padding:16px;background:#fff;border:1px solid #e0e0e5;border-radius:12px;margin-bottom:14px}.wl-staff-customer-card h3{font-size:13px;margin:0 0 12px;color:#565b65}.wl-staff-customer-card p{margin:4px 0;overflow-wrap:anywhere}.wl-staff-customer-card dl{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px 16px;margin:0}.wl-staff-customer-card dt{font-size:11px;color:#686d76}.wl-staff-customer-card dd{font-size:16px;font-weight:700;margin:0;overflow-wrap:anywhere}
      .wl-staff-customer-links{display:grid;grid-template-columns:1fr 1fr;gap:10px}.wl-staff-customer-links a{display:flex;align-items:center;min-height:44px;padding:10px 12px;background:#fff;border:1px solid #d9d9e0;border-radius:9px;color:#6b0016;text-decoration:none;font-weight:700}
      .wl-staff-customer-foot{padding:14px 20px max(14px,env(safe-area-inset-bottom));background:#fff;border-top:1px solid #e1e1e5;display:grid;grid-template-columns:1fr auto;gap:10px}.wl-staff-customer-foot .customer-change-button{display:flex!important;align-items:center!important;justify-content:center!important;min-height:44px!important;width:auto!important;margin:0!important;padding:10px 14px!important;border-radius:8px!important;background:#6b0016!important;color:#fff!important;font:700 14px Arial!important;text-decoration:none!important}.wl-staff-customer-refresh{min-height:44px;padding:10px 14px;border:1px solid #d1d2da;border-radius:8px;background:#fff;color:#373b44;font-weight:700;cursor:pointer}.wl-staff-customer-foot small{grid-column:1/-1;color:#6b7079;font-size:11px}
      .wl-staff-customer-drawer :is(a,button):focus-visible{outline:3px solid #6b0016;outline-offset:2px}.wl-staff-customer-status{color:#59616b;padding:20px 0}
      @media(max-width:767px){.wl-staff-customer-toggle{width:100px;padding-inline:8px!important;gap:4px}.wl-staff-customer-toggle>svg{display:none}.wl-staff-customer-head{padding:18px 16px}.wl-staff-customer-content{padding:16px}.wl-staff-customer-foot{padding-inline:16px}}
      @media(max-width:359px){.wl-staff-customer-toggle{width:82px}.wl-staff-customer-head h2{font-size:21px}}
    `;
    doc.head.appendChild(style);
  }
  function boot(win) {
    if (!win || win.top !== win || win.WLStaffCustomerPanel) return;
    var doc = win.document, active = null, scheduled = false;
    function mount(panel) {
      var native = panel.querySelector('#' + CHANGE), source = nativeLabel(panel);
      if (!native || !source) return null;
      installStyle(doc);
      var wrapper = native.parentElement, nativeNext = native.nextSibling, slot = panel.parentElement;
      var toggle = doc.createElement('button'); toggle.type = 'button'; toggle.className = 'wl-staff-customer-toggle'; toggle.id = 'wl-staff-customer-toggle';
      toggle.setAttribute('aria-haspopup', 'dialog'); toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-controls', 'wl-staff-customer-drawer');
      toggle.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/></svg><span><small>Customer</small><strong></strong></span><span aria-hidden="true">›</span>';
      var backdrop = doc.createElement('div'); backdrop.className = 'wl-staff-customer-backdrop'; backdrop.hidden = true;
      var drawer = doc.createElement('section'); drawer.id = 'wl-staff-customer-drawer'; drawer.className = 'wl-staff-customer-drawer'; drawer.hidden = true; drawer.setAttribute('role', 'dialog'); drawer.setAttribute('aria-modal', 'true'); drawer.setAttribute('aria-labelledby', 'wl-staff-customer-title');
      drawer.innerHTML = '<header class="wl-staff-customer-head"><div><small>Employee customer view</small><h2 id="wl-staff-customer-title">Customer details</h2><div class="wl-staff-customer-code"></div></div><button type="button" class="wl-staff-customer-close" aria-label="Close customer details">×</button></header><div class="wl-staff-customer-content" aria-live="polite"></div><footer class="wl-staff-customer-foot"><button type="button" class="wl-staff-customer-refresh">Refresh</button><small>Details refresh when opened. Changing customer uses WebTrack.</small></footer>';
      var content = drawer.querySelector('.wl-staff-customer-content'), footer = drawer.querySelector('footer'), closeButton = drawer.querySelector('.wl-staff-customer-close');
      footer.insertBefore(native, footer.firstChild);
      (doc.getElementById('aspnetForm') || doc.body).append(backdrop, drawer);
      source.classList.add('wl-staff-customer-source-label'); panel.classList.add('wl-staff-customer-ready'); slot.classList.add('wl-staff-slot'); wrapper.insertBefore(toggle, source);
      var opened = false, current = null, request = null, epoch = 0, overflow = '', previousFocus = null;
      function status(message) { content.replaceChildren(); var p = doc.createElement('p'); p.className = 'wl-staff-customer-status'; p.textContent = message; content.appendChild(p); }
      function card(title) { var section = doc.createElement('section'); section.className = 'wl-staff-customer-card'; var h = doc.createElement('h3'); h.textContent = title; section.appendChild(h); content.appendChild(section); return section; }
      function paragraph(parent, value) { var p = doc.createElement('p'); p.textContent = value; parent.appendChild(p); }
      function render(summary) {
        content.replaceChildren();
        if (summary.stats.length) { var account = card('Account snapshot'), dl = doc.createElement('dl'); summary.stats.forEach(function (field) { var pair = doc.createElement('div'), dt = doc.createElement('dt'), dd = doc.createElement('dd'); dt.textContent = field.label; dd.textContent = field.value; pair.append(dt, dd); dl.appendChild(pair); }); account.appendChild(dl); }
        var details = card('Address & contact');
        summary.address.forEach(function (line) { paragraph(details, line); });
        summary.contact.forEach(function (field) { paragraph(details, field.label + ': ' + field.value); });
        if (!summary.address.length && !summary.contact.length) paragraph(details, 'No address or contact details are listed for this customer.');
        if (summary.salesRep) paragraph(card('Sales representative'), summary.salesRep);
        if (summary.links.length) { var links = doc.createElement('nav'); links.className = 'wl-staff-customer-links'; links.setAttribute('aria-label', 'Selected customer account pages'); summary.links.forEach(function (entry) { var a = doc.createElement('a'); a.href = entry.href; a.textContent = entry.label; a.addEventListener('click', function (event) { if (context(doc)?.key !== current?.key) { event.preventDefault(); sync(); } }); links.appendChild(a); }); content.appendChild(links); }
      }
      async function load() {
        var expected = context(doc), sequence = ++epoch;
        if (request) request.abort();
        var controller = new win.AbortController(); request = controller;
        drawer.dataset.state = 'loading';
        status(expected ? 'Loading this customer’s account details…' : 'Choose a customer to view account details.');
        if (!expected) return;
        var timer = win.setTimeout(function () { controller.abort(); }, 12000);
        try {
          var response = await win.fetch('/AccountInfo_R.aspx', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
          if (!response.ok || (response.url && new URL(response.url, win.location.origin).origin !== win.location.origin)) throw new Error('account-unavailable');
          var html = await response.text();
          if (!opened || sequence !== epoch || context(doc)?.key !== expected.key) return;
          var summary = accountSummary(new win.DOMParser().parseFromString(html, 'text/html'), expected, win.location.origin);
          render(summary); drawer.dataset.state = 'ready';
        } catch (error) {
          if (!opened || sequence !== epoch) return;
          drawer.dataset.state = 'unavailable';
          status(error.message === 'customer-context-changed' ? 'The selected customer changed. Reload this page before viewing account details.' : 'Account details could not load. Refresh to try again, or open the full account page.');
        } finally { win.clearTimeout(timer); }
      }
      function close(restore) {
        if (!opened) return;
        opened = false; epoch++; request?.abort(); drawer.hidden = backdrop.hidden = true; toggle.setAttribute('aria-expanded', 'false'); content.replaceChildren(); doc.body.style.overflow = overflow;
        if (restore !== false) (previousFocus?.isConnected ? previousFocus : toggle).focus({ preventScroll: true });
      }
      function sync() {
        var next = context(doc), changed = next?.key !== current?.key;
        current = next;
        setText(toggle.querySelector('strong'), next?.name || 'Select customer');
        toggle.setAttribute('aria-label', next ? 'Customer details for ' + next.name + ' (' + next.code + ')' : 'Select customer');
        setText(drawer.querySelector('h2'), next?.name || 'Customer details'); setText(drawer.querySelector('.wl-staff-customer-code'), next ? 'Customer ' + next.code : '');
        if (changed) close(false);
      }
      function open() { if (opened) return; sync(); previousFocus = doc.activeElement; overflow = doc.body.style.overflow; doc.body.style.overflow = 'hidden'; opened = true; drawer.hidden = backdrop.hidden = false; toggle.setAttribute('aria-expanded', 'true'); drawer.dataset.state = 'loading'; closeButton.focus(); load(); }
      toggle.addEventListener('click', function () { if (opened) close(); else open(); });
      closeButton.addEventListener('click', function () { close(); }); backdrop.addEventListener('click', function () { close(); });
      drawer.querySelector('.wl-staff-customer-refresh').addEventListener('click', load);
      native.addEventListener('click', function () { close(false); });
      drawer.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') { event.preventDefault(); close(); }
        if (event.key !== 'Tab') return;
        var targets = Array.from(drawer.querySelectorAll('button,a[href]')).filter(function (e) { return !e.disabled && e.getClientRects().length; }), first = targets[0], last = targets[targets.length - 1];
        if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first.focus(); }
      });
      sync();
      return { panel: panel, sync: sync, close: close, open: open, dispose: function () { close(false); wrapper.insertBefore(native, nativeNext?.parentNode === wrapper ? nativeNext : null); source.classList.remove('wl-staff-customer-source-label'); panel.classList.remove('wl-staff-customer-ready'); slot.classList.remove('wl-staff-slot'); toggle.remove(); drawer.remove(); backdrop.remove(); } };
    }
    function refresh() {
      scheduled = false;
      var panel = doc.getElementById(PANEL);
      if (active && active.panel === panel) { active.sync(); return; }
      active?.dispose(); active = panel ? mount(panel) : null;
    }
    function schedule() { if (!scheduled) { scheduled = true; win.requestAnimationFrame(refresh); } }
    win.WLStaffCustomerPanel = { refresh: refresh, open: function () { active?.open(); }, close: function () { active?.close(); } };
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', refresh, { once: true }); else refresh();
    var observer = new win.MutationObserver(schedule); observer.observe(doc.body || doc.documentElement, { childList: true, subtree: true, characterData: true });
    win.addEventListener('pagehide', function () { observer.disconnect(); active?.close(false); }, { once: true });
    doc.addEventListener('visibilitychange', function () { if (doc.hidden) active?.close(false); });
  }
  return { identity: identity, accountSummary: accountSummary, boot: boot };
});
