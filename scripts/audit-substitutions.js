'use strict';
// Read-only review report. This never edits the registry, trains eligibility,
// reads customer history, or publishes anything.
const fs = require('node:fs');
const rules = require('../SubstitutionRules');
const families = require('../data/substitution-families.json');
const { parseCsv } = require('../api/product-content')._test;
function product(row) {
  return { productId: String(row.productId || row.id || ''), title: rules.text(row.title), brand: rules.text(row.brand), category: rules.text(row.category || row.product_type) };
}
function readCatalog(value) {
  if (/^\s*[\[{]/.test(value)) {
    const data = JSON.parse(value), rows = Array.isArray(data) ? data : data.products;
    if (!Array.isArray(rows)) throw Error('Catalog JSON needs an array or a products array.');
    return rows.map(product);
  }
  const rows = parseCsv(value), headers = (rows.shift() || []).map(h => h.trim().replace(/^g:/, '').toLowerCase());
  if (!headers.includes('id') || !headers.includes('title') || !headers.includes('brand') || !headers.includes('product_type')) throw Error('Merchant CSV needs id, title, brand and product_type columns.');
  return rows.map(row => product(Object.fromEntries(headers.map((h, i) => [h, row[i]]))));
}
function audit(products, registry = families, now = new Date()) {
  const byId = new Map(), duplicates = new Set(), memberIds = new Set(), familyIds = new Set(), issues = [], result = [];
  for (const p of products) { if (byId.has(p.productId)) duplicates.add(p.productId); byId.set(p.productId, p); }
  const compiled = rules.familyIndex(registry);
  for (const family of registry) {
    const errors = rules.familyErrors(family);
    if (familyIds.has(family?.id)) errors.push('Duplicate family ID.');
    familyIds.add(family?.id);
    if (errors.length) { issues.push({ family: family?.id || 'invalid', type: 'invalid_registry', errors }); continue; }
    const counts = { reviewed: family.members.length, active: 0, missing: 0, changed: 0 }, members = [];
    for (const member of family.members) {
      const pid = String(member.productId), p = byId.get(pid), entry = compiled.get(pid);
      if (memberIds.has(pid)) issues.push({ family: family.id, productId: pid, type: 'duplicate_membership' });
      memberIds.add(pid);
      let state = family.enabled !== true ? 'disabled' : !p ? 'missing' : duplicates.has(pid) || !entry || !rules.familyMember(p, entry) ? 'changed' : 'active';
      if (state !== 'disabled') counts[state]++;
      members.push({ productId: pid, title: member.title, state });
      if (['missing', 'changed'].includes(state)) issues.push({ family: family.id, productId: pid, type: state === 'missing' ? 'missing_from_catalog' : 'catalog_changed_or_ambiguous' });
    }
    const days = Math.floor((now - new Date(family.reviewedAt + 'T00:00:00Z')) / 86400000);
    if (!Number.isFinite(days) || days > 180) issues.push({ family: family.id, type: 'review_due' });
    result.push({ id: family.id, model: family.model, enabled: family.enabled, revision: family.revision, reviewedAt: family.reviewedAt, ...counts, activeDirectedChoices: counts.active * Math.max(0, counts.active - 1), members });
  }
  const reviewCandidates = [];
  for (const family of registry.filter(f => f?.enabled === true && !rules.familyErrors(f).length)) {
    const prefix = rules.normalized(family.model) + ' - ';
    for (const p of products) {
      if (!memberIds.has(p.productId) && rules.normalized(p.brand) === rules.normalized(family.brand) && rules.normalized(p.category) === rules.normalized(family.category) && rules.normalized(p.title).replace(/\s*-\s*/g, ' - ').startsWith(prefix)) reviewCandidates.push({ family: family.id, productId: p.productId, title: p.title, action: 'Review model/generation, size, pack, compatibility and color before adding; never auto-enabled.' });
    }
  }
  // Discovery is an editorial queue only, never a source of runtime matches.
  const reviewIds = new Set(reviewCandidates.map(row => row.productId));
  const potential = new Map(), colors = /^(?:black|white|gray|grey|tan|ivory|red|blue|green|orange|maroon|navy|pink|purple|yellow|brown|silver|stainless|burnt orange|river rock|mossy oak[\w ]*)$/i;
  for (const p of products) {
    const title = p.title.match(/^(.{4,120}?)\s+-\s+(.{2,48})$/);
    if (memberIds.has(p.productId) || reviewIds.has(p.productId) || !p.brand || !p.category || !title || !colors.test(title[2])) continue;
    const key = [rules.normalized(p.brand), rules.normalized(p.category), rules.normalized(title[1])].join('|');
    if (!potential.has(key)) potential.set(key, { model: title[1], brand: p.brand, category: p.category, products: [] });
    potential.get(key).products.push({ productId: p.productId, title: p.title });
  }
  return { generatedAt: now.toISOString(), catalogProducts: products.length, families: result, issues, reviewCandidates, potentialNewFamilies: [...potential.values()].filter(g => g.products.length > 1).sort((a, b) => b.products.length - a.products.length).slice(0, 100), automaticallyEnabled: false };
}
function run(args) {
  const input = args[args.indexOf('--catalog') + 1], output = args[args.indexOf('--output') + 1];
  if (!args.includes('--catalog') || !input) throw Error('Usage: npm run audit:substitutions -- --catalog public-catalog.json-or.csv [--output report.json]');
  const result = audit(readCatalog(fs.readFileSync(input, 'utf8'))), data = JSON.stringify(result, null, 2) + '\n';
  if (args.includes('--output')) { if (!output) throw Error('--output needs a file path.'); fs.writeFileSync(output, data); }
  else process.stdout.write(data);
  if (result.issues.some(row => ['invalid_registry', 'duplicate_membership', 'catalog_changed_or_ambiguous'].includes(row.type))) process.exitCode = 1;
}
if (require.main === module) { try { run(process.argv.slice(2)); } catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 1; } }
module.exports = { readCatalog, audit };
