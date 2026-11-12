/* Shared, conservative substitution eligibility. Customer choices affect ranking only. */
(function (root, factory) {
  'use strict';
  var core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  else root.WLSubstitutionRules = core;
})(typeof window === 'object' ? window : null, function () {
  'use strict';
  var VERSION = '20261112-substitutions-2';
  var familyCache = new WeakMap();
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
  function familyErrors(family) {
    var errors = [];
    if (!family || !/^[a-z0-9-]{3,70}$/.test(family.id || '') || !Number.isInteger(family.revision) || family.revision < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(family.reviewedAt || '')) errors.push('Missing family ID, revision or review date.');
    if (!text(family && family.model) || !text(family && family.brand) || !text(family && family.category) || family?.type !== 'color_variant') errors.push('A color family needs an exact model, brand and category.');
    if (!Array.isArray(family && family.members) || family.members.length < 2 || family.members.length > 100) errors.push('A family needs 2–100 reviewed members.');
    var seen = new Set();
    (Array.isArray(family && family.members) ? family.members : []).forEach(function (member) {
      if (!member || !id(member.productId) || seen.has(String(member.productId)) || !text(member.title) || !text(member.variant) || normalized(member.title).replace(/\s*-\s*/g, ' - ') !== (normalized(family.model) + ' - ' + normalized(member.variant)).replace(/\s*-\s*/g, ' - ') || (Object.prototype.hasOwnProperty.call(member, 'allowMissingBrand') && typeof member.allowMissingBrand !== 'boolean')) errors.push('Invalid, duplicate or incomplete family member.');
      seen.add(String(member && member.productId));
    });
    return errors;
  }
  function familyIndex(families) {
    if (!Array.isArray(families)) return new Map();
    if (familyCache.has(families)) return familyCache.get(families);
    var index = new Map(), familyIds = new Set(), duplicateFamilies = new Set();
    families.forEach(function (family) { if (!family) return; if (familyIds.has(family.id)) duplicateFamilies.add(family.id); familyIds.add(family.id); });
    families.forEach(function (family) {
      if (!family || family.enabled !== true || familyErrors(family).length || duplicateFamilies.has(family.id)) return;
      family.members.forEach(function (member) {
        var key = String(member.productId);
        index.set(key, index.has(key) ? null : { family: family, member: member });
      });
    });
    familyCache.set(families, index);
    return index;
  }
  function familyMember(product, entry) {
    if (!entry) return false;
    var brand = normalized(product.brand);
    return normalized(product.title) === normalized(entry.member.title) && normalized(product.category) === normalized(entry.family.category) && (brand === normalized(entry.family.brand) || (entry.member.allowMissingBrand === true && !brand));
  }
  function familyMatch(source, target, families) {
    var index = familyIndex(families), a = index.get(String(source.productId)), b = index.get(String(target.productId));
    if (!a || !b || a.family !== b.family || !familyMember(source, a) || !familyMember(target, b) || normalized(a.member.variant) === normalized(b.member.variant)) return null;
    return { kind: 'reviewed_family', familyId: a.family.id, reason: 'Same listed ' + text(a.family.model) + ' model; different color or finish.', differences: 'Color/finish changes from ' + text(a.member.variant) + ' to ' + text(b.member.variant) + '. Review the product details before choosing.', rule: 'family:' + a.family.id + ':v' + a.family.revision };
  }
  function eligibility(source, target, approved, families) {
    if (!id(source && source.productId) || !id(target && target.productId) || source.productId === target.productId) return null;
    var pair = (approved || []).find(function (row) { return row.enabled === true && String(row.from) === String(source.productId) && String(row.to) === String(target.productId) && text(row.reason) && text(row.differences); });
    if (pair) return { kind: 'approved_pair', reason: text(pair.reason).slice(0, 220), differences: text(pair.differences).slice(0, 300), rule: text(pair.rule || 'approved-pair-v1') };
    var family = familyMatch(source, target, families);
    if (family) return family;
    var a = lumber(source), b = lumber(target);
    if (!a || !b || a.category !== b.category || a.thickness !== b.thickness || a.width !== b.width || a.specification !== b.specification || a.brand !== b.brand || b.length <= a.length) return null;
    return { kind: 'longer_lumber', reason: 'Same listed size, species and grade; longer length.', differences: b.length + ' ft instead of ' + a.length + ' ft (' + (b.length - a.length) + ' ft longer per board). Check that the longer board suits your project and transport.', rule: VERSION, extraLength: b.length - a.length };
  }
  function candidates(products, sourceId, approved, counts, families) {
    var source = products.find(function (p) { return String(p.productId) === String(sourceId); });
    if (!source) return [];
    return products.map(function (product) {
      var match = eligibility(source, product, approved, families);
      if (!match || product.availability !== 'in_stock' || !id(product.productId) || !text(product.title)) return null;
      var accepted = Math.max(0, Number(counts && counts[product.productId]) || 0);
      return { product: product, match: match, accepted: accepted, score: (match.kind === 'approved_pair' ? 100 : match.kind === 'reviewed_family' ? 90 : 50) + Math.min(12, Math.log2(accepted + 1) * 2) - (match.extraLength || 0) };
    }).filter(Boolean).sort(function (a, b) { return b.score - a.score || a.product.title.localeCompare(b.product.title); }).slice(0, 6);
  }
  function quantities(requested, local, scope) {
    if (!Number.isInteger(requested) || requested < 1 || requested > 9999 || !Number.isFinite(local) || local < 0 || !['whole', 'shortage'].includes(scope)) throw Error('Quantity could not be confirmed.');
    var keep = scope === 'shortage' ? Math.min(requested, Math.floor(local)) : 0;
    return { keep: keep, replace: requested - keep };
  }
  return { version: VERSION, text: text, normalized: normalized, id: id, lumber: lumber, familyErrors: familyErrors, familyMember: familyMember, familyIndex: familyIndex, eligibility: eligibility, candidates: candidates, quantities: quantities };
});
