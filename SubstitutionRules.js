/* Shared, conservative substitution eligibility. Customer choices affect ranking only. */
(function (root, factory) {
  'use strict';
  var core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  else root.WLSubstitutionRules = core;
})(typeof window === 'object' ? window : null, function () {
  'use strict';
  var VERSION = '20261112-substitutions-1';
  function text(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
  function normalized(value) { return text(value).toLowerCase().replace(/[\u2010-\u2015]/g, '-').replace(/×/g, 'x'); }
  function id(value) { var valueText = String(value || ''); return /^\d{1,12}$/.test(valueText) ? valueText : ''; }
  function lumber(product) {
    var category = normalized(product && product.category), title = normalized(product && product.title);
    if (!/^lumber\s*>/.test(category) || /treated|engineered|laminated|glulam|lvl|finger.joint|fire.retardant|composite|deck|fenc|plywood|osb|sheath/i.test(category + ' ' + title)) return null;
    var match = title.match(/^(\d{1,2})\s*x\s*(\d{1,2})\s*(?:-\s*|x\s*)(\d{1,2})(?:\s*(?:feet|foot|ft|'))?\s+(.+)$/);
    if (!match || !/\b(?:yellow pine|southern pine|syp|douglas fir|hem.fir|spruce.pine.fir|spf)\b/.test(match[4]) || !/(?:#\s*[123]\b|\bstud\b|\bselect structural\b)/.test(match[4])) return null;
    var width = Number(match[2]), thickness = Number(match[1]), length = Number(match[3]);
    if (thickness < 1 || thickness > 12 || width < 2 || width > 24 || length < 4 || length > 24) return null;
    return { thickness: thickness, width: width, length: length, specification: match[4], category: category, brand: normalized(product.brand) };
  }
  function eligibility(source, target, approved) {
    if (!id(source && source.productId) || !id(target && target.productId) || source.productId === target.productId) return null;
    var pair = (approved || []).find(function (row) { return row.enabled === true && String(row.from) === String(source.productId) && String(row.to) === String(target.productId) && text(row.reason) && text(row.differences); });
    if (pair) return { kind: 'approved_pair', reason: text(pair.reason).slice(0, 220), differences: text(pair.differences).slice(0, 300), rule: text(pair.rule || 'approved-pair-v1') };
    var a = lumber(source), b = lumber(target);
    if (!a || !b || a.category !== b.category || a.thickness !== b.thickness || a.width !== b.width || a.specification !== b.specification || a.brand !== b.brand || b.length <= a.length) return null;
    return { kind: 'longer_lumber', reason: 'Same listed size, species and grade; longer length.', differences: b.length + ' ft instead of ' + a.length + ' ft (' + (b.length - a.length) + ' ft longer per board). Check that the longer board suits your project and transport.', rule: VERSION, extraLength: b.length - a.length };
  }
  function candidates(products, sourceId, approved, counts) {
    var source = products.find(function (p) { return String(p.productId) === String(sourceId); });
    if (!source) return [];
    return products.map(function (product) {
      var match = eligibility(source, product, approved);
      if (!match || product.availability !== 'in_stock' || !id(product.productId) || !text(product.title)) return null;
      var accepted = Math.max(0, Number(counts && counts[product.productId]) || 0);
      return { product: product, match: match, accepted: accepted, score: (match.kind === 'approved_pair' ? 100 : 50) + Math.min(12, Math.log2(accepted + 1) * 2) - (match.extraLength || 0) };
    }).filter(Boolean).sort(function (a, b) { return b.score - a.score || a.product.title.localeCompare(b.product.title); }).slice(0, 6);
  }
  function quantities(requested, local, scope) {
    if (!Number.isInteger(requested) || requested < 1 || requested > 9999 || !Number.isFinite(local) || local < 0 || !['whole', 'shortage'].includes(scope)) throw Error('Quantity could not be confirmed.');
    var keep = scope === 'shortage' ? Math.min(requested, Math.floor(local)) : 0;
    return { keep: keep, replace: requested - keep };
  }
  return { version: VERSION, text: text, normalized: normalized, id: id, lumber: lumber, eligibility: eligibility, candidates: candidates, quantities: quantities };
});
