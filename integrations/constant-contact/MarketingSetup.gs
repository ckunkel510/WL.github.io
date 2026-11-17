/* Webtrack email automation: configuration only. Never sends campaigns. */
const WL_MARKETING_VERSION = '20261117-marketing-1';
const WL_INTERESTS = {
  "trade_news": "Contractor and market news",
  "deals": "Deals and savings",
  "project_tips": "Project tips and how-to",
  "lawn_garden": "Lawn and garden",
  "paint": "Paint and home projects",
  "tools": "Tools and hardware",
  "building": "Lumber and building materials",
  "outdoor": "Outdoor living",
  "seasonal": "Seasonal preparation",
  "hunting": "Hunting and fishing",
  "plumbing": "Plumbing",
  "electrical": "Electrical",
  "roofing": "Roofing",
  "framing": "Framing",
  "trade_plumber": "Plumber",
  "trade_electrician": "Electrician",
  "trade_roofer": "Roofer",
  "trade_framer": "Framer",
  "brand_stihl": "STIHL outdoor power"
};
const WL_STORES = {brenham:'Brenham', bryan:'Bryan', buffalo:'Buffalo', caldwell:'Caldwell', groesbeck:'Groesbeck', lexington:'Lexington', mexia:'Mexia'};

// Run once from the authenticated Apps Script editor, never from a public route.
// Re-running reuses named resources and does not enroll existing customers.
function configureWebtrackMarketing() {
  const lists = getContactLists_().lists || [];
  const fields = ccGet_('/contact_custom_fields?limit=100').custom_fields || [];
  function list(property, name) {
    if (getProp_(property)) return;
    const match = lists.find(function(x) { return x.name === name; });
    const value = match || ccPost_('/contact_lists', {name: name}, 'Create marketing list failed');
    if (!value.list_id) throw new Error('List setup did not return an ID');
    setProp_(property, value.list_id);
    lists.push(value);
  }
  function field(property, label) {
    if (getProp_(property)) return;
    const match = fields.find(function(x) { return x.label === label; });
    if (match && match.type !== 'string') throw new Error('Existing field has incompatible type: ' + label);
    const value = match || ccPost_('/contact_custom_fields', {label: label, type: 'string'}, 'Create preference field failed');
    if (!value.custom_field_id) throw new Error('Field setup did not return an ID');
    setProp_(property, value.custom_field_id);
    fields.push(value);
  }
  list('CC_PREFS_WEBTRACK_LIST_ID', 'Webtrack - Marketing Opt-In');
  list('CC_PREFS_WELCOME_LIST_ID', 'Webtrack - Welcome Queue');
  Object.keys(WL_INTERESTS).forEach(function(key) {
    list('CC_PREFS_INTEREST_' + key.toUpperCase() + '_LIST_ID', 'Webtrack - Interest - ' + WL_INTERESTS[key]);
  });
  Object.keys(WL_STORES).forEach(function(key) {
    list('CC_PREFS_STORE_' + key.toUpperCase() + '_LIST_ID', 'Webtrack - Store - ' + WL_STORES[key]);
  });
  const labels = {
    SOURCE: 'Webtrack Preference Source',
    EMAIL_BILLING: 'Webtrack Email Billing',
    EMAIL_DELIVERY: 'Webtrack Email Delivery',
    SMS_MARKETING: 'Webtrack SMS Marketing',
    INTERESTS: 'Webtrack Declared Interests',
    CONSENT_VERSION: 'Webtrack Consent Version',
    CONSENT_AT: 'Webtrack Consent Updated At',
    STORE: 'Webtrack Preferred Store',
    FULFILLMENT: 'Webtrack Shopping Preference'
  };
  Object.keys(labels).forEach(function(key) { field('CC_PREFS_CUSTOM_FIELD_' + key + '_ID', labels[key]); });
  console.log(JSON.stringify({ok: true, version: WL_MARKETING_VERSION, listsConfigured: 2 + Object.keys(WL_INTERESTS).length + Object.keys(WL_STORES).length, fieldsConfigured: 9, contactsEnrolled: 0, campaignsSent: 0}));
}

function wlSelectedInterests_(submission) {
  const raw = submission && submission.raw;
  if (!raw || !Array.isArray(raw.interests) || !submission.emailMarketing) return [];
  return Object.keys(WL_INTERESTS).filter(function(key) { return raw.interests.indexOf(key) >= 0; });
}

