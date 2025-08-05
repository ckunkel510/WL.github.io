
(function () {
  if (window.CheckoutUI) return; // guard
  window.CheckoutUI = {
    sections: {},

    // --- Utilities ---
    q: (sel) => (Array.isArray(sel) ? sel.find(s => s && document.querySelector(s)) : sel),
    getVal(sel) {
      const s = this.q(sel); if (!s) return "";
      const el = document.querySelector(s);
      return el ? (el.value ?? "").toString().trim() : "";
    },
    setVal(sel, v) {
      const s = this.q(sel); if (!s) return;
      const el = document.querySelector(s);
      if (el) { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }
    },
    setChecked(sel, checked) {
      const s = this.q(sel); if (!s) return;
      const el = document.querySelector(s);
      if (el) { el.checked = !!checked; el.dispatchEvent(new Event("change", { bubbles: true })); }
    },
    setStatus(key, ok) {
      const el = document.getElementById(`status-${key}`);
      if (!el) return;
      el.textContent = ok ? "✓" : "✗";
      el.classList.toggle("ok", ok);
      el.classList.toggle("bad", !ok);
    },
    openDrawer(title, bodyHTML, onSave) {
      const overlay = document.getElementById("coDrawerOverlay");
      const drawer  = document.getElementById("coDrawer");
      document.getElementById("coDrawerTitle").textContent = title;
      const body = document.getElementById("coDrawerBody");
      body.innerHTML = bodyHTML;
      drawer.dataset.saveHandlerId = String(Date.now());
      this._currentSave = onSave || null;
      overlay.classList.add("active");
      drawer.classList.add("active");
    },
    closeDrawer(saved) {
      const overlay = document.getElementById("coDrawerOverlay");
      const drawer  = document.getElementById("coDrawer");
      overlay.classList.remove("active");
      drawer.classList.remove("active");
      if (saved && typeof this._currentSave === "function") this._currentSave();
      this._currentSave = null;
      this.refreshAll();
    },

    // Register a section card
    addSection({ key, title, render, complete }) {
      this.sections[key] = { render, complete };

      const container = document.getElementById("checkoutSummaryPanel");
      if (!container) return;

      if (!document.getElementById(`card-${key}`)) {
        const wrap = document.createElement("div");
        wrap.className = "checkout-summary-section";
        wrap.id = `card-${key}`;
        wrap.dataset.section = key;
        wrap.innerHTML = `
          <div class="section-title-row">
            <span class="section-status" id="status-${key}">•</span>
            <h3>${title}</h3>
          </div>
          <p id="summary-${key}">Loading...</p>
          <button class="edit-button" data-edit="${key}">Edit</button>
        `;
        container.appendChild(wrap);
      }
      this.refreshOne(key);
    },

    refreshOne(key) {
      const sec = this.sections[key];
      if (!sec) return;
      const txt = sec.render();
      const ok  = !!sec.complete(txt);
      const p   = document.getElementById(`summary-${key}`);
      if (p) p.textContent = txt || "Not provided";
      this.setStatus(key, ok);
    },

    refreshAll() {
      Object.keys(this.sections).forEach(k => this.refreshOne(k));
    }
  };

  // --- CSS (move to your stylesheet later) ---
  const css = `
    .checkout-layout-wrapper{display:flex;gap:2rem;margin-bottom:2rem;flex-wrap:wrap}
    .checkout-summary-panel{flex:1 1 340px;min-width:320px;background:#fdfdfd;border:1px solid #e7e7e7;border-radius:12px;padding:1.25rem 1.25rem .25rem;box-shadow:0 2px 16px rgba(0,0,0,.04)}
    .checkout-summary-panel h2{color:#6b0016;margin:0 0 .75rem;font-size:1.15rem}
    .checkout-summary-section{border-top:1px dashed #e0e0e0;padding:.9rem 0}
    .checkout-summary-section:first-of-type{border-top:0}
    .section-title-row{display:flex;gap:.5rem;align-items:center}
    .section-status{font-weight:700;font-size:.95rem}
    .section-status.ok{color:#148a00}.section-status.bad{color:#c7002a}
    .checkout-summary-section p{margin:.25rem 0 0;font-size:.9rem;color:#444;line-height:1.35;white-space:pre-line}
    .edit-button{margin-top:.5rem;font-size:.85rem;background:#6b0016;color:#fff;border:none;padding:.42rem .8rem;border-radius:6px;cursor:pointer}
    .edit-button:hover{background:#8d8d8d}

    /* Drawer (right) */
    #coDrawerOverlay{display:none}
    #coDrawerOverlay.active{display:block;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9998}
    #coDrawer{display:none}
    #coDrawer.active{display:block;position:fixed;top:64px;right:16px;width:440px;height:calc(100vh - 80px);background:#fff;z-index:9999;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.2);padding:1rem;overflow:auto}
    #coDrawer .modal-header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #eee;padding-bottom:.5rem;margin-bottom:.75rem}
    #coDrawer .modal-header h3{margin:0;color:#6b0016;font-size:1.05rem}
    #coDrawer .modal-actions{display:flex;gap:.5rem;justify-content:flex-end;margin-top:1rem}
    .btn-secondary{background:transparent;color:#6b0016;border:1px solid #6b0016;padding:.4rem .75rem;border-radius:6px;cursor:pointer}
    .btn-secondary:hover{background:#6b0016;color:#fff}
    .form-row{margin-bottom:.75rem}
    .form-row label{display:block;font-size:.85rem;color:#333;margin-bottom:.25rem}
    .form-row input,.form-row textarea,.form-row select{width:100%;padding:.55rem .6rem;border:1px solid #ccc;border-radius:6px;font-size:.92rem}
    .input-grid{display:grid;grid-template-columns:1fr 1fr;gap:.75rem}
    .input-grid .full{grid-column:1 / -1}
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  // --- Summary shell + Drawer DOM ---
  const shell = `
    <div class="checkout-layout-wrapper">
      <div class="checkout-summary-panel" id="checkoutSummaryPanel">
        <h2>Your Order Summary</h2>
        <!-- sections will be appended here -->
      </div>
    </div>
    <div id="coDrawerOverlay"></div>
    <div id="coDrawer">
      <div class="modal-header">
        <h3 id="coDrawerTitle">Edit</h3>
        <button class="btn-secondary" id="coDrawerClose">Close</button>
      </div>
      <div id="coDrawerBody"></div>
      <div class="modal-actions">
        <button class="btn-secondary" id="coDrawerCancel">Cancel</button>
        <button class="edit-button" id="coDrawerSave">Save</button>
      </div>
    </div>
  `;
  // Insert just before the transaction type block if present, else at top of form
  const txnDiv = document.querySelector("#ctl00_PageBody_TransactionTypeDiv");
  if (txnDiv) txnDiv.insertAdjacentHTML("beforebegin", shell);
  else document.body.insertAdjacentHTML("afterbegin", shell);

  // Drawer wiring
  document.getElementById("coDrawerOverlay").addEventListener("click", () => CheckoutUI.closeDrawer(false));
  document.getElementById("coDrawerClose").addEventListener("click", () => CheckoutUI.closeDrawer(false));
  document.getElementById("coDrawerCancel").addEventListener("click", () => CheckoutUI.closeDrawer(false));
  document.getElementById("coDrawerSave").addEventListener("click", () => CheckoutUI.closeDrawer(true));

  // Global edit button handler
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".edit-button[data-edit]");
    if (!btn) return;
    const key = btn.getAttribute("data-edit");
    // Each module's "open editor" will call CheckoutUI.openDrawer(...)
    const evt = new CustomEvent("co:openEditor", { detail: { key } });
    document.dispatchEvent(evt);
  });
})();

