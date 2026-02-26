
/**
 * Woodson / WebTrack - Strong URL & Link Sanitizer
 * ------------------------------------------------
 * Goals:
 * 1) Stop "ever-growing" links by stripping recursive redirect/return parameters on click.
 * 2) Clean the address bar on page-load (replaceState) so copied URLs stay clean.
 * 3) Guard against client-side code that injects/rewrites anchors after load (MutationObserver).
 *
 * Important:
 * - This cannot prevent SERVER-SIDE redirects from appending parameters.
 * - It DOES prevent client-side navigation from carrying/stacking ReturnUrl-style params.
 */
(function WLCleanLinksStrong() {
  // =========================
  // CONFIG
  // =========================

  // Exact parameter names to remove (case-sensitive variants included)
  const STRIP_EXACT = new Set([
    "ReturnUrl", "returnUrl", "returnurl", "RETURNURL",
    "return", "RETURN",
    "redirect", "Redirect", "REDIRECT",
    "redirectUrl", "redirectURL", "RedirectUrl", "REDIRECTURL",
    "back", "Back", "BACK",
    "next", "Next", "NEXT",
    "ref", "Ref", "REF",
    "r", "R"
  ]);

  // More aggressive: strip any parameter whose NAME contains these substrings
  // Example: ReturnUrl1, returnUrlEncoded, redirect_uri, etc.
  const STRIP_NAME_CONTAINS = [
    "return",    // catches returnUrl*, return_url, etc.
    "redirect",  // catches redirect_uri, redirectUrl*, etc.
    "callback",  // common in auth flows
    "continue"   // common in auth flows
  ];

  // Strip UTM params? (ONLY enable if you do NOT care about marketing attribution)
  const STRIP_UTM = false;
  const UTM_PARAMS = new Set([
    "utm_source","utm_medium","utm_campaign","utm_term","utm_content",
    "gclid","gbraid","wbraid","msclkid"
  ]);

  // If true, strip suspiciously huge parameter VALUES even if name doesn't match.
  // This is a "safety valve" for garbage tokens.
  const STRIP_HUGE_VALUES = true;
  const HUGE_VALUE_THRESHOLD = 300; // characters

  // If true, strip nested return/redirect parameters INSIDE the value of a return parameter.
  // This helps reduce recursion when ReturnUrl contains ReturnUrl.
  const DE_NEST_RETURN_PARAMS = true;

  // If you want to only apply on certain pages, add regexes here:
  // const ONLY_PATHS = [/\/Products\.aspx$/i, /\/ProductDetail\.aspx$/i, /\/ShoppingCart\.aspx$/i];
  const ONLY_PATHS = null;

  // Skip sanitizing external links (recommended)
  const SKIP_EXTERNAL = true;

  // MutationObserver: rewrite anchors in DOM as they appear
  const OBSERVE_DOM_CHANGES = true;

  // =========================
  // HELPERS
  // =========================

  function shouldRunOnThisPage() {
    if (!ONLY_PATHS || !ONLY_PATHS.length) return true;
    const path = window.location.pathname;
    return ONLY_PATHS.some(rx => rx.test(path));
  }

  function isExternal(urlObj) {
    return urlObj.origin !== window.location.origin;
  }

  function isModifiedClick(e) {
    // not a normal left click
    return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
  }

  function safeURL(href, base) {
    try { return new URL(href, base); } catch { return null; }
  }

  function lower(s) {
    return String(s || "").toLowerCase();
  }

  function hasAnyContainedParamName(nameLower) {
    return STRIP_NAME_CONTAINS.some(sub => nameLower.includes(sub));
  }

  function isBadParamName(key) {
    if (STRIP_EXACT.has(key)) return true;
    const k = lower(key);
    if (hasAnyContainedParamName(k)) return true;
    if (STRIP_UTM && UTM_PARAMS.has(k)) return true;
    return false;
  }

  function tryDecodeOnce(val) {
    // Some apps double-encode; we only decode once to avoid changing semantics too much.
    try { return decodeURIComponent(val); } catch { return val; }
  }

  function stripBadParamsFromQueryString(qs) {
    // qs may be "a=1&ReturnUrl=..." (no leading '?')
    try {
      const u = new URL("https://example.invalid/?" + (qs || ""));
      cleanUrlObject(u);
      return u.searchParams.toString(); // no leading '?'
    } catch {
      return qs;
    }
  }

  function maybeDeNestValue(value) {
    if (!DE_NEST_RETURN_PARAMS || !value) return value;

    // If the value looks like a URL or querystring containing ReturnUrl/redirect,
    // remove those nested params inside it.
    const decoded = tryDecodeOnce(value);

    // Case 1: Full URL inside
    const asUrl = safeURL(decoded, window.location.origin);
    if (asUrl) {
      const before = asUrl.toString();
      cleanUrlObject(asUrl);
      const after = asUrl.toString();
      // Re-encode to keep it safe as a parameter value
      if (after !== before) return encodeURIComponent(after);
      return value;
    }

    // Case 2: Just a query string-ish blob
    if (decoded.includes("=") && (decoded.includes("&") || decoded.includes("?"))) {
      const parts = decoded.split("?");
      if (parts.length >= 2) {
        const basePart = parts[0];
        const qsPart = parts.slice(1).join("?");
        const cleanedQs = stripBadParamsFromQueryString(qsPart);
        const rebuilt = basePart + "?" + cleanedQs;
        return encodeURIComponent(rebuilt);
      } else {
        const cleanedQs = stripBadParamsFromQueryString(decoded);
        return encodeURIComponent(cleanedQs);
      }
    }

    return value;
  }

  function cleanUrlObject(urlObj) {
    // Removes bad params, empty params, and optionally huge values
    const keys = Array.from(urlObj.searchParams.keys());

    for (const key of keys) {
      const val = urlObj.searchParams.get(key) || "";

      // Strip by name rules
      if (isBadParamName(key)) {
        urlObj.searchParams.delete(key);
        continue;
      }

      // Strip huge suspicious values (safety valve)
      if (STRIP_HUGE_VALUES && val.length >= HUGE_VALUE_THRESHOLD) {
        urlObj.searchParams.delete(key);
        continue;
      }

      // De-nest if the value itself contains return/redirect params
      // (only if it looks like it might be a URL/query)
      const valLower = lower(val);
      if (DE_NEST_RETURN_PARAMS && (valLower.includes("returnurl") || valLower.includes("redirect"))) {
        const newVal = maybeDeNestValue(val);
        if (newVal !== val) urlObj.searchParams.set(key, newVal);
      }

      // Remove empty params like foo=
      if (urlObj.searchParams.get(key) === "") {
        urlObj.searchParams.delete(key);
      }
    }

    return urlObj;
  }

  function normalizeAnchorHref(a) {
    if (!a || !a.getAttribute) return false;

    const href = a.getAttribute("href");
    if (!href) return false;

    // Ignore hash-only, javascript, mailto, tel
    if (href.startsWith("#")) return false;
    if (/^\s*javascript:/i.test(href)) return false;
    if (/^\s*mailto:/i.test(href)) return false;
    if (/^\s*tel:/i.test(href)) return false;

    // Ignore downloads
    if (a.hasAttribute("download")) return false;

    // Only sanitize target=_self or empty target
    const target = (a.getAttribute("target") || "").toLowerCase();
    if (target && target !== "_self") return false;

    const url = safeURL(href, window.location.href);
    if (!url) return false;

    if (SKIP_EXTERNAL && isExternal(url)) return false;

    const before = url.toString();
    cleanUrlObject(url);
    const after = url.toString();

    if (after !== before) {
      // Use absolute URL to avoid relative weirdness when base paths change
      a.setAttribute("href", after);
      return true;
    }

    return false;
  }

  function sanitizeAddressBar() {
    try {
      const url = new URL(window.location.href);
      const before = url.toString();
      cleanUrlObject(url);
      const after = url.toString();

      if (after !== before) {
        window.history.replaceState({}, document.title, after);
      }
    } catch {}
  }

  // =========================
  // MAIN
  // =========================

  if (!shouldRunOnThisPage()) return;

  // 1) Clean the address bar immediately (helps stop copy/paste propagation)
  sanitizeAddressBar();

  // 2) Sanitize existing anchors once on load
  try {
    document.querySelectorAll("a[href]").forEach(normalizeAnchorHref);
  } catch {}

  // 3) Intercept clicks in capture phase (prevents other handlers from using the bloated href)
  document.addEventListener(
    "click",
    function (e) {
      try {
        if (isModifiedClick(e)) return;

        const a = e.target && e.target.closest ? e.target.closest("a") : null;
        if (!a) return;

        // If href is missing or non-standard, ignore
        const href = a.getAttribute("href");
        if (!href) return;

        // If target not _self, ignore
        const target = (a.getAttribute("target") || "").toLowerCase();
        if (target && target !== "_self") return;

        // Ignore hash-only / javascript / mailto / tel / download
        if (href.startsWith("#")) return;
        if (/^\s*javascript:/i.test(href)) return;
        if (/^\s*mailto:/i.test(href)) return;
        if (/^\s*tel:/i.test(href)) return;
        if (a.hasAttribute("download")) return;

        const url = safeURL(href, window.location.href);
        if (!url) return;

        if (SKIP_EXTERNAL && isExternal(url)) return;

        const before = url.toString();
        cleanUrlObject(url);
        const after = url.toString();

        if (after === before) return;

        e.preventDefault();
        window.location.assign(after);
      } catch {
        // fail open
      }
    },
    true
  );

  // 4) Observe DOM changes so newly injected links also get cleaned
  if (OBSERVE_DOM_CHANGES && window.MutationObserver) {
    try {
      const obs = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (!m.addedNodes || !m.addedNodes.length) continue;

          m.addedNodes.forEach((node) => {
            if (!node || node.nodeType !== 1) return;

            // Node itself might be an anchor
            if (node.matches && node.matches("a[href]")) {
              normalizeAnchorHref(node);
            }

            // Or it may contain anchors
            if (node.querySelectorAll) {
              node.querySelectorAll("a[href]").forEach(normalizeAnchorHref);
            }
          });
        }
      });

      obs.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true
      });
    } catch {}
  }
})();
