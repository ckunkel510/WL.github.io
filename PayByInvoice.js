/**
 * PayByInvoice.js (Guided Flow rewrite)
 * Target: AccountPayment_r.aspx
 *
 * Goals:
 *  - Provide a modern, guided one-page payment experience.
 *  - Let user choose how they want to pay: Lump Sum / Selected Invoices / By Job Ref.
 *  - Always populate Remittance Advice with something meaningful.
 *  - Keep native WebForms controls as the source of truth for submission (PaymentAmountTextBox, RemittanceAdviceTextBox, etc.).
 *  - Hide optional Address field group.
 *
 * NOTE: Payment method (ACH/Card/etc.) wiring can be added later once those element IDs/markup are confirmed.
 */
(function () {
  'use strict';

  var WL = window.WLPayFlow || (window.WLPayFlow = {});
  WL.version = '2026-02-18-guided-flow-v1';

  function log() {
    try {
      var args = Array.prototype.slice.call(arguments);
      args.unshift('[WL PayFlow]');
      console.log.apply(console, args);
    } catch (_) {}
  }

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }
  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function onReady(fn) {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(fn, 0);
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  }

  function safeText(el) {
    return (el && (el.textContent || '')).trim();
  }

  function moneyToNumber(s) {
    if (s == null) return 0;
    var t = String(s).replace(/[^0-9.\-]/g, '');
    var n = parseFloat(t);
    return Number.isFinite(n) ? n : 0;
  }

  function numberToMoney(n) {
    try {
      return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch (_) {
      return (Math.round(n * 100) / 100).toFixed(2);
    }
  }

  function ensureStyle() {
    if (qs('#wl-payflow-style')) return;
    var style = document.createElement('style');
    style.id = 'wl-payflow-style';
    style.textContent = `
      /* Page baseline */
      .bodyFlexContainer { max-width: 1180px; margin: 0 auto; }

      /* Hide legacy bits we rebuild */
      .wl-hide-native { display:none !important; }

      /* Guided container */
      .wl-payflow-wrap { 
        margin: 14px auto 28px auto;
        padding: 0;
      }
      .wl-payflow-hero {
        display:flex; align-items:flex-start; justify-content:space-between; gap:14px;
        background: #ffffff;
        border: 1px solid rgba(15,23,42,.10);
        border-radius: 16px;
        padding: 16px 16px;
        box-shadow: 0 10px 30px rgba(2,6,23,.06);
      }
      .wl-payflow-title {
        font-size: 20px; font-weight: 700; line-height: 1.2;
        margin: 0;
      }
      .wl-payflow-sub {
        margin: 6px 0 0 0; color: rgba(15,23,42,.72);
        font-size: 13px; line-height: 1.35;
      }
      .wl-pillrow { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
      .wl-pill {
        font-size: 12px; font-weight: 600;
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid rgba(15,23,42,.12);
        background: rgba(2,6,23,.02);
        color: rgba(15,23,42,.75);
        cursor: pointer;
        user-select:none;
      }
      .wl-pill[aria-selected="true"]{
        background: rgba(107,0,22,.08);
        border-color: rgba(107,0,22,.25);
        color: #6b0016;
      }

      .wl-payflow-grid {
        display:grid;
        grid-template-columns: 1fr 360px;
        gap: 14px;
        margin-top: 14px;
      }
      @media (max-width: 980px) {
        .wl-payflow-grid { grid-template-columns: 1fr; }
      }

      .wl-card {
        background:#fff;
        border: 1px solid rgba(15,23,42,.10);
        border-radius: 16px;
        box-shadow: 0 8px 22px rgba(2,6,23,.05);
        overflow:hidden;
      }
      .wl-card-h {
        padding: 12px 14px;
        border-bottom: 1px solid rgba(15,23,42,.08);
        display:flex; justify-content:space-between; align-items:center; gap:10px;
      }
      .wl-card-h .wl-h1 { font-weight: 700; font-size: 14px; margin:0; }
      .wl-card-h .wl-h2 { font-size:12px; color: rgba(15,23,42,.65); margin:0; }
      .wl-card-b { padding: 14px; }

      .wl-section-note {
        font-size: 12px;
        color: rgba(15,23,42,.70);
        margin: 0 0 10px 0;
        line-height: 1.35;
      }

      /* Better form styling for native controls */
      .wl-form-modern .epi-form-group-acctPayment { margin-bottom: 12px; }
      .wl-form-modern .epi-form-group-acctPayment > div:first-child label,
      .wl-form-modern .epi-form-group-acctPayment > div:first-child span {
        font-weight: 700;
        color: rgba(15,23,42,.86);
        display:block;
        margin-bottom: 6px;
      }
      .wl-form-modern .epi-form-group-acctPayment input.form-control,
      .wl-form-modern .epi-form-group-acctPayment select.form-control,
      .wl-form-modern .epi-form-group-acctPayment textarea.form-control {
        width: 100% !important;
        max-width: 720px;
        min-height: 46px;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid rgba(15,23,42,.18);
        background: rgba(2,6,23,.02);
        box-shadow: inset 0 1px 0 rgba(255,255,255,.8);
        font-size: 14px;
      }
      .wl-form-modern .epi-form-group-acctPayment textarea.form-control { min-height: 96px; }
      .wl-form-modern .descriptionMessage { margin: 6px 0 0 0; font-size: 12px; color: rgba(15,23,42,.65); }

      /* Invoice table */
      .wl-table-wrap { border: 1px solid rgba(15,23,42,.10); border-radius: 14px; overflow:hidden; }
      .wl-table-tools { display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-bottom: 10px; }
      .wl-input {
        width: 100%;
        max-width: 420px;
        min-height: 42px;
        border-radius: 12px;
        border: 1px solid rgba(15,23,42,.18);
        padding: 10px 12px;
        background: rgba(2,6,23,.02);
        font-size: 14px;
      }
      .wl-btn {
        appearance:none; border: 1px solid rgba(15,23,42,.18);
        background: #fff;
        border-radius: 12px;
        padding: 10px 12px;
        font-weight: 700;
        font-size: 13px;
        cursor: pointer;
      }
      .wl-btn-primary {
        background: #0f172a;
        color: #fff;
        border-color: #0f172a;
      }
      .wl-btn-danger {
        background: rgba(220,38,38,.08);
        color: rgb(185,28,28);
        border-color: rgba(220,38,38,.25);
      }

      table.wl-table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }
      .wl-table th, .wl-table td {
        padding: 10px 10px;
        border-bottom: 1px solid rgba(15,23,42,.08);
        font-size: 13px;
        vertical-align: top;
        overflow:hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .wl-table th { background: rgba(2,6,23,.03); font-weight: 800; color: rgba(15,23,42,.85); }
      .wl-table td.num, .wl-table th.num { text-align: right; }
      .wl-table td.chk, .wl-table th.chk { width: 44px; text-align: center; }
      .wl-tag {
        display:inline-block;
        font-size: 11px;
        font-weight: 800;
        border-radius: 999px;
        padding: 4px 8px;
        background: rgba(107,0,22,.08);
        color: #6b0016;
        border: 1px solid rgba(107,0,22,.18);
      }

      /* Summary sidebar */
      .wl-summary {
        position: sticky;
        top: 12px;
      }
      .wl-kv { display:flex; justify-content:space-between; gap:10px; margin: 10px 0; }
      .wl-kv span { color: rgba(15,23,42,.72); font-size: 12px; }
      .wl-kv strong { font-size: 14px; }
      .wl-callout {
        margin-top: 10px;
        padding: 10px 12px;
        border-radius: 14px;
        border: 1px solid rgba(15,23,42,.10);
        background: rgba(2,6,23,.02);
        font-size: 12px;
        color: rgba(15,23,42,.75);
        line-height: 1.35;
      }

      .wl-divider { height: 1px; background: rgba(15,23,42,.08); margin: 12px 0; }

      .wl-hidden { display:none !important; }
    `;
    document.head.appendChild(style);
  }

  function pageMatches() {
    var p = (location.pathname || '').toLowerCase();
    return p.indexOf('accountpayment') !== -1; // AccountPayment_r.aspx
  }

  function getNativeEls() {
    return {
      amountOwing: qs('#ctl00_PageBody_AmountOwingLiteral'),
      payAmount: qs('#ctl00_PageBody_PaymentAmountTextBox'),
      billingAddr: qs('#ctl00_PageBody_BillingAddressTextBox'),
      billingAddrMsg: qs('#ctl00_PageBody_BillingAddressValidatorMessage'),
      postal: qs('#ctl00_PageBody_PostalCodeTextBox'),
      postalMsg: qs('#ctl00_PageBody_PostalCodeValidatorMessage'),
      email: qs('#ctl00_PageBody_EmailAddressTextBox'),
      notes: qs('#ctl00_PageBody_NotesTextBox'),
      remit: qs('#ctl00_PageBody_RemittanceAdviceTextBox'),
      addressGroupLabel: qs('label[for="ctl00_PageBody_AddressDropdownList"]'),
      invoiceGrid: qs('#ctl00_PageBody_InvoicesGrid'),
      invoiceGridTable: qs('#ctl00_PageBody_InvoicesGrid_ctl00'),
      pageContainer: qs('.bodyFlexContainer')
    };
  }

  function hideOptionalAddress(native) {
    // Hide the Address group entirely (optional)
    try {
      if (!native.addressGroupLabel) return;
      var group = native.addressGroupLabel.closest('.epi-form-group-acctPayment');
      if (group) group.classList.add('wl-hide-native');
    } catch (_) {}
  }

  function parseInvoices(native) {
    var data = [];
    var table = native.invoiceGridTable;
    if (!table) return data;
    var rows = qsa('tbody tr', table);
    rows.forEach(function (tr) {
      var get = function (title) {
        var td = qs('td[data-title="' + title + '"]', tr);
        return safeText(td);
      };
      var type = get('Type');
      var branch = get('Branch');
      var transDate = get('Transaction Date');
      var doc = get('Doc. #');
      var job = get('Job Ref');
      var cust = get('Customer Ref');
      var amount = moneyToNumber(get('Amount'));
      var outstanding = moneyToNumber(get('Amount Outstanding'));
      var due = get('Due Date');
      if (!doc) return;
      data.push({
        type: type,
        branch: branch,
        transDate: transDate,
        doc: doc,
        job: job,
        cust: cust,
        amount: amount,
        outstanding: outstanding,
        due: due
      });
    });
    return data;
  }

  function buildUI(native, invoices) {
    // Hide native invoice grid and paging controls; we will provide our own selector table.
    try {
      var transPanel = qs('#ctl00_PageBody_accountsTransactionsPanel');
      if (transPanel) transPanel.classList.add('wl-hide-native');
    } catch (_) {}

    // Wrap: insert after list header
    var header = qs('.listPageHeader', native.pageContainer) || null;

    var wrap = document.createElement('div');
    wrap.className = 'wl-payflow-wrap';

    wrap.innerHTML = `
      <div class="wl-payflow-hero">
        <div>
          <h2 class="wl-payflow-title">Make a Payment</h2>
          <p class="wl-payflow-sub">Choose how you’d like to pay, confirm your details, and submit your payment. We’ll automatically fill your remittance advice based on your selections.</p>
        </div>
        <div class="wl-pillrow" role="tablist" aria-label="Pay options">
          <div class="wl-pill" role="tab" tabindex="0" data-mode="lump" aria-selected="true">Pay a lump sum</div>
          <div class="wl-pill" role="tab" tabindex="0" data-mode="invoices" aria-selected="false">Pay selected invoices</div>
          <div class="wl-pill" role="tab" tabindex="0" data-mode="job" aria-selected="false">Pay by job / reference</div>
        </div>
      </div>

      <div class="wl-payflow-grid">
        <div>
          <div class="wl-card" id="wlCardInfo">
            <div class="wl-card-h">
              <div>
                <p class="wl-h1">1) Your details</p>
                <p class="wl-h2">Confirm billing and contact info</p>
              </div>
            </div>
            <div class="wl-card-b wl-form-modern" id="wlInfoHost"></div>
          </div>

          <div style="height: 14px"></div>

          <div class="wl-card" id="wlCardPayHow">
            <div class="wl-card-h">
              <div>
                <p class="wl-h1">2) What are you paying today?</p>
                <p class="wl-h2">Pick a method below</p>
              </div>
              <span class="wl-tag" id="wlModeTag">Lump sum</span>
            </div>
            <div class="wl-card-b" id="wlHowHost">
              <p class="wl-section-note" id="wlHowNote">Enter the amount you want to pay. We’ll set remittance advice to <strong>“Lump sum payment”</strong>.</p>

              <div id="wlModeLump">
                <div class="wl-table-tools">
                  <button class="wl-btn" id="wlUseOwing">Use amount owing</button>
                  <button class="wl-btn wl-btn-danger" id="wlClearPay">Clear amount</button>
                </div>
                <div class="wl-callout">Tip: If you’re paying specific invoices, use <strong>Pay selected invoices</strong> so we can include invoice numbers automatically.</div>
              </div>

              <div id="wlModeInvoices" class="wl-hidden">
                <div class="wl-table-tools">
                  <input class="wl-input" id="wlInvoiceFilter" placeholder="Filter invoices by doc #, job ref, customer ref…" />
                  <button class="wl-btn" id="wlSelectAllVisible">Select visible</button>
                  <button class="wl-btn wl-btn-danger" id="wlClearSelected">Clear selected</button>
                </div>
                <div class="wl-table-wrap">
                  <table class="wl-table" id="wlInvoiceTable">
                    <thead>
                      <tr>
                        <th class="chk"></th>
                        <th>Doc #</th>
                        <th>Job Ref</th>
                        <th>Customer Ref</th>
                        <th>Due</th>
                        <th class="num">Outstanding</th>
                      </tr>
                    </thead>
                    <tbody id="wlInvoiceTbody"></tbody>
                  </table>
                </div>
              </div>

              <div id="wlModeJob" class="wl-hidden">
                <div class="wl-table-tools">
                  <input class="wl-input" id="wlJobFilter" placeholder="Type a job name / reference to filter…" />
                  <button class="wl-btn" id="wlSelectAllJobs">Select visible</button>
                  <button class="wl-btn wl-btn-danger" id="wlClearJobs">Clear selected</button>
                </div>
                <p class="wl-section-note">Filter by job reference, select the invoices, and we’ll fill remittance advice with the related invoice numbers.</p>
                <div class="wl-table-wrap">
                  <table class="wl-table" id="wlJobTable">
                    <thead>
                      <tr>
                        <th class="chk"></th>
                        <th>Doc #</th>
                        <th>Job Ref</th>
                        <th class="num">Outstanding</th>
                      </tr>
                    </thead>
                    <tbody id="wlJobTbody"></tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div style="height: 14px"></div>

          <div class="wl-card" id="wlCardSubmit">
            <div class="wl-card-h">
              <div>
                <p class="wl-h1">3) Review & submit</p>
                <p class="wl-h2">Confirm payment amount and remittance advice</p>
              </div>
            </div>
            <div class="wl-card-b wl-form-modern" id="wlSubmitHost"></div>
          </div>
        </div>

        <div>
          <div class="wl-card wl-summary">
            <div class="wl-card-h">
              <div>
                <p class="wl-h1">Summary</p>
                <p class="wl-h2">Updates as you select</p>
              </div>
            </div>
            <div class="wl-card-b">
              <div class="wl-kv"><span>Amount owing</span><strong id="wlSumOwing">—</strong></div>
              <div class="wl-kv"><span>Payment amount</span><strong id="wlSumPay">—</strong></div>
              <div class="wl-kv"><span>Selected invoices</span><strong id="wlSumCount">0</strong></div>
              <div class="wl-divider"></div>
              <div class="wl-callout" id="wlRemitPreview">Remittance advice will be filled automatically.</div>
              <div style="height:12px"></div>
              <button class="wl-btn wl-btn-primary" id="wlJumpSubmit">Jump to submit</button>
              <div class="wl-callout" style="margin-top:10px">
                If you’re paying a specific invoice/job, use the invoice selection options so your remittance advice is accurate.
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Insert wrap after header (or at top)
    if (header && header.parentNode) {
      header.parentNode.insertBefore(wrap, header.nextSibling);
    } else {
      native.pageContainer.insertBefore(wrap, native.pageContainer.firstChild);
    }

    // Host native controls: we move blocks into our cards (not clone) so WebForms still submits.
    var leftColumn = qs('.float-left', native.pageContainer);
    if (leftColumn) {
      // The native left column contains all payment fields and make payment panel.
      // We will keep most in Info + Submit cards.
      var groups = qsa('.epi-form-group-acctPayment', leftColumn);

      // Identify which groups belong in info vs submit:
      // Info: Address (hide), Billing address, Zip, Email
      // Submit: Amount owing, Payment amount, Notes, Remittance advice, PayBy radio, MakePaymentPanel
      var infoHost = qs('#wlInfoHost');
      var submitHost = qs('#wlSubmitHost');

      groups.forEach(function (g) {
        var has = function (sel) { return !!qs(sel, g); };

        // hide Address group entirely
        if (has('#ctl00_PageBody_AddressDropdownList')) {
          g.classList.add('wl-hide-native');
          return;
        }

        // Info fields
        if (has('#ctl00_PageBody_BillingAddressTextBox') || has('#ctl00_PageBody_PostalCodeTextBox') || has('#ctl00_PageBody_EmailAddressTextBox')) {
          infoHost.appendChild(g);
          return;
        }

        // Everything else into submit
        submitHost.appendChild(g);
      });

      // Also move MakePaymentPanel (contains submit button panel)
      var makePay = qs('#ctl00_PageBody_MakePaymentPanel', leftColumn);
      if (makePay && submitHost) submitHost.appendChild(makePay);

      // Hide the now-empty original left column container (but keep it in DOM)
      try {
        leftColumn.style.display = 'none';
      } catch (_) {}
    }

    // State
    var state = {
      mode: 'lump',
      invoices: invoices,
      selected: new Map() // doc -> invoice
    };

    // Helpers for remittance + payment
    function setPayAmount(n) {
      if (!native.payAmount) return;
      var v = (typeof n === 'number') ? numberToMoney(n) : String(n || '');
      // keep $ out; server side might accept either; we keep plain numeric
      native.payAmount.value = v.replace(/\$/g, '').trim();
      native.payAmount.dispatchEvent(new Event('input', { bubbles: true }));
      native.payAmount.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function setRemit(text) {
      if (!native.remit) return;
      native.remit.value = String(text || '').trim();
      native.remit.dispatchEvent(new Event('input', { bubbles: true }));
      native.remit.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function computeSelectedTotal() {
      var total = 0;
      state.selected.forEach(function (inv) {
        total += (inv.outstanding || 0);
      });
      return total;
    }

    function buildRemittance() {
      // Always return a non-empty string.
      if (state.mode === 'lump') {
        return 'Lump sum payment';
      }
      if (state.selected.size === 0) {
        return state.mode === 'job' ? 'Job-based payment (no invoices selected)' : 'Invoice-based payment (no invoices selected)';
      }
      var docs = Array.from(state.selected.keys());
      return docs.join(', ');
    }

    function syncSummary() {
      var owing = moneyToNumber(native.amountOwing ? native.amountOwing.value : 0);
      qs('#wlSumOwing').textContent = owing ? ('$' + numberToMoney(owing)) : '—';

      var pay = moneyToNumber(native.payAmount ? native.payAmount.value : 0);
      qs('#wlSumPay').textContent = pay ? ('$' + numberToMoney(pay)) : '—';

      qs('#wlSumCount').textContent = String(state.selected.size);

      var remitText = buildRemittance();
      qs('#wlRemitPreview').innerHTML = '<strong>Remittance:</strong> ' + escapeHtml(remitText);
    }

    function escapeHtml(s) {
      return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function ensureRemittanceFilled() {
      var current = (native.remit && native.remit.value || '').trim();
      if (!current) {
        setRemit(buildRemittance());
      }
    }

    // Build invoice table UIs
    function renderInvoiceRows(tbody, filterFn, cols) {
      tbody.innerHTML = '';
      var filtered = state.invoices.filter(filterFn);

      filtered.forEach(function (inv) {
        var tr = document.createElement('tr');
        var checked = state.selected.has(inv.doc);

        tr.innerHTML = cols(inv, checked);
        // checkbox binding
        var cb = qs('input[type="checkbox"]', tr);
        if (cb) {
          cb.addEventListener('change', function () {
            if (cb.checked) state.selected.set(inv.doc, inv);
            else state.selected.delete(inv.doc);

            if (state.mode === 'invoices' || state.mode === 'job') {
              setPayAmount(computeSelectedTotal());
              setRemit(buildRemittance());
            }
            syncSummary();
          });
        }
        tbody.appendChild(tr);
      });

      syncSummary();
    }

    var invoiceTbody = qs('#wlInvoiceTbody');
    var jobTbody = qs('#wlJobTbody');

    function invoiceFilterPredicate(q) {
      q = (q || '').toLowerCase().trim();
      if (!q) return function () { return true; };
      return function (inv) {
        return (inv.doc || '').toLowerCase().includes(q) ||
               (inv.job || '').toLowerCase().includes(q) ||
               (inv.cust || '').toLowerCase().includes(q);
      };
    }

    // initial render
    renderInvoiceRows(
      invoiceTbody,
      function () { return true; },
      function (inv, checked) {
        return `
          <td class="chk"><input type="checkbox" ${checked ? 'checked' : ''} aria-label="Select invoice ${escapeHtml(inv.doc)}" /></td>
          <td title="${escapeHtml(inv.doc)}">${escapeHtml(inv.doc)}</td>
          <td title="${escapeHtml(inv.job)}">${escapeHtml(inv.job || '')}</td>
          <td title="${escapeHtml(inv.cust)}">${escapeHtml(inv.cust || '')}</td>
          <td title="${escapeHtml(inv.due)}">${escapeHtml(inv.due || '')}</td>
          <td class="num" title="$${numberToMoney(inv.outstanding)}">$${numberToMoney(inv.outstanding)}</td>
        `;
      }
    );

    renderInvoiceRows(
      jobTbody,
      function () { return true; },
      function (inv, checked) {
        return `
          <td class="chk"><input type="checkbox" ${checked ? 'checked' : ''} aria-label="Select invoice ${escapeHtml(inv.doc)}" /></td>
          <td title="${escapeHtml(inv.doc)}">${escapeHtml(inv.doc)}</td>
          <td title="${escapeHtml(inv.job)}">${escapeHtml(inv.job || '')}</td>
          <td class="num" title="$${numberToMoney(inv.outstanding)}">$${numberToMoney(inv.outstanding)}</td>
        `;
      }
    );

    // Mode switching
    var pills = qsa('.wl-pill', wrap);
    function setMode(mode) {
      state.mode = mode;

      pills.forEach(function (p) {
        var selected = p.getAttribute('data-mode') === mode;
        p.setAttribute('aria-selected', selected ? 'true' : 'false');
      });

      qs('#wlModeTag').textContent = mode === 'lump' ? 'Lump sum' : (mode === 'invoices' ? 'Invoices' : 'Job');

      qs('#wlModeLump').classList.toggle('wl-hidden', mode !== 'lump');
      qs('#wlModeInvoices').classList.toggle('wl-hidden', mode !== 'invoices');
      qs('#wlModeJob').classList.toggle('wl-hidden', mode !== 'job');

      var note = qs('#wlHowNote');
      if (mode === 'lump') {
        note.innerHTML = 'Enter the amount you want to pay. We’ll set remittance advice to <strong>“Lump sum payment”</strong>.';
        // set remittance default
        setRemit('Lump sum payment');
      } else if (mode === 'invoices') {
        note.innerHTML = 'Select invoices below. We’ll set the payment amount and fill remittance advice with the invoice numbers.';
        setPayAmount(computeSelectedTotal());
        setRemit(buildRemittance());
      } else {
        note.innerHTML = 'Filter by job/reference, select invoices, and we’ll fill remittance advice with invoice numbers.';
        setPayAmount(computeSelectedTotal());
        setRemit(buildRemittance());
      }

      syncSummary();
    }

    pills.forEach(function (p) {
      var mode = p.getAttribute('data-mode');
      var handler = function () { setMode(mode); };
      p.addEventListener('click', handler);
      p.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handler();
        }
      });
    });

    // Invoice tools
    var invFilter = qs('#wlInvoiceFilter');
    if (invFilter) {
      invFilter.addEventListener('input', function () {
        var pred = invoiceFilterPredicate(invFilter.value);
        renderInvoiceRows(invoiceTbody, pred, function (inv, checked) {
          return `
            <td class="chk"><input type="checkbox" ${checked ? 'checked' : ''} /></td>
            <td title="${escapeHtml(inv.doc)}">${escapeHtml(inv.doc)}</td>
            <td title="${escapeHtml(inv.job)}">${escapeHtml(inv.job || '')}</td>
            <td title="${escapeHtml(inv.cust)}">${escapeHtml(inv.cust || '')}</td>
            <td title="${escapeHtml(inv.due)}">${escapeHtml(inv.due || '')}</td>
            <td class="num">$${numberToMoney(inv.outstanding)}</td>
          `;
        });
      });
    }

    var jobFilter = qs('#wlJobFilter');
    if (jobFilter) {
      jobFilter.addEventListener('input', function () {
        var q = (jobFilter.value || '').toLowerCase().trim();
        var pred = function (inv) {
          if (!q) return true;
          return (inv.job || '').toLowerCase().includes(q) || (inv.doc || '').toLowerCase().includes(q);
        };
        renderInvoiceRows(jobTbody, pred, function (inv, checked) {
          return `
            <td class="chk"><input type="checkbox" ${checked ? 'checked' : ''} /></td>
            <td title="${escapeHtml(inv.doc)}">${escapeHtml(inv.doc)}</td>
            <td title="${escapeHtml(inv.job)}">${escapeHtml(inv.job || '')}</td>
            <td class="num">$${numberToMoney(inv.outstanding)}</td>
          `;
        });
      });
    }

    function selectVisible(tbody) {
      qsa('tr', tbody).forEach(function (tr) {
        var doc = safeText(qs('td:nth-child(2)', tr));
        if (!doc) return;
        var inv = state.invoices.find(function (x) { return x.doc === doc; });
        if (!inv) return;
        state.selected.set(inv.doc, inv);
        var cb = qs('input[type="checkbox"]', tr);
        if (cb) cb.checked = true;
      });
      setPayAmount(computeSelectedTotal());
      setRemit(buildRemittance());
      syncSummary();
    }

    function clearSelected(tbody) {
      qsa('input[type="checkbox"]', tbody).forEach(function (cb) { cb.checked = false; });
      state.selected.clear();
      if (state.mode !== 'lump') {
        setPayAmount(0);
        setRemit(buildRemittance());
      }
      syncSummary();
    }

    var btnSelAllInv = qs('#wlSelectAllVisible');
    if (btnSelAllInv) btnSelAllInv.addEventListener('click', function () { selectVisible(invoiceTbody); });

    var btnClrInv = qs('#wlClearSelected');
    if (btnClrInv) btnClrInv.addEventListener('click', function () { clearSelected(invoiceTbody); });

    var btnSelAllJob = qs('#wlSelectAllJobs');
    if (btnSelAllJob) btnSelAllJob.addEventListener('click', function () { selectVisible(jobTbody); });

    var btnClrJob = qs('#wlClearJobs');
    if (btnClrJob) btnClrJob.addEventListener('click', function () { clearSelected(jobTbody); });

    // Lump sum tools
    var btnUseOwing = qs('#wlUseOwing');
    if (btnUseOwing) {
      btnUseOwing.addEventListener('click', function () {
        var owing = moneyToNumber(native.amountOwing ? native.amountOwing.value : 0);
        if (owing > 0) setPayAmount(owing);
        setRemit('Lump sum payment');
        syncSummary();
      });
    }

    var btnClearPay = qs('#wlClearPay');
    if (btnClearPay) {
      btnClearPay.addEventListener('click', function () {
        setPayAmount('');
        setRemit('Lump sum payment');
        syncSummary();
      });
    }

    // Jump to submit
    var btnJump = qs('#wlJumpSubmit');
    if (btnJump) {
      btnJump.addEventListener('click', function () {
        var target = qs('#wlCardSubmit');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    // Keep summary in sync when user types payment amount manually
    if (native.payAmount) {
      native.payAmount.addEventListener('input', function () {
        if (state.mode === 'lump') setRemit('Lump sum payment');
        syncSummary();
      });
      native.payAmount.addEventListener('change', function () {
        if (state.mode === 'lump') setRemit('Lump sum payment');
        syncSummary();
      });
    }

    // On submit attempts, enforce remittance non-empty.
    // We don't know the exact submit button markup; bind broadly.
    function bindSubmitGuard() {
      // any button or input within MakePaymentPanel
      var panel = qs('#ctl00_PageBody_MakePaymentPanel');
      if (!panel) return;
      var candidates = qsa('button, input[type="submit"], input[type="button"]', panel);
      candidates.forEach(function (btn) {
        btn.addEventListener('click', function () {
          ensureRemittanceFilled();
        }, true);
      });

      // also guard form submission
      var form = qs('form');
      if (form && !form.__wlPayflowBound) {
        form.__wlPayflowBound = true;
        form.addEventListener('submit', function () {
          ensureRemittanceFilled();
        }, true);
      }
    }

    // Hide optional address
    hideOptionalAddress(native);

    // Set defaults
    setMode('lump');
    ensureRemittanceFilled();
    syncSummary();
    bindSubmitGuard();

    // If Telerik / UpdatePanel does partial postbacks, keep enforcing remittance & summary.
    // We hook into ASP.NET AJAX if present.
    try {
      if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager) {
        var prm = Sys.WebForms.PageRequestManager.getInstance();
        prm.add_endRequest(function () {
          // Re-acquire native refs (they can be replaced)
          var n2 = getNativeEls();
          native.amountOwing = n2.amountOwing;
          native.payAmount = n2.payAmount;
          native.remit = n2.remit;
          // Always keep remittance populated
          ensureRemittanceFilled();
          syncSummary();
          bindSubmitGuard();
        });
      }
    } catch (_) {}

    log('Guided flow initialized', WL.version, { invoices: invoices.length });
  }

  function init() {
    if (!pageMatches()) return;
    ensureStyle();

    var native = getNativeEls();
    if (!native.pageContainer || !native.payAmount || !native.remit) {
      log('Waiting for native elements...');
      return false;
    }

    // Hide the old listPageHeader text (we rebuild hero)
    try {
      var hdr = qs('.listPageHeader', native.pageContainer);
      if (hdr) hdr.classList.add('wl-hide-native');
    } catch (_) {}

    // Parse invoices
    var invoices = parseInvoices(native);
    buildUI(native, invoices);

    return true;
  }

  function initWithRetry() {
    var attempts = 0;
    var maxAttempts = 60; // ~30s

    var t = setInterval(function () {
      attempts++;
      var ok = false;
      try { ok = init(); } catch (e) { console.error('[WL PayFlow] init error', e); }
      if (ok) clearInterval(t);
      if (attempts >= maxAttempts) {
        clearInterval(t);
        log('Init failed (timed out).');
      }
    }, 500);
  }

  onReady(initWithRetry);
})();
