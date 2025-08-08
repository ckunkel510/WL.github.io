(function() {
  // Only run on signup.aspx
  if (!/signup\.aspx/i.test(window.location.href)) return;

  const phoneInput = document.getElementById("ctl00_PageBody_ContactTelephoneTextBox");
  if (!phoneInput) return;

  // Pre-fill with "1 " if empty
  if (!phoneInput.value.trim()) {
    phoneInput.value = "1 ";
  }

  // Put cursor after the "1 "
  function placeCursor() {
    const pos = phoneInput.value.length;
    phoneInput.setSelectionRange(pos, pos);
  }

  // Format input as "1 (XXX) XXX-XXXX"
  function formatPhone(value) {
    // Remove all non-digits except starting 1
    let digits = value.replace(/\D/g, "");

    // Ensure starts with 1
    if (!digits.startsWith("1")) {
      digits = "1" + digits;
    }

    // Limit to 11 digits total
    digits = digits.substring(0, 11);

    // Apply mask: 1 (XXX) XXX-XXXX
    let out = digits[0] + " ";
    if (digits.length > 1) out += "(" + digits.substring(1, 4);
    if (digits.length >= 4) out += ")";
    if (digits.length > 4) out += " " + digits.substring(4, 7);
    if (digits.length > 7) out += "-" + digits.substring(7, 11);

    return out;
  }

  // Handle typing & pasting
  phoneInput.addEventListener("input", function(e) {
    const formatted = formatPhone(phoneInput.value);
    phoneInput.value = formatted;
    placeCursor();
  });

  // Prevent deleting the "1 "
  phoneInput.addEventListener("keydown", function(e) {
    if (phoneInput.selectionStart <= 2 && (e.key === "Backspace" || e.key === "Delete")) {
      e.preventDefault();
    }
  });

  // Validate before submit
  document.addEventListener("submit", function(e) {
    const raw = phoneInput.value.replace(/\D/g, "");
    if (raw.length !== 11) { // includes the starting "1"
      e.preventDefault();
      alert("Please enter a valid 10-digit phone number.");
      phoneInput.focus();
    }
  }, true);

  // Re-format on page load (handles autofill)
  setTimeout(() => {
    phoneInput.value = formatPhone(phoneInput.value);
  }, 200);

})();









