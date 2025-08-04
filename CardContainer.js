
(function () {
  // ---------- config ----------
  const IDS = {
    main: '.mainContents',
    radioNew: 'ctl00_PageBody_rbCreditCard',
    radioStored: 'ctl00_PageBody_rbStoredCard',
    selectStored: 'ctl00_PageBody_ddlCardsOnFile',
    cardsHost: 'ctl00_PageBody_CardsOnFileContainer',
    continueBtnId: null, // e.g. 'ctl00_PageBody_ContinueButton' if you know it; else leave null
  };

  // ---------- utils ----------
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const byId = id => document.getElementById(id);
  const onReady = fn => (document.readyState !== 'loading') ? fn() : document.addEventListener('DOMContentLoaded', fn);
  const waitFor = (testFn, {tries=40, delay=100} = {}) => new Promise(res=>{
    const t = setInterval(()=>{
      if (testFn()) { clearInterval(t); res(true); }
      if (--tries <= 0) { clearInterval(t); res(false); }
    }, delay);
  });

  function getContinueButton() {
    if (IDS.continueBtnId && byId(IDS.continueBtnId)) return byId(IDS.continueBtnId);
    // fallback: look for a visible button/link with "Continue"
    const main = $(IDS.main) || document;
    return $('button, a', main) && $$('button, a', main).find(el => /continue/i.test(el.textContent || ''));
  }

  // Parse "8464 Apple" => { last4: "8464", name: "Apple" }
  function parseCardOptionText(txt) {
    const m = (txt || '').trim().match(/^(\d{4})\s+(.*)$/);
    return m ? { last4: m[1], name: m[2] } : { last4: txt.trim(), name: '' };
  }

  function buildCardTile({ last4, name, isNew=false, selected=false }) {
    const div = document.createElement('div');
    div.className = 'wl-card-tile' + (isNew ? ' is-new' : '') + (selected ? ' is-selected' : '');
    div.setAttribute('role', 'button');
    div.setAttribute('tabindex', '0');
    div.innerHTML = isNew
      ? `
        <div class="wl-card-face">
          <div class="wl-card-brand">New card</div>
          <div class="wl-card-pan">•••• •••• •••• ••••</div>
        </div>
      `
      : `
        <div class="wl-card-face">
          <div class="wl-card-brand">${escapeHTML(name || 'Stored card')}</div>
          <div class="wl-card-pan">•••• •••• •••• ${escapeHTML(last4)}</div>
        </div>
      `;
    return div;
  }

  function clearSelected(root) { $$('.wl-card-tile.is-selected', root).forEach(el => el.classList.remove('is-selected')); }
  function selectTile(el) { el.classList.add('is-selected'); }
  function escapeHTML(s){ return (s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  // ---------- main enhancer ----------
  async function enhanceStoredCards() {
    const main = $(IDS.main);
    if (!main) return;

    const rNew = byId(IDS.radioNew);
    const rStored = byId(IDS.radioStored);
    const host = byId(IDS.cardsHost);
    if (!rNew || !rStored || !host) return;

    // If already enhanced, just return
    if (host.querySelector('.wl-card-picker')) return;

    // 1) Make sure stored radio is checked so dropdown populates (WebForms may postback to fill it)
    if (!rStored.checked) {
      rStored.checked = true;
      // trigger any attached onchange/onclick (WebForms)
      rStored.dispatchEvent(new Event('click', {bubbles:true}));
      rStored.dispatchEvent(new Event('change', {bubbles:true}));
    }

    // 2) Wait for the dropdown to exist (and populate)
    const ok = await waitFor(()=> !!byId(IDS.selectStored) && byId(IDS.selectStored).options.length > 0, {tries:40, delay:125});
    const ddl = byId(IDS.selectStored);
    if (!ok || !ddl) return;

    // Hide the native radio table & select (keep for server postback)
    const cardTable = byId('CardToUseContainer');
    if (cardTable) cardTable.style.display = 'none';
    ddl.style.display = 'none';

    // 3) Build visual picker
    const picker = document.createElement('div');
    picker.className = 'wl-card-picker';
    // tiles container
    const list = document.createElement('div');
    list.className = 'wl-card-list';

    // New card tile goes first
    const newTile = buildCardTile({ isNew:true });
    list.appendChild(newTile);

    // Stored cards
    Array.from(ddl.options).forEach((opt, idx) => {
      const { last4, name } = parseCardOptionText(opt.text);
      const tile = buildCardTile({ last4, name, isNew:false, selected: opt.selected });
      // click handler
      tile.addEventListener('click', () => {
        clearSelected(list);
        selectTile(tile);
        // choose stored radio, set ddl value, click Continue
        rStored.checked = true;
        ddl.value = opt.value;
        ddl.dispatchEvent(new Event('change', {bubbles:true}));
        const c = getContinueButton();
        if (c) c.click();
      });
      tile.addEventListener('keydown', (e)=>{ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tile.click(); }});
      list.appendChild(tile);
    });

    // New card click
    newTile.addEventListener('click', () => {
      clearSelected(list); selectTile(newTile);
      rNew.checked = true;
      rNew.dispatchEvent(new Event('change', {bubbles:true}));
      const c = getContinueButton();
      if (c) c.click();
    });
    newTile.addEventListener('keydown', (e)=>{ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); newTile.click(); }});

    picker.appendChild(list);
    host.appendChild(picker);

    // Minimal style (scoped)
    injectStyles();
  }

  // ---------- styles ----------
  function injectStyles() {
    if (document.getElementById('wl-card-picker-css')) return;
    const css = document.createElement('style');
    css.id = 'wl-card-picker-css';
    css.textContent = `
      .wl-card-picker { margin: 8px 0 12px; }
      .wl-card-list {
        display: grid;
        gap: 10px;
      }
      @media (min-width: 600px) {
        .wl-card-list { grid-template-columns: repeat(2, minmax(220px, 1fr)); }
      }
      @media (min-width: 992px) {
        .wl-card-list { grid-template-columns: repeat(3, minmax(220px, 1fr)); }
      }
      .wl-card-tile {
        border-radius: 12px;
        background: #6b0016;
        color: #fff;
        padding: 14px;
        cursor: pointer;
        box-shadow: 0 1px 3px rgba(0,0,0,0.12);
        outline: none;
        transition: transform .08s ease, box-shadow .08s ease, background .2s ease;
      }
      .wl-card-tile.is-new { background: #f3f3f5; color: #111; border: 1px solid #e6e6ea; }
      .wl-card-tile.is-selected { box-shadow: 0 0 0 3px rgba(107,0,22,0.25); }
      .wl-card-tile:focus { box-shadow: 0 0 0 3px rgba(107,0,22,0.35); }
      .wl-card-tile:hover { transform: translateY(-1px); }
      .wl-card-face { display: grid; gap: 6px; }
      .wl-card-brand { font-weight: 700; }
      .wl-card-pan { font-variant-numeric: tabular-nums; letter-spacing: 1px; }
    `;
    document.head.appendChild(css);
  }

  // ---------- WebForms/SPA hooks to re-run after partial postbacks ----------
  function attachWebFormsReinit() {
    try {
      if (window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager) {
        var prm = Sys.WebForms.PageRequestManager.getInstance();
        if (!prm._wlCardsHooked) {
          prm.add_endRequest(function(){ enhanceStoredCards(); });
          prm._wlCardsHooked = true;
        }
      }
    } catch(e){}
    // Also observe container for dynamic changes
    const target = $(IDS.main) || document.body;
    if (!target || target._wlCardsObserver) return;
    const mo = new MutationObserver(()=> {
      // If the stored card radio or container appears, try enhance
      if (byId(IDS.radioStored) && byId(IDS.cardsHost)) enhanceStoredCards();
    });
    mo.observe(target, {childList:true, subtree:true});
    target._wlCardsObserver = mo;
  }

  // ---------- boot ----------
  onReady(() => {
    attachWebFormsReinit();
    enhanceStoredCards();
  });

})();