function wlExpectedMarketingLists_(submission) {
  const ids = [requiredProp_('CC_PREFS_EMAIL_LIST_ID')];
  const marketing = getProp_('CC_PREFS_WEBTRACK_LIST_ID');
  if (marketing) ids.push(marketing);
  if (/^UserSignup\.aspx$/i.test(submission.source || '')) {
    const welcome = getProp_('CC_PREFS_WELCOME_LIST_ID');
    if (welcome) ids.push(welcome);
  }
  wlSelectedInterests_(submission).forEach(function(key) {
    ids.push(requiredProp_('CC_PREFS_INTEREST_' + key.toUpperCase() + '_LIST_ID'));
  });
  const store = submission.raw && submission.raw.preferredStore;
  if (Object.prototype.hasOwnProperty.call(WL_STORES, store)) ids.push(requiredProp_('CC_PREFS_STORE_' + store.toUpperCase() + '_LIST_ID'));
  return ids.filter(function(id, i, all) { return all.indexOf(id) === i; });
}

function wlManagedMarketingLists_() {
  return ['CC_PREFS_EMAIL_LIST_ID', 'CC_PREFS_WEBTRACK_LIST_ID', 'CC_PREFS_WELCOME_LIST_ID'].concat(
    Object.keys(WL_INTERESTS).map(function(key) { return 'CC_PREFS_INTEREST_' + key.toUpperCase() + '_LIST_ID'; }),
    Object.keys(WL_STORES).map(function(key) { return 'CC_PREFS_STORE_' + key.toUpperCase() + '_LIST_ID'; })
  ).map(function(key) { return getProp_(key); }).filter(Boolean);
}

function wlVerifyMarketingLists_(email, expected) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const contact = findContactByEmail_(email);
    const memberships = contact && contact.list_memberships || [];
    if (expected.every(function(id) { return memberships.indexOf(id) >= 0; })) return true;
    if (attempt < 2) Utilities.sleep(350);
  }
  throw new Error('Contact saved, but required marketing list membership was not verified. Retry with the same request ID.');
}

function wlAddMarketingFields_(fields, submission) {
  const raw = submission.raw || {};
  const values = {};
  if (submission.emailMarketing && getEmailListIntent_(submission) === 'subscribe') {
    if (Object.prototype.hasOwnProperty.call(WL_STORES, raw.preferredStore)) values.STORE = raw.preferredStore;
    if (['pickup','shipping','either'].indexOf(raw.fulfillmentPreference) >= 0) values.FULFILLMENT = raw.fulfillmentPreference;
  }
  if (submission.emailMarketing && getEmailListIntent_(submission) === 'subscribe' && Array.isArray(raw.interests)) values.INTERESTS = wlSelectedInterests_(submission).join(',') || 'none';
  if (submission.emailMarketing && getEmailListIntent_(submission) === 'subscribe' && raw.consentVersion) values.CONSENT_VERSION = String(raw.consentVersion).slice(0, 60);
  // Server time is authoritative; do not accept a browser timestamp as consent evidence.
  if (getEmailListIntent_(submission) === 'subscribe') values.CONSENT_AT = new Date().toISOString();
  Object.keys(values).forEach(function(key) {
    const id = getProp_('CC_PREFS_CUSTOM_FIELD_' + key + '_ID');
    if (id) upsertCustomFieldValue_(fields, id, values[key]);
  });
}

function wlRequestId_(value) {
  return /^[a-f0-9-]{20,80}$/i.test(String(value || '')) ? String(value) : '';
}

function wlReceipt_(id) {
  id = wlRequestId_(id);
  const cached = id && CacheService.getScriptCache().get('wl-prefs:' + id);
  return cached ? JSON.parse(cached) : {ok: false, pending: true, version: WL_MARKETING_VERSION};
}

function wlClaimRequest_(id) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const cache = CacheService.getScriptCache();
    const previous = wlReceipt_(id);
    if (previous.ok || previous.processing) return false;
    cache.put('wl-prefs:' + id, JSON.stringify({ok: false, pending: true, processing: true, version: WL_MARKETING_VERSION}), 120);
    return true;
  } finally {
    lock.releaseLock();
  }
}

function wlSaveReceipt_(id, result) {
  id = wlRequestId_(id);
  if (!id) return;
  // Capability lookup returns only acknowledgement, never contact data or email.
  CacheService.getScriptCache().put('wl-prefs:' + id, JSON.stringify({
    ok: result.ok === true,
    verified: !!(result.emailResult && result.emailResult.membershipVerified),
    version: WL_MARKETING_VERSION,
    requestId: id
  }), 600);
}