(function () {
  const STATE_INPUT_IDS = [
    "ctl00_PageBody_DeliveryStateCountyTextBox",
    "ctl00_PageBody_InvoiceStateCountyTextBox"
  ];

  // Find any that exist on the page
  const inputs = STATE_INPUT_IDS.map(id => document.getElementById(id)).filter(Boolean);
  if (!inputs.length) return;

  // 50 states
  const STATES = [
    ["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],["CA","California"],
    ["CO","Colorado"],["CT","Connecticut"],["DE","Delaware"],["FL","Florida"],["GA","Georgia"],
    ["HI","Hawaii"],["ID","Idaho"],["IL","Illinois"],["IN","Indiana"],["IA","Iowa"],
    ["KS","Kansas"],["KY","Kentucky"],["LA","Louisiana"],["ME","Maine"],["MD","Maryland"],
    ["MA","Massachusetts"],["MI","Michigan"],["MN","Minnesota"],["MS","Mississippi"],["MO","Missouri"],
    ["MT","Montana"],["NE","Nebraska"],["NV","Nevada"],["NH","New Hampshire"],["NJ","New Jersey"],
    ["NM","New Mexico"],["NY","New York"],["NC","North Carolina"],["ND","North Dakota"],["OH","Ohio"],
    ["OK","Oklahoma"],["OR","Oregon"],["PA","Pennsylvania"],["RI","Rhode Island"],["SC","South Carolina"],
    ["SD","South Dakota"],["TN","Tennessee"],["TX","Texas"],["UT","Utah"],["VT","Vermont"],
    ["VA","Virginia"],["WA","Washington"],["WV","West Virginia"],["WI","Wisconsin"],["WY","Wyoming"]
  ];

  const byName = new Map(STATES.map(([ab, nm]) => [nm.toLowerCase(), {ab, nm}]));
  const byAbbr = new Map(STATES.map(([ab, nm]) => [ab.toLowerCase(), {ab, nm}]));

  function normalize(val) {
    if (!val) return null;
    const v = val.trim().toLowerCase();
    return byAbbr.get(v) || byName.get(v) || null;
  }

  function filterStates(q) {
    const v = (q||"").trim().toLowerCase();
    if (!v) return STATES;
    return STATES.filter(([ab, nm]) => ab.toLowerCase().startsWith(v) || nm.toLowerCase().includes(v));
  }

  // Styles (+ autofill animation hook)
  const style = document.createElement("style");
  style.textContent = `
    /* Autofill detection animation */
    @keyframes stateAutofill { from { } to { } }
    input.state-autofill:-webkit-autofill {
      animation-name: stateAutofill;
      animation-duration: 0.001s;
      animation-iteration-count: 1;
    }

    .statepicker-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:9998;display:none}
    .statepicker-modal{
      position:fixed;z-index:9999;display:none;
      top:50%;left:50%;transform:translate(-50%,-50%);
      width:min(640px,92vw);max-height:70vh;background:#fff;border-radius:16px;
      box-shadow:0 16px 40px rgba(0,0,0,.25)
    }
    .statepicker-head{padding:12px 16px;border-bottom:1px solid #eee;display:flex;gap:8px;align-items:center}
    .statepicker-search{flex:1;border:1px solid #ddd;border-radius:8px;padding:10px 12px;font-size:16px}
    .statepicker-cancel{border:none;background:transparent;font-size:16px}
    .statepicker-list{overflow:auto}
    .statepicker-item{padding:10px 16px;cursor:pointer}
    .statepicker-item:hover,.statepicker-item[aria-selected="true"]{background:#f5f5f5}
    .statepicker-dd{position:absolute;z-index:9999;background:#fff;border:1px solid #ddd;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.12);display:none;max-height:240px;overflow:auto}
    .statepicker-dd .statepicker-item{padding:8px 12px}
  `;
  document.head.appendChild(style);

  // Shared UI elements
  const dd = document.createElement("div");
  dd.className = "statepicker-dd";
  dd.setAttribute("role","listbox");
  document.body.appendChild(dd);

  const backdrop = document.createElement("div"); backdrop.className = "statepicker-backdrop";
  const modal = document.createElement("div"); modal.className = "statepicker-modal";
  const head = document.createElement("div"); head.className = "statepicker-head";
  const search = document.createElement("input"); search.className = "statepicker-search"; search.type="text"; search.placeholder="Search state…";
  const cancel = document.createElement("button"); cancel.className = "statepicker-cancel"; cancel.type="button"; cancel.textContent="Cancel";
  const list = document.createElement("div"); list.className = "statepicker-list";

  head.appendChild(search); head.appendChild(cancel);
  modal.appendChild(head); modal.appendChild(list);
  document.body.appendChild(backdrop); document.body.appendChild(modal);

  // State vars
  let isOpen = false;
  let isModal = false;
  let activeIndex = -1;
  let currentItems = [];
  let activeInput = null;

  function isSmall() { return window.matchMedia("(max-width: 640px)").matches; }

  function renderList(container, items) {
    container.innerHTML = "";
    items.forEach(([ab, nm]) => {
      const div = document.createElement("div");
      div.className = "statepicker-item";
      div.textContent = `${nm} (${ab})`;
      div.addEventListener("mousedown", e => e.preventDefault());
      div.addEventListener("click", () => {
        selectState({ab, nm});
        if (isModal) closePicker(); // ensure modal closes on mobile tap
      });
      container.appendChild(div);
    });
  }

  function setListMaxHeight() {
    const headH = head.offsetHeight || 56;
    const modalStyles = getComputedStyle(modal);
    const maxVh = parseInt((modalStyles.maxHeight || "70vh").replace("vh","")) || 70;
    const pxMaxH = Math.round(window.innerHeight * (maxVh / 100));
    list.style.maxHeight = Math.max(180, pxMaxH - headH - 12) + "px";
  }

  function openPicker(forInput) {
    activeInput = forInput;
    isModal = isSmall();
    currentItems = filterStates(forInput.value);

    if (isModal) {
      renderList(list, currentItems);
      backdrop.style.display = "block";
      modal.style.display = "block";
      setListMaxHeight();
      list.scrollTop = 0;
      search.value = "";
      setTimeout(() => {
        search.focus({ preventScroll: true });
        modal.scrollIntoView({ block: "center", inline: "center" });
      }, 0);
    } else {
      renderList(dd, currentItems);
      positionDropdown(forInput);
      dd.style.display = "block";
    }

    isOpen = true;
    activeIndex = -1;
  }

  function closePicker() {
    if (!isOpen) return;
    dd.style.display = "none";
    backdrop.style.display = "none";
    modal.style.display = "none";
    isOpen = false;
    activeIndex = -1;
    activeInput = null;
  }

  function positionDropdown(el) {
    const r = el.getBoundingClientRect();
    dd.style.minWidth = r.width + "px";
    dd.style.top = (window.scrollY + r.bottom) + "px";
    dd.style.left = (window.scrollX + r.left) + "px";
  }

  function selectState({ab, nm}) {
    if (!activeInput) return;
    activeInput.value = nm;                 // write full name
    activeInput.dataset.stateAbbr = ab;     // keep abbr if needed later
    activeInput.dispatchEvent(new Event("change", {bubbles:true}));
    // closePicker() is also called in the click handler on mobile; desktop is fine too
    activeInput.focus();
  }

  // ---- Autofill normalization helpers ----
  function normalizeField(el) {
    const match = normalize(el.value);
    if (match) {
      // Always store full name in the visible input; keep abbr in data-attr
      if (el.value !== match.nm) {
        el.value = match.nm;
        el.dataset.stateAbbr = match.ab;
        // Fire a synthetic change so any validators react
        el.dispatchEvent(new Event("change", {bubbles:true}));
      } else {
        el.dataset.stateAbbr = match.ab;
      }
    }
  }

  // Sweep briefly after load/focus to catch delayed autofill (Chrome/iOS)
  function scheduleAutofillSweep(el) {
    const end = Date.now() + 3000; // up to ~3s
    const int = setInterval(() => {
      normalizeField(el);
      if (Date.now() > end) clearInterval(int);
    }, 250);
  }

  // Global listener for the WebKit autofill animation hook
  document.addEventListener("animationstart", (e) => {
    if (e.animationName === "stateAutofill" && inputs.includes(e.target)) {
      normalizeField(e.target);
    }
  }, true);

  // Wire up each input
  inputs.forEach(el => {
    el.classList.add("state-autofill");
    el.setAttribute("autocomplete","address-level1");

    el.addEventListener("focus", () => {
      openPicker(el);
      // Start a short sweep when focused (often when autofill applies)
      scheduleAutofillSweep(el);
    });

    el.addEventListener("click", () => { if (!isOpen) openPicker(el); });

    el.addEventListener("input", () => {
      if (!isOpen) openPicker(el);
      currentItems = filterStates(el.value);
      if (isModal) {
        renderList(list, currentItems);
        setListMaxHeight();
        list.scrollTop = 0;
      } else {
        renderList(dd, currentItems);
      }
    });

    // Normalize on change (covers paste + manual + autofill)
    el.addEventListener("change", () => normalizeField(el));

    // Initial delayed normalize to catch page-load autofill
    setTimeout(() => normalizeField(el), 300);
  });

  // Modal actions
  backdrop.addEventListener("click", closePicker);
  cancel.addEventListener("click", closePicker);
  search.addEventListener("input", () => {
    currentItems = filterStates(search.value);
    renderList(list, currentItems);
    setListMaxHeight();
    list.scrollTop = 0;
  });

  // Close dropdown if clicking outside
  document.addEventListener("mousedown", (e) => {
    if (!isOpen || isModal) return;
    if (e.target === activeInput || dd.contains(e.target)) return;
    closePicker();
  });

  // Keep sizes/position correct
  window.addEventListener("resize", () => {
    if (isOpen && isModal) setListMaxHeight();
    if (isOpen && !isModal && activeInput) positionDropdown(activeInput);
  });
  window.addEventListener("scroll", () => {
    if (isOpen && !isModal && activeInput) positionDropdown(activeInput);
  }, true);

})();



