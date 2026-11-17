/* ==========================================================
   Woodson Constant Contact Preferences Bridge
   Google Apps Script Web App — v4.6 / 20261117-marketing-1

   Routes:
   - GET  ?action=connect
   - GET  ?action=status
   - GET  ?action=lists
   - GET  ?action=debugContact&email=name@example.com
   - GET  ?action=listMembers&listId=optional_list_id
   - GET  ?action=getPreferences&accountKey=...&email=...
   - GET  ?action=getAccountEmails&accountKey=...&email=...
   - GET  ?action=testSync&email=name@example.com
   - POST ?action=savePreferences
   - POST ?action=linkEmail

   Optional custom field Script Properties:
   CC_PREFS_CUSTOM_FIELD_ACCOUNT_KEY_ID
   CC_PREFS_CUSTOM_FIELD_SOURCE_ID
   CC_PREFS_CUSTOM_FIELD_EMAIL_BILLING_ID
   CC_PREFS_CUSTOM_FIELD_EMAIL_DELIVERY_ID
   CC_PREFS_CUSTOM_FIELD_SMS_MARKETING_ID

   Required Script Properties:
   CC_PREFS_CLIENT_ID
   CC_PREFS_CLIENT_SECRET
   CC_PREFS_REDIRECT_URI
   CC_PREFS_EMAIL_LIST_ID

   Optional Script Properties:
   CC_PREFS_SMS_LIST_ID
   CC_PREFS_LOG_SHEET_ID
   CC_PREFS_LOG_SHEET_NAME
   CC_PREFS_LINK_SHEET_NAME
   ========================================================== */

const CC_AUTH_URL = 'https://authz.constantcontact.com/oauth2/default/v1/authorize';
const CC_TOKEN_URL = 'https://authz.constantcontact.com/oauth2/default/v1/token';
const CC_API_BASE = 'https://api.cc.email/v3';

const TOKEN_ACCESS_KEY = 'CC_PREFS_ACCESS_TOKEN';
const TOKEN_REFRESH_KEY = 'CC_PREFS_REFRESH_TOKEN';
const TOKEN_EXPIRES_AT_KEY = 'CC_PREFS_TOKEN_EXPIRES_AT';

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const action = String(params.action || '').toLowerCase();

    if (params.error) {
      return html_(
        '<h2>Constant Contact authorization failed</h2>' +
        '<p><strong>Error:</strong> ' + escapeHtml_(params.error) + '</p>' +
        '<p>' + escapeHtml_(params.error_description || '') + '</p>'
      );
    }

    if (params.code) {
      return handleOAuthCallback_(params);
    }

    if (action === 'connect') {
      return redirect_(buildAuthorizeUrl_());
    }

    if (action === 'receipt') return jsonOrJsonp_(wlReceipt_(params.requestId), params);

    if (action === 'status') {
      return jsonOrJsonp_({
        ok: true,
        version: WL_MARKETING_VERSION,
        webtrackListId: getProp_('CC_PREFS_WEBTRACK_LIST_ID') || null,
        welcomeListId: getProp_('CC_PREFS_WELCOME_LIST_ID') || null,
        connected: Boolean(getProp_(TOKEN_REFRESH_KEY)),
        hasAccessToken: Boolean(getProp_(TOKEN_ACCESS_KEY)),
        expiresAt: getProp_(TOKEN_EXPIRES_AT_KEY) || null,
        emailListId: getProp_('CC_PREFS_EMAIL_LIST_ID') || null,
        smsListId: getProp_('CC_PREFS_SMS_LIST_ID') || null,
        logSheetId: getProp_('CC_PREFS_LOG_SHEET_ID') || null,
        logSheetName: getProp_('CC_PREFS_LOG_SHEET_NAME') || 'PreferenceLog',
        customFields: {
          accountKey: getProp_('CC_PREFS_CUSTOM_FIELD_ACCOUNT_KEY_ID') || null,
          source: getProp_('CC_PREFS_CUSTOM_FIELD_SOURCE_ID') || null,
          emailBilling: getProp_('CC_PREFS_CUSTOM_FIELD_EMAIL_BILLING_ID') || null,
          emailDelivery: getProp_('CC_PREFS_CUSTOM_FIELD_EMAIL_DELIVERY_ID') || null,
          smsMarketing: getProp_('CC_PREFS_CUSTOM_FIELD_SMS_MARKETING_ID') || null
        }
      }, params);
    }

    if (action === 'lists') {
      return jsonOrJsonp_(getContactLists_(), params);
    }

    if (action === 'debugcontact') {
      return jsonOrJsonp_(debugContact_(params.email), params);
    }

    if (action === 'listmembers') {
      return jsonOrJsonp_(listMembers_(params.listId || getProp_('CC_PREFS_EMAIL_LIST_ID')), params);
    }

    if (action === 'getpreferences') {
      return jsonOrJsonp_(getPreferenceStatus_(params), params);
    }

    if (action === 'getaccountemails') {
      return jsonOrJsonp_(getAccountEmails_(params), params);
    }

    if (action === 'testsync') return jsonOrJsonp_({ok: false, error: 'Public GET writes disabled. Use an explicit POST preference submission.'}, params);

    return html_(
      '<h2>Woodson Constant Contact Preferences Bridge</h2>' +
      '<p>Status: running.</p>' +
      '<p><a href="?action=connect">Connect Constant Contact</a></p>' +
      '<p><a href="?action=status">Check status</a></p>' +
      '<p><a href="?action=lists">View Constant Contact lists</a></p>' +
      '<p>Debug: ?action=debugContact&amp;email=name@example.com</p>' +
      '<p>Preferences: ?action=getPreferences&amp;accountKey=ACCOUNT&amp;email=name@example.com</p>' +
      '<p>Linked emails: ?action=getAccountEmails&amp;accountKey=ACCOUNT</p>'
    );
  } catch (err) {
    console.error(err);
    return jsonOrJsonp_({
      ok: false,
      error: String(err && err.message ? err.message : err)
    }, (e && e.parameter) || {});
  }
}

function doPost(e) {
  let submission = null;
  let requestId = '';

  try {
    const params = (e && e.parameter) || {};
    const action = String(params.action || 'savePreferences').toLowerCase();

    if (action !== 'savepreferences' && action !== 'linkemail') {
      return json_({ ok: false, error: 'Unknown action.' });
    }

    const raw = getPostJson_(e);
    requestId = wlRequestId_(raw.requestId);
    if (requestId && action === 'savepreferences' && !wlClaimRequest_(requestId)) return json_(wlReceipt_(requestId));

    if (action === 'linkemail') {
      submission = normalizeSubmission_(raw);
      const linkResult = linkEmailToAccount_(submission);
      return json_(linkResult);
    }

    submission = normalizeSubmission_(raw);

    const result = {
      ok: true,
      receivedAt: new Date().toISOString(),
      accountKey: submission.accountKey,
      email: submission.email,
      emailSynced: false,
      smsSynced: false,
      emailResult: null,
      smsResult: null,
      notes: []
    };

    const emailIntent = getEmailListIntent_(submission);

    if (!submission.email) {
      result.notes.push('No valid email was supplied, so Constant Contact email sync was skipped.');
    } else if (emailIntent === 'subscribe') {
      // Customer explicitly selected email marketing. Add/update the contact and add the configured marketing list.
      result.emailResult = syncEmailContact_(submission);
      result.emailSynced = true;
    } else if (emailIntent === 'unsubscribe' || emailIntent === 'remove_from_marketing_list') {
      // Customer explicitly turned email marketing off from the AccountInfo preference screen.
      // Stamp details/custom fields, remove the marketing-list membership, and mark the
      // email permission as unsubscribed when configured. This is what makes the change
      // visible in Constant Contact as an actual opt-out instead of just a local preference.
      result.emailResult = setEmailMarketingOff_(submission, emailIntent);
      result.emailSynced = true;
      result.notes.push('Email marketing was turned off for the selected email.');
    } else {
      // Used by signup when the customer did not opt into marketing. We still capture
      // operational preferences/custom fields, but do not subscribe or unsubscribe them.
      result.emailResult = upsertLinkedContactDetailsInConstantContact_(submission);
      result.emailSynced = true;
      result.notes.push('Email marketing was not selected; contact details/preferences were saved without changing marketing permission.');
    }

    if (submission.smsMarketing) {
      if (!submission.smsPhone) {
        result.notes.push('SMS marketing was selected, but no SMS phone was supplied.');
      } else if (!getProp_('CC_PREFS_SMS_LIST_ID')) {
        result.notes.push('SMS marketing selected and logged, but CC_PREFS_SMS_LIST_ID is blank; SMS Constant Contact sync skipped.');
      } else {
        result.smsResult = syncSmsContact_(submission);
        result.smsSynced = true;
      }
    }

    registerLinkedEmail_(submission, { source: 'savePreferences', resultOk: true });
    logSubmission_(submission, result);

    wlSaveReceipt_(requestId, result);
    return json_(result);
  } catch (err) {
    console.error(err);
    const fail = {
      ok: false,
      error: String(err && err.message ? err.message : err),
      receivedAt: new Date().toISOString(),
      accountKey: submission ? submission.accountKey : '',
      email: submission ? submission.email : '',
      emailSynced: false,
      smsSynced: false,
      emailResult: null,
      smsResult: null,
      notes: ['The Apps Script request reached the backend, but the Constant Contact/API step failed.']
    };

    try {
      logSubmission_(submission || {}, fail);
    } catch (logErr) {
      console.error(logErr);
    }

    wlSaveReceipt_(requestId, fail);
    return json_(fail);
  }
}

/* =============================
   OAuth
   ============================= */

function buildAuthorizeUrl_() {
  const state = Utilities.getUuid();
  setProp_('CC_PREFS_OAUTH_STATE', state);

  const query = toQueryString_({
    client_id: requiredProp_('CC_PREFS_CLIENT_ID'),
    redirect_uri: requiredProp_('CC_PREFS_REDIRECT_URI'),
    response_type: 'code',
    scope: 'contact_data offline_access',
    state: state
  });

  return CC_AUTH_URL + '?' + query;
}

function handleOAuthCallback_(params) {
  const expectedState = getProp_('CC_PREFS_OAUTH_STATE');
  if (expectedState && params.state && params.state !== expectedState) {
    throw new Error('OAuth state mismatch. Try connecting again.');
  }

  const tokenResponse = exchangeAuthorizationCode_(params.code);
  storeTokenResponse_(tokenResponse);

  return html_(
    '<h2>Constant Contact connected</h2>' +
    '<p>The preference bridge is authorized and ready.</p>' +
    '<p>You can close this tab.</p>' +
    '<p><a href="?action=status">Check status</a></p>' +
    '<p><a href="?action=lists">View lists</a></p>'
  );
}

function exchangeAuthorizationCode_(code) {
  const payload = toQueryString_({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: requiredProp_('CC_PREFS_REDIRECT_URI')
  });

  const response = UrlFetchApp.fetch(CC_TOKEN_URL, {
    method: 'post',
    muteHttpExceptions: true,
    contentType: 'application/x-www-form-urlencoded',
    headers: {
      Authorization: basicAuthHeader_(),
      Accept: 'application/json'
    },
    payload: payload
  });

  return parseCcResponse_(response, 'OAuth code exchange failed');
}

function getAccessToken_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const accessToken = getProp_(TOKEN_ACCESS_KEY);
    const expiresAt = Number(getProp_(TOKEN_EXPIRES_AT_KEY) || 0);

    if (accessToken && expiresAt && Date.now() < expiresAt) {
      return accessToken;
    }

    return refreshAccessToken_();
  } finally {
    lock.releaseLock();
  }
}

function refreshAccessToken_() {
  const refreshToken = requiredProp_(TOKEN_REFRESH_KEY);

  const payload = toQueryString_({
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  });

  const response = UrlFetchApp.fetch(CC_TOKEN_URL, {
    method: 'post',
    muteHttpExceptions: true,
    contentType: 'application/x-www-form-urlencoded',
    headers: {
      Authorization: basicAuthHeader_(),
      Accept: 'application/json'
    },
    payload: payload
  });

  const tokenResponse = parseCcResponse_(response, 'Token refresh failed');
  storeTokenResponse_(tokenResponse);
  return tokenResponse.access_token;
}

function storeTokenResponse_(tokenResponse) {
  if (!tokenResponse || !tokenResponse.access_token) {
    throw new Error('Constant Contact token response did not include an access token.');
  }

  setProp_(TOKEN_ACCESS_KEY, tokenResponse.access_token);

  if (tokenResponse.refresh_token) {
    setProp_(TOKEN_REFRESH_KEY, tokenResponse.refresh_token);
  }

  const expiresInSeconds = Number(tokenResponse.expires_in || 86400);
  const bufferSeconds = 300;
  const expiresAt = Date.now() + Math.max(60, expiresInSeconds - bufferSeconds) * 1000;

  setProp_(TOKEN_EXPIRES_AT_KEY, String(expiresAt));
}

/* =============================
   Constant Contact contact sync and lookup
   ============================= */

function syncEmailContact_(submission) {
  if (!submission.emailMarketing || getEmailListIntent_(submission) !== 'subscribe') throw new Error('Explicit email opt-in required.');
  const expectedLists = wlExpectedMarketingLists_(submission);
  const existing = findContactByEmail_(submission.email);
  const lists = Array.from(new Set((existing && existing.list_memberships || []).concat(expectedLists)));
  if (lists.length > 50) throw new Error('Contact exceeds the supported list count; manual review required.');

  const body = {
    email_address: submission.email,
    list_memberships: lists,
    create_source: 'Account'
  };

  if (submission.firstName) body.first_name = trimMax_(submission.firstName, 50);
  if (submission.lastName) body.last_name = trimMax_(submission.lastName, 50);
  if (submission.jobTitle) body.job_title = trimMax_(submission.jobTitle, 50);
  if (submission.companyName || submission.accountKey) body.company_name = trimMax_(submission.companyName || submission.accountKey, 50);

  const phone = normalizePhone_(submission.phone || submission.smsPhone || '');
  if (phone) body.phone_number = phone;

  const customFields = (existing && existing.custom_fields || []).map(function(field) { return Object.assign({}, field); });
  const accountKeyFieldId = getProp_('CC_PREFS_CUSTOM_FIELD_ACCOUNT_KEY_ID');
  if (accountKeyFieldId && submission.accountKey) {
    upsertCustomFieldValue_(customFields, accountKeyFieldId, trimMax_(submission.accountKey, 255));
  }
  const sourceFieldId = getProp_('CC_PREFS_CUSTOM_FIELD_SOURCE_ID');
  if (sourceFieldId && submission.source) {
    upsertCustomFieldValue_(customFields, sourceFieldId, trimMax_(submission.source, 255));
  }
  addPreferenceCustomFields_(customFields, submission);
  if (customFields.length) body.custom_fields = customFields;

  const response = UrlFetchApp.fetch(CC_API_BASE + '/contacts/sign_up_form', {
    method: 'post',
    muteHttpExceptions: true,
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + getAccessToken_(),
      Accept: 'application/json'
    },
    payload: JSON.stringify(body)
  });

  const result = parseCcResponse_(response, 'Email contact sync failed');
  wlVerifyMarketingLists_(submission.email, expectedLists);
  return Object.assign({}, result, {membershipVerified: true, listsVerified: expectedLists.length});
}

function removeEmailMarketingMembership_(email) {
  const listId = getProp_('CC_PREFS_EMAIL_LIST_ID') || '';
  if (!listId) return { ok: true, skipped: true, reason: 'CC_PREFS_EMAIL_LIST_ID is blank.' };

  const contact = findContactByEmail_(email);
  if (!contact || !contact.contact_id) {
    return { ok: true, skipped: true, reason: 'Contact was not found in Constant Contact.' };
  }

  const memberships = Array.isArray(contact.list_memberships) ? contact.list_memberships : [];
  const managedLists = wlManagedMarketingLists_().filter(function(id) { return memberships.indexOf(id) >= 0; });
  if (!managedLists.length) {
    return { ok: true, skipped: true, reason: 'Contact was not a member of the configured marketing list.', contact_id: contact.contact_id };
  }

  const activity = ccPost_('/activities/remove_list_memberships', {
    source: {
      contact_ids: [contact.contact_id]
    },
    list_ids: managedLists
  }, 'Remove email marketing list membership failed');

  const finalActivity = waitForActivity_(activity, 'remove_list_memberships');
  const after = debugContact_(email);

  return {
    ok: true,
    contact_id: contact.contact_id,
    listId: listId,
    activity: finalActivity,
    after: {
      isEmailListMember: after.isEmailListMember,
      permissionToSend: after.permissionToSend,
      contactStatus: after.contactStatus
    }
  };
}

function setEmailMarketingOff_(submission, emailIntent) {
  const details = upsertLinkedContactDetailsInConstantContact_(submission);
  const marketingListRemoval = removeEmailMarketingMembership_(submission.email);

  const shouldUnsubscribe = shouldGloballyUnsubscribeMarketingOff_() || emailIntent === 'unsubscribe';
  const unsubscribe = shouldUnsubscribe
    ? unsubscribeEmailContact_(submission)
    : { ok: true, skipped: true, reason: 'Configured to remove marketing list membership only.' };

  return {
    ok: true,
    details: details,
    marketingList: marketingListRemoval,
    unsubscribe: unsubscribe
  };
}

function shouldGloballyUnsubscribeMarketingOff_() {
  const raw = getProp_('CC_PREFS_MARKETING_OFF_ACTION') || getProp_('CC_PREFS_MARKETING_OFF_UNSUBSCRIBE') || 'unsubscribe';
  const v = String(raw || '').trim().toLowerCase();
  if (v === 'remove_list_only' || v === 'list_only' || v === 'false' || v === '0' || v === 'no') return false;
  return true;
}

function unsubscribeEmailContact_(submission) {
  const contact = findContactByEmail_(submission.email);
  if (!contact || !contact.contact_id) {
    return { ok: true, skipped: true, reason: 'Contact was not found in Constant Contact.' };
  }

  const emailAddress = normalizeEmailAddressResource_(contact.email_address, submission.email);
  emailAddress.permission_to_send = 'unsubscribed';
  emailAddress.opt_out_reason = 'Customer turned off email marketing in WebTrack communication preferences.';

  const listId = getProp_('CC_PREFS_EMAIL_LIST_ID') || '';
  const body = {
    update_source: 'Contact',
    email_address: emailAddress,
    first_name: contact.first_name || '',
    last_name: contact.last_name || '',
    company_name: contact.company_name || '',
    job_title: contact.job_title || '',
    list_memberships: Array.isArray(contact.list_memberships) ? contact.list_memberships.filter(function(id){ return wlManagedMarketingLists_().indexOf(id) < 0; }) : [],
    phone_numbers: Array.isArray(contact.phone_numbers) ? contact.phone_numbers : [],
    street_addresses: Array.isArray(contact.street_addresses) ? contact.street_addresses : [],
    custom_fields: Array.isArray(contact.custom_fields) ? contact.custom_fields : []
  };

  if (contact.birthday_month) body.birthday_month = contact.birthday_month;
  if (contact.birthday_day) body.birthday_day = contact.birthday_day;
  if (contact.anniversary) body.anniversary = contact.anniversary;
  if (Array.isArray(contact.taggings)) body.taggings = contact.taggings;

  applyAccountDetailFieldsToContactBody_(body, submission, contact);
  cleanContactUpdateBody_(body);

  return ccPut_('/contacts/' + encodeURIComponent(contact.contact_id), body, 'Unsubscribe email contact failed');
}

function waitForActivity_(activity, label) {
  const activityId = activity && (activity.activity_id || (activity._links && activity._links.self && String(activity._links.self.href || '').split('/').pop()));
  if (!activityId) return { ok: true, skipped: true, reason: 'No activity_id returned.', initial: activity };

  let last = activity;
  for (let i = 0; i < 8; i++) {
    Utilities.sleep(750);
    last = ccGet_('/activities/' + encodeURIComponent(activityId));
    const state = String(last.state || '').toLowerCase();
    if (state === 'completed' || state === 'failed' || state === 'cancelled' || state === 'canceled') break;
  }

  return {
    ok: String(last.state || '').toLowerCase() === 'completed',
    label: label || 'activity',
    activityId: activityId,
    finalState: last.state || '',
    percentDone: last.percent_done,
    activityErrors: last.activity_errors || [],
    activity: last
  };
}

function syncSmsContact_(submission) {
  const listId = requiredProp_('CC_PREFS_SMS_LIST_ID');
  const consentDate = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

  const importContact = {
    sms_number: submission.smsPhone,
    sms_consent_date: consentDate
  };

  if (submission.email) importContact.email_address = submission.email;
  if (submission.accountKey) importContact.company_name = trimMax_(submission.accountKey, 50);

  const body = {
    import_data: [importContact],
    list_ids: [listId],
    sms_permission_to_send: 'explicit'
  };

  const response = UrlFetchApp.fetch(CC_API_BASE + '/activities/contacts_json_import', {
    method: 'post',
    muteHttpExceptions: true,
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + getAccessToken_(),
      Accept: 'application/json'
    },
    payload: JSON.stringify(body)
  });

  return parseCcResponse_(response, 'SMS contact import failed');
}

function getContactLists_() {
  return ccGet_('/contact_lists?limit=500');
}

function debugContact_(email) {
  email = String(email || '').trim().toLowerCase();
  if (!isValidEmail_(email)) {
    return {
      ok: false,
      found: false,
      error: 'A valid email query parameter is required.'
    };
  }

  const contact = findContactByEmail_(email);
  const emailListId = getProp_('CC_PREFS_EMAIL_LIST_ID') || '';
  const smsListId = getProp_('CC_PREFS_SMS_LIST_ID') || '';
  const memberships = contact && Array.isArray(contact.list_memberships) ? contact.list_memberships : [];
  const emailAddress = contact && contact.email_address ? contact.email_address : {};
  const smsChannel = contact && contact.sms_channel ? contact.sms_channel : null;

  return {
    ok: true,
    searchedEmail: email,
    found: Boolean(contact),
    contactId: contact ? contact.contact_id : null,
    contactStatus: contact ? contact.status || null : null,
    permissionToSend: emailAddress.permission_to_send || null,
    confirmStatus: emailAddress.confirm_status || null,
    emailListId: emailListId || null,
    smsListId: smsListId || null,
    listMemberships: memberships,
    isEmailListMember: emailListId ? memberships.indexOf(emailListId) >= 0 : false,
    isSmsListMember: smsListId ? memberships.indexOf(smsListId) >= 0 : false,
    preferenceCustomFields: contact ? {
      emailBilling: getContactCustomFieldValue_(contact, getProp_('CC_PREFS_CUSTOM_FIELD_EMAIL_BILLING_ID')),
      emailDelivery: getContactCustomFieldValue_(contact, getProp_('CC_PREFS_CUSTOM_FIELD_EMAIL_DELIVERY_ID')),
      smsMarketing: getContactCustomFieldValue_(contact, getProp_('CC_PREFS_CUSTOM_FIELD_SMS_MARKETING_ID'))
    } : {},
    smsChannel: smsChannel,
    contact: contact
  };
}

function findContactByEmail_(email) {
  email = String(email || '').trim().toLowerCase();
  if (!isValidEmail_(email)) return null;

  const collection = ccGet_('/contacts?' + toQueryString_({
    email: email,
    status: 'all',
    include: 'list_memberships,phone_numbers,custom_fields',
    limit: 1
  }));

  const contacts = collection.contacts || [];
  if (!contacts.length) return null;

  const contactId = contacts[0].contact_id;
  if (!contactId) return contacts[0];

  return ccGet_('/contacts/' + encodeURIComponent(contactId) + '?' + toQueryString_({
    include: 'list_memberships,phone_numbers,custom_fields'
  }));
}

function listMembers_(listId) {
  listId = String(listId || '').trim();
  if (!listId) {
    return { ok: false, error: 'No listId supplied and CC_PREFS_EMAIL_LIST_ID is blank.' };
  }

  const members = ccGet_('/contacts?' + toQueryString_({
    lists: listId,
    status: 'all',
    include: 'list_memberships,phone_numbers,custom_fields',
    limit: 50
  }));

  return {
    ok: true,
    listId: listId,
    result: members
  };
}


function getAccountEmails_(params) {
  params = params || {};
  const accountKey = String(params.accountKey || '').trim();
  const currentEmail = String(params.email || '').trim().toLowerCase();
  const includeCc = String(params.includeCc || '1') !== '0';

  const linked = getLinkedEmailsForAccount_(accountKey);
  const byEmail = {};

  linked.forEach(function(item){
    const email = String(item.email || '').trim().toLowerCase();
    if (!isValidEmail_(email)) return;
    byEmail[email] = Object.assign({}, byEmail[email] || {}, item, { email: email });
  });

  if (isValidEmail_(currentEmail) && !byEmail[currentEmail]) {
    byEmail[currentEmail] = {
      email: currentEmail,
      accountKey: accountKey,
      source: 'AccountSettings current email',
      active: true
    };
  }

  const emails = Object.keys(byEmail).sort().slice(0, 50).map(function(email){
    const item = byEmail[email];
    if (!includeCc) return item;

    try {
      const status = debugContact_(email);
      const details = getContactDetails_(status);
      return Object.assign({}, item, {
        contactFound: status.found === true,
        contactId: status.contactId || '',
        contactStatus: status.contactStatus || '',
        permissionToSend: status.permissionToSend || '',
        isEmailListMember: status.isEmailListMember === true,
        isSmsListMember: status.isSmsListMember === true,
        emailBilling: getContactPreferenceBool_(status.contact, getProp_('CC_PREFS_CUSTOM_FIELD_EMAIL_BILLING_ID'), false),
        emailDelivery: getContactPreferenceBool_(status.contact, getProp_('CC_PREFS_CUSTOM_FIELD_EMAIL_DELIVERY_ID'), false),
        firstName: details.firstName || item.firstName || '',
        lastName: details.lastName || item.lastName || '',
        companyName: details.companyName || item.companyName || '',
        phone: details.phone || item.phone || ''
      });
    } catch (err) {
      return Object.assign({}, item, {
        contactLookupError: String(err && err.message ? err.message : err)
      });
    }
  });

  return {
    ok: true,
    accountKey: accountKey,
    currentEmail: currentEmail,
    count: emails.length,
    emails: emails
  };
}

function linkEmailToAccount_(submission) {
  submission = submission || {};
  if (!submission.accountKey) throw new Error('Missing accountKey for linkEmail.');
  if (!submission.email) throw new Error('Missing valid email for linkEmail.');

  const linkResult = registerLinkedEmail_(submission, { source: 'linkEmail', resultOk: true });

  // Linking an email now does two things:
  // 1) save the relationship in our AccountEmailLinks sheet, and
  // 2) stamp Constant Contact with account/company detail for that email.
  // This does NOT add the contact to the marketing list and does NOT set explicit
  // marketing permission. Marketing opt-in is still controlled only by Save Preferences.
  let detailUpdate = { skipped: true, reason: 'Constant Contact detail sync not attempted.' };
  let contactStatus = null;
  try {
    detailUpdate = upsertLinkedContactDetailsInConstantContact_(submission);
    contactStatus = debugContact_(submission.email);
  } catch (err) {
    detailUpdate = { ok: false, skipped: true, error: String(err && err.message ? err.message : err) };
  }

  const result = {
    ok: true,
    accountKey: submission.accountKey,
    email: submission.email,
    linked: true,
    linkResult: linkResult,
    constantContact: contactStatus,
    detailUpdate: detailUpdate,
    notes: [
      'Email was linked to this WebTrack account in the preference bridge.',
      'Constant Contact was updated/created with account detail when the API allowed it.',
      'This does not merge Constant Contact records and does not opt the email into marketing by itself.'
    ]
  };

  logSubmission_(submission, {
    ok: true,
    receivedAt: new Date().toISOString(),
    accountKey: submission.accountKey,
    email: submission.email,
    emailSynced: detailUpdate && detailUpdate.ok !== false,
    smsSynced: false,
    emailResult: detailUpdate,
    smsResult: null,
    notes: result.notes
  });

  return result;
}

function registerLinkedEmail_(submission, meta) {
  submission = submission || {};
  meta = meta || {};

  const sheetId = getProp_('CC_PREFS_LOG_SHEET_ID');
  if (!sheetId) return { ok: true, skipped: true, reason: 'CC_PREFS_LOG_SHEET_ID is blank.' };

  const accountKey = String(submission.accountKey || '').trim();
  const email = String(submission.email || '').trim().toLowerCase();
  if (!accountKey || !isValidEmail_(email)) {
    return { ok: false, skipped: true, reason: 'Missing accountKey or valid email.' };
  }

  const sheetName = getProp_('CC_PREFS_LINK_SHEET_NAME') || 'AccountEmailLinks';
  const ss = SpreadsheetApp.openById(sheetId);
  let sh = ss.getSheetByName(sheetName);
  if (!sh) sh = ss.insertSheet(sheetName);

  const headers = [
    'Account Key',
    'Email',
    'First Name',
    'Last Name',
    'Company Name',
    'Phone',
    'Linked At',
    'Last Updated At',
    'Source',
    'Active'
  ];
  ensureLogHeaders_(sh, headers);

  const dataRange = sh.getDataRange();
  const values = dataRange.getValues();
  const currentHeaders = values[0].map(function(h){ return String(h || '').trim(); });
  const idx = {};
  currentHeaders.forEach(function(h, i){ idx[h] = i; });

  const accountLower = accountKey.toLowerCase();
  const emailLower = email.toLowerCase();
  let rowNum = -1;
  for (let r = 1; r < values.length; r++) {
    const rowAccount = String(values[r][idx['Account Key']] || '').trim().toLowerCase();
    const rowEmail = String(values[r][idx['Email']] || '').trim().toLowerCase();
    if (rowAccount === accountLower && rowEmail === emailLower) {
      rowNum = r + 1;
      break;
    }
  }

  const rowObj = {
    'Account Key': accountKey,
    'Email': email,
    'First Name': submission.firstName || '',
    'Last Name': submission.lastName || '',
    'Company Name': submission.companyName || submission.accountKey || '',
    'Phone': submission.phone || submission.smsPhone || '',
    'Linked At': new Date(),
    'Last Updated At': new Date(),
    'Source': meta.source || submission.source || '',
    'Active': true
  };

  const rowValues = currentHeaders.map(function(h){ return rowObj[h] !== undefined ? rowObj[h] : ''; });
  if (rowNum > 0) {
    // Preserve the original Linked At date while refreshing the rest.
    const linkedAtCol = idx['Linked At'];
    if (linkedAtCol !== undefined) rowValues[linkedAtCol] = values[rowNum - 1][linkedAtCol] || new Date();
    sh.getRange(rowNum, 1, 1, currentHeaders.length).setValues([rowValues]);
    return { ok: true, updated: true, accountKey: accountKey, email: email };
  }

  sh.appendRow(rowValues);
  return { ok: true, created: true, accountKey: accountKey, email: email };
}

function getLinkedEmailsForAccount_(accountKey) {
  const results = [];
  const sheetId = getProp_('CC_PREFS_LOG_SHEET_ID');
  if (!sheetId) return results;

  const targetAccount = String(accountKey || '').trim().toLowerCase();
  if (!targetAccount) return results;

  const ss = SpreadsheetApp.openById(sheetId);

  function collectFromSheet(sheetName, isLinkSheet) {
    const sh = ss.getSheetByName(sheetName);
    if (!sh || sh.getLastRow() < 2) return;
    const values = sh.getDataRange().getValues();
    const headers = values[0].map(function(h){ return String(h || '').trim(); });
    const idx = {};
    headers.forEach(function(h, i){ idx[h] = i; });

    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      const rowAccount = String(row[idx['Account Key']] || '').trim().toLowerCase();
      const rowEmail = String(row[idx['Email']] || '').trim().toLowerCase();
      const active = idx['Active'] === undefined ? true : !(row[idx['Active']] === false || String(row[idx['Active']]).toLowerCase() === 'false');
      if (rowAccount !== targetAccount || !isValidEmail_(rowEmail) || !active) continue;
      results.push({
        accountKey: row[idx['Account Key']] || accountKey,
        email: rowEmail,
        firstName: idx['First Name'] !== undefined ? row[idx['First Name']] || '' : '',
        lastName: idx['Last Name'] !== undefined ? row[idx['Last Name']] || '' : '',
        companyName: idx['Company Name'] !== undefined ? row[idx['Company Name']] || '' : '',
        phone: idx['Phone'] !== undefined ? row[idx['Phone']] || '' : '',
        lastUpdatedAt: idx['Last Updated At'] !== undefined && row[idx['Last Updated At']] ? new Date(row[idx['Last Updated At']]).toISOString() : (idx['Logged At'] !== undefined && row[idx['Logged At']] ? new Date(row[idx['Logged At']]).toISOString() : null),
        source: isLinkSheet ? 'AccountEmailLinks' : 'PreferenceLog'
      });
    }
  }

  collectFromSheet(getProp_('CC_PREFS_LINK_SHEET_NAME') || 'AccountEmailLinks', true);
  collectFromSheet(getProp_('CC_PREFS_LOG_SHEET_NAME') || 'PreferenceLog', false);

  const byEmail = {};
  results.forEach(function(item){ byEmail[item.email] = Object.assign({}, byEmail[item.email] || {}, item); });
  return Object.keys(byEmail).sort().map(function(email){ return byEmail[email]; });
}

function upsertLinkedContactDetailsInConstantContact_(submission) {
  const existingContact = findContactByEmail_(submission.email);
  if (existingContact && existingContact.contact_id) {
    const result = updateExistingContactDetails_(submission, existingContact);
    return {
      ok: true,
      mode: 'updated_existing_contact',
      contactId: existingContact.contact_id,
      result: result
    };
  }

  const result = createLinkedContactDetails_(submission);
  return {
    ok: true,
    mode: 'created_account_linked_contact',
    contactId: result && result.contact_id ? result.contact_id : '',
    result: result
  };
}

function createLinkedContactDetails_(submission) {
  // Create an account-sourced Constant Contact record so the email can carry the
  // WebTrack account/company detail without adding it to the marketing list.
  // This intentionally avoids /contacts/sign_up_form so linking alone does not
  // change permission_to_send to explicit or subscribe the contact to a list.
  const body = {
    create_source: 'Account',
    email_address: {
      address: submission.email,
      permission_to_send: 'implicit'
    }
  };

  applyAccountDetailFieldsToContactBody_(body, submission, {});
  return ccPost_('/contacts', body, 'Create linked Constant Contact contact failed');
}

function updateExistingContactDetails_(submission, existingContact) {
  // Full-contact PUT can overwrite missing core fields if done carelessly.
  // Constant Contact requires update_source on PUT, so this preserves the current
  // contact details first and then stamps only the account/company fields we own.
  const contact = existingContact || findContactByEmail_(submission.email);
  if (!contact || !contact.contact_id) return { skipped: true, reason: 'Contact was not found.' };

  const emailAddress = normalizeEmailAddressResource_(contact.email_address, submission.email);

  const body = {
    update_source: 'Account',
    email_address: emailAddress,
    first_name: contact.first_name || '',
    last_name: contact.last_name || '',
    company_name: contact.company_name || '',
    job_title: contact.job_title || '',
    list_memberships: Array.isArray(contact.list_memberships) ? contact.list_memberships : [],
    phone_numbers: Array.isArray(contact.phone_numbers) ? contact.phone_numbers : [],
    street_addresses: Array.isArray(contact.street_addresses) ? contact.street_addresses : [],
    custom_fields: Array.isArray(contact.custom_fields) ? contact.custom_fields : []
  };

  if (contact.birthday_month) body.birthday_month = contact.birthday_month;
  if (contact.birthday_day) body.birthday_day = contact.birthday_day;
  if (contact.anniversary) body.anniversary = contact.anniversary;
  if (Array.isArray(contact.taggings)) body.taggings = contact.taggings;

  applyAccountDetailFieldsToContactBody_(body, submission, contact);
  cleanContactUpdateBody_(body);

  return ccPut_('/contacts/' + encodeURIComponent(contact.contact_id), body, 'Update linked contact details failed');
}

function applyAccountDetailFieldsToContactBody_(body, submission, existingContact) {
  existingContact = existingContact || {};

  const firstName = String(submission.firstName || '').trim();
  const lastName = String(submission.lastName || '').trim();
  const companyName = String(submission.companyName || submission.accountKey || '').trim();
  const jobTitle = String(submission.jobTitle || '').trim();

  if (firstName) body.first_name = trimMax_(firstName, 50);
  else if (existingContact.first_name) body.first_name = existingContact.first_name;

  if (lastName) body.last_name = trimMax_(lastName, 50);
  else if (existingContact.last_name) body.last_name = existingContact.last_name;

  if (companyName) body.company_name = trimMax_(companyName, 50);
  else if (existingContact.company_name) body.company_name = existingContact.company_name;

  if (jobTitle) body.job_title = trimMax_(jobTitle, 50);
  else if (existingContact.job_title) body.job_title = existingContact.job_title;

  const phone = normalizePhone_(submission.phone || submission.smsPhone || '');
  if (phone) {
    if (!Array.isArray(body.phone_numbers)) body.phone_numbers = [];
    if (!body.phone_numbers.some(function(p){ return normalizePhone_(p.phone_number || '') === phone; })) {
      body.phone_numbers.push({ phone_number: phone, kind: 'other' });
    }
  }

  if (!Array.isArray(body.custom_fields)) body.custom_fields = [];

  const accountKeyFieldId = getProp_('CC_PREFS_CUSTOM_FIELD_ACCOUNT_KEY_ID');
  if (accountKeyFieldId && submission.accountKey) {
    upsertCustomFieldValue_(body.custom_fields, accountKeyFieldId, trimMax_(submission.accountKey, 255));
  }

  const sourceFieldId = getProp_('CC_PREFS_CUSTOM_FIELD_SOURCE_ID');
  if (sourceFieldId && submission.source) {
    upsertCustomFieldValue_(body.custom_fields, sourceFieldId, trimMax_(submission.source, 255));
  }

  addPreferenceCustomFields_(body.custom_fields, submission);
}

function addPreferenceCustomFields_(customFields, submission) {
  customFields = customFields || [];
  submission = submission || {};

  const billingFieldId = getProp_('CC_PREFS_CUSTOM_FIELD_EMAIL_BILLING_ID');
  if (billingFieldId) {
    upsertCustomFieldValue_(customFields, billingFieldId, boolPreferenceValue_(submission.emailBilling));
  }

  const deliveryFieldId = getProp_('CC_PREFS_CUSTOM_FIELD_EMAIL_DELIVERY_ID');
  if (deliveryFieldId) {
    upsertCustomFieldValue_(customFields, deliveryFieldId, boolPreferenceValue_(submission.emailDelivery));
  }

  const smsMarketingFieldId = getProp_('CC_PREFS_CUSTOM_FIELD_SMS_MARKETING_ID');
  if (smsMarketingFieldId) {
    upsertCustomFieldValue_(customFields, smsMarketingFieldId, boolPreferenceValue_(submission.smsMarketing));
  }
  wlAddMarketingFields_(customFields, submission);
}

function boolPreferenceValue_(value) {
  return value === true ? 'Yes' : 'No';
}

function parsePreferenceBool_(value, fallback) {
  if (value === undefined || value === null || String(value).trim() === '') return Boolean(fallback);
  const normalized = String(value).trim().toLowerCase();
  if (['yes','y','true','1','on','enabled','subscribed','opted in','opted-in'].indexOf(normalized) >= 0) return true;
  if (['no','n','false','0','off','disabled','unsubscribed','opted out','opted-out'].indexOf(normalized) >= 0) return false;
  return Boolean(fallback);
}

function getContactCustomFieldValue_(contact, fieldId) {
  fieldId = String(fieldId || '').trim();
  if (!fieldId || !contact || !Array.isArray(contact.custom_fields)) return '';
  const match = contact.custom_fields.find(function(field){
    return field && String(field.custom_field_id || '').trim() === fieldId;
  });
  return match ? String(match.value || match.text_value || '').trim() : '';
}

function getContactPreferenceBool_(contact, fieldId, fallback) {
  const value = getContactCustomFieldValue_(contact, fieldId);
  return parsePreferenceBool_(value, fallback);
}

function normalizeEmailAddressResource_(emailAddress, fallbackEmail) {
  if (emailAddress && typeof emailAddress === 'object') {
    const copy = Object.assign({}, emailAddress);
    if (!copy.address) copy.address = fallbackEmail;
    return copy;
  }
  return {
    address: fallbackEmail,
    permission_to_send: 'implicit'
  };
}

function cleanContactUpdateBody_(body) {
  if (Array.isArray(body.custom_fields)) {
    body.custom_fields = body.custom_fields.filter(function(f){
      return f && f.custom_field_id && String(f.value || '').trim() !== '';
    });
  }
  if (Array.isArray(body.phone_numbers)) {
    body.phone_numbers = body.phone_numbers.filter(function(p){
      return p && normalizePhone_(p.phone_number || '');
    });
  }
  if (Array.isArray(body.street_addresses)) {
    body.street_addresses = body.street_addresses.filter(function(a){ return a && Object.keys(a).length; });
  }
}

function upsertCustomFieldValue_(customFields, fieldId, value) {
  customFields = customFields || [];
  const existing = customFields.find(function(f){ return f && f.custom_field_id === fieldId; });
  if (existing) existing.value = value;
  else customFields.push({ custom_field_id: fieldId, value: value });
}

function getContactDetails_(contactStatus) {
  const contact = contactStatus && contactStatus.contact ? contactStatus.contact : null;
  if (!contact) return {};

  return {
    firstName: contact.first_name || '',
    lastName: contact.last_name || '',
    companyName: contact.company_name || '',
    jobTitle: contact.job_title || '',
    phone: getContactPhone_(contactStatus)
  };
}

function getContactPhone_(contactStatus) {
  const contact = contactStatus && contactStatus.contact ? contactStatus.contact : null;
  const phones = contact && Array.isArray(contact.phone_numbers) ? contact.phone_numbers : [];
  if (!phones.length) return '';
  const first = phones.find(function(p){ return p && p.phone_number; }) || phones[0];
  return first && first.phone_number ? normalizePhone_(first.phone_number) : '';
}

function getPreferenceStatus_(params) {
  params = params || {};
  const accountKey = String(params.accountKey || '').trim();
  let email = String(params.email || '').trim().toLowerCase();

  let latest = getLatestLoggedPrefs_(accountKey, email);
  if (!email && latest && latest.email) email = latest.email;

  const contactStatus = email ? debugContact_(email) : { ok: true, found: false, listMemberships: [] };

  // Source-of-truth values from Constant Contact list membership.
  // Email marketing is direct from CC_PREFS_EMAIL_LIST_ID membership only.
  // SMS marketing is direct from CC_PREFS_SMS_LIST_ID when that property is configured.
  const emailPermission = String(contactStatus.permissionToSend || '').toLowerCase();
  const contactStatusValue = String(contactStatus.contactStatus || '').toLowerCase();
  const emailMarketingFromCc = Boolean(contactStatus.found && contactStatus.isEmailListMember && emailPermission !== 'unsubscribed' && contactStatusValue !== 'unsubscribed');
  const smsListConfigured = Boolean(getProp_('CC_PREFS_SMS_LIST_ID'));
  const smsMarketingFromCc = Boolean(contactStatus.found && contactStatus.isSmsListMember);

  const ccDetails = getContactDetails_(contactStatus);
  const contact = contactStatus && contactStatus.contact ? contactStatus.contact : null;
  const emailBillingFromCustom = getContactPreferenceBool_(contact, getProp_('CC_PREFS_CUSTOM_FIELD_EMAIL_BILLING_ID'), latest && latest.emailBilling);
  const emailDeliveryFromCustom = getContactPreferenceBool_(contact, getProp_('CC_PREFS_CUSTOM_FIELD_EMAIL_DELIVERY_ID'), latest && latest.emailDelivery);
  const smsMarketingFromCustom = getContactPreferenceBool_(contact, getProp_('CC_PREFS_CUSTOM_FIELD_SMS_MARKETING_ID'), latest && latest.smsMarketing);

  const preferences = {
    accountKey: accountKey || (latest && latest.accountKey) || '',
    email: email || (latest && latest.email) || '',
    firstName: ccDetails.firstName || (latest && latest.firstName) || '',
    lastName: ccDetails.lastName || (latest && latest.lastName) || '',
    companyName: ccDetails.companyName || (latest && latest.companyName) || accountKey || '',
    jobTitle: ccDetails.jobTitle || (latest && latest.jobTitle) || '',
    phone: ccDetails.phone || (latest && latest.phone) || '',
    emailMarketing: emailMarketingFromCc,
    emailBilling: emailBillingFromCustom,
    emailDelivery: emailDeliveryFromCustom,
    smsMarketing: smsListConfigured ? smsMarketingFromCc : smsMarketingFromCustom,
    smsPhone: getContactPhone_(contactStatus) || (latest && latest.smsPhone) || '',
    updatedAt: (latest && latest.loggedAt) || null,
    source: 'Apps Script getPreferences + Constant Contact live lookup'
  };

  return {
    ok: true,
    accountKey: accountKey,
    email: email,
    preferences: preferences,
    latestLoggedPreference: latest,
    constantContact: contactStatus
  };
}

function ccGet_(path) {
  const url = path.indexOf('http') === 0 ? path : CC_API_BASE + path;
  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    muteHttpExceptions: true,
    headers: {
      Authorization: 'Bearer ' + getAccessToken_(),
      Accept: 'application/json'
    }
  });
  return parseCcResponse_(response, 'Constant Contact GET failed');
}

function ccPost_(path, body, failMessage) {
  const url = path.indexOf('http') === 0 ? path : CC_API_BASE + path;
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    muteHttpExceptions: true,
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + getAccessToken_(),
      Accept: 'application/json'
    },
    payload: JSON.stringify(body || {})
  });
  return parseCcResponse_(response, failMessage || 'Constant Contact POST failed');
}

function ccPut_(path, body, failMessage) {
  const url = path.indexOf('http') === 0 ? path : CC_API_BASE + path;
  const response = UrlFetchApp.fetch(url, {
    method: 'put',
    muteHttpExceptions: true,
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + getAccessToken_(),
      Accept: 'application/json'
    },
    payload: JSON.stringify(body || {})
  });
  return parseCcResponse_(response, failMessage || 'Constant Contact PUT failed');
}

/* =============================
   Submission handling and logging
   ============================= */

function getPostJson_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('No POST body received.');
  }

  const text = String(e.postData.contents || '').trim();

  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error('POST body was not valid JSON.');
  }
}


function normalizeEmailListIntent_(raw) {
  raw = raw || {};
  const nested = raw.constantContact && raw.constantContact.emailListIntent;
  const direct = raw.emailListIntent || raw.marketingEmailIntent || nested || '';
  const v = String(direct || '').trim().toLowerCase();
  if (['subscribe','subscribed','opt_in','opt-in','optin','add','add_to_marketing_list'].indexOf(v) >= 0) return 'subscribe';
  if (['unsubscribe','unsubscribed','opt_out','opt-out','optout','remove_from_marketing_list','remove','remove_list'].indexOf(v) >= 0) return 'unsubscribe';
  if (['no_change','none','skip','do_not_change','unchanged'].indexOf(v) >= 0) return 'no_change';
  return toBool_(raw.emailMarketing) ? 'subscribe' : 'unsubscribe';
}

function normalizeSmsListIntent_(raw) {
  raw = raw || {};
  const nested = raw.constantContact && raw.constantContact.smsListIntent;
  const direct = raw.smsListIntent || nested || '';
  const v = String(direct || '').trim().toLowerCase();
  if (['subscribe','subscribed','opt_in','opt-in','optin','add'].indexOf(v) >= 0) return 'subscribe';
  if (['unsubscribe','unsubscribed','opt_out','opt-out','optout','remove'].indexOf(v) >= 0) return 'unsubscribe';
  if (['no_change','none','skip','do_not_change','unchanged'].indexOf(v) >= 0) return 'no_change';
  return toBool_(raw.smsMarketing) ? 'subscribe' : 'no_change';
}

function getEmailListIntent_(submission) {
  const v = String((submission && submission.emailListIntent) || '').trim().toLowerCase();
  if (v) return v;
  return submission && submission.emailMarketing ? 'subscribe' : 'unsubscribe';
}

function normalizeSubmission_(raw) {
  const email = String(raw.email || raw.emailAddress || '').trim().toLowerCase();
  const smsPhone = normalizePhone_(raw.smsPhone || raw.sms_phone || raw.phone || '');

  return {
    accountKey: String(raw.accountKey || raw.accountName || '').trim(),
    email: isValidEmail_(email) ? email : '',
    firstName: String(raw.firstName || raw.first_name || '').trim(),
    lastName: String(raw.lastName || raw.last_name || '').trim(),
    companyName: String(raw.companyName || raw.company_name || '').trim(),
    jobTitle: String(raw.jobTitle || raw.job_title || '').trim(),
    phone: normalizePhone_(raw.phone || raw.primaryPhone || ''),
    emailMarketing: toBool_(raw.emailMarketing),
    emailBilling: toBool_(raw.emailBilling),
    emailDelivery: toBool_(raw.emailDelivery),
    smsMarketing: toBool_(raw.smsMarketing),
    smsPhone: smsPhone,
    emailListIntent: normalizeEmailListIntent_(raw),
    smsListIntent: normalizeSmsListIntent_(raw),
    source: String(raw.source || 'WebTrack AccountInfo').trim(),
    updatedAt: String(raw.updatedAt || new Date().toISOString()).trim(),
    raw: raw
  };
}

function logSubmission_(submission, result) {
  submission = submission || {};
  result = result || {};

  const sheetId = getProp_('CC_PREFS_LOG_SHEET_ID');
  if (!sheetId) {
    console.log(JSON.stringify({ok: result.ok === true, emailSynced: result.emailSynced === true}));
    return;
  }

  const sheetName = getProp_('CC_PREFS_LOG_SHEET_NAME') || 'PreferenceLog';
  const ss = SpreadsheetApp.openById(sheetId);
  let sh = ss.getSheetByName(sheetName);

  if (!sh) sh = ss.insertSheet(sheetName);

  const headers = [
    'Logged At',
    'Account Key',
    'Email',
    'First Name',
    'Last Name',
    'Company Name',
    'Phone',
    'Email Marketing',
    'Email Billing',
    'Email Delivery',
    'SMS Marketing',
    'SMS Phone',
    'Email List Intent',
    'SMS List Intent',
    'Source',
    'Constant Contact Email Synced',
    'Constant Contact SMS Synced',
    'Result OK',
    'Error',
    'Result JSON'
  ];

  ensureLogHeaders_(sh, headers);

  const rowObj = {
    'Logged At': new Date(),
    'Account Key': submission.accountKey || result.accountKey || '',
    'Email': submission.email || result.email || '',
    'First Name': submission.firstName || '',
    'Last Name': submission.lastName || '',
    'Company Name': submission.companyName || '',
    'Phone': submission.phone || '',
    'Email Marketing': submission.emailMarketing === true,
    'Email Billing': submission.emailBilling === true,
    'Email Delivery': submission.emailDelivery === true,
    'SMS Marketing': submission.smsMarketing === true,
    'SMS Phone': submission.smsPhone || '',
    'Email List Intent': submission.emailListIntent || '',
    'SMS List Intent': submission.smsListIntent || '',
    'Source': submission.source || '',
    'Constant Contact Email Synced': result.emailSynced === true,
    'Constant Contact SMS Synced': result.smsSynced === true,
    'Result OK': result.ok === true,
    'Error': result.error || '',
    'Result JSON': JSON.stringify(result)
  };

  const currentHeaders = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function(h){ return String(h || '').trim(); });
  sh.appendRow(currentHeaders.map(function(h){ return rowObj[h] !== undefined ? rowObj[h] : ''; }));
}

function ensureLogHeaders_(sh, desiredHeaders) {
  if (sh.getLastRow() === 0 || sh.getLastColumn() === 0) {
    sh.appendRow(desiredHeaders);
    return;
  }

  const current = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function(h){ return String(h || '').trim(); });
  let changed = false;
  desiredHeaders.forEach(function(h){
    if (current.indexOf(h) < 0) {
      current.push(h);
      changed = true;
    }
  });
  if (changed) {
    sh.getRange(1, 1, 1, current.length).setValues([current]);
  }
}

function getLatestLoggedPrefs_(accountKey, email) {
  const sheetId = getProp_('CC_PREFS_LOG_SHEET_ID');
  if (!sheetId) return null;

  const sheetName = getProp_('CC_PREFS_LOG_SHEET_NAME') || 'PreferenceLog';
  const ss = SpreadsheetApp.openById(sheetId);
  const sh = ss.getSheetByName(sheetName);
  if (!sh || sh.getLastRow() < 2) return null;

  const values = sh.getDataRange().getValues();
  const headers = values[0].map(function(h){ return String(h || '').trim(); });
  const idx = {};
  headers.forEach(function(h, i){ idx[h] = i; });

  const targetAccount = String(accountKey || '').trim().toLowerCase();
  const targetEmail = String(email || '').trim().toLowerCase();

  for (let r = values.length - 1; r >= 1; r--) {
    const row = values[r];
    const rowAccount = String(row[idx['Account Key']] || '').trim().toLowerCase();
    const rowEmail = String(row[idx['Email']] || '').trim().toLowerCase();

    const accountMatches = targetAccount && rowAccount === targetAccount;
    const emailMatches = targetEmail && rowEmail === targetEmail;

    if (targetEmail ? !emailMatches : !accountMatches) continue;

    return {
      loggedAt: idx['Logged At'] !== undefined && row[idx['Logged At']] ? new Date(row[idx['Logged At']]).toISOString() : null,
      accountKey: idx['Account Key'] !== undefined ? row[idx['Account Key']] || '' : '',
      email: idx['Email'] !== undefined ? row[idx['Email']] || '' : '',
      firstName: idx['First Name'] !== undefined ? row[idx['First Name']] || '' : '',
      lastName: idx['Last Name'] !== undefined ? row[idx['Last Name']] || '' : '',
      companyName: idx['Company Name'] !== undefined ? row[idx['Company Name']] || '' : '',
      phone: idx['Phone'] !== undefined ? row[idx['Phone']] || '' : '',
      emailMarketing: idx['Email Marketing'] !== undefined && (row[idx['Email Marketing']] === true || String(row[idx['Email Marketing']]).toLowerCase() === 'true'),
      emailBilling: idx['Email Billing'] !== undefined && (row[idx['Email Billing']] === true || String(row[idx['Email Billing']]).toLowerCase() === 'true'),
      emailDelivery: idx['Email Delivery'] !== undefined && (row[idx['Email Delivery']] === true || String(row[idx['Email Delivery']]).toLowerCase() === 'true'),
      smsMarketing: idx['SMS Marketing'] !== undefined && (row[idx['SMS Marketing']] === true || String(row[idx['SMS Marketing']]).toLowerCase() === 'true'),
      smsPhone: idx['SMS Phone'] !== undefined ? row[idx['SMS Phone']] || '' : '',
      source: idx['Source'] !== undefined ? row[idx['Source']] || '' : '',
      resultOk: idx['Result OK'] !== undefined && (row[idx['Result OK']] === true || String(row[idx['Result OK']]).toLowerCase() === 'true'),
      error: idx['Error'] !== undefined ? row[idx['Error']] || '' : ''
    };
  }

  return null;
}

/* =============================
   Helpers
   ============================= */

function parseCcResponse_(response, failMessage) {
  const code = response.getResponseCode();
  const text = response.getContentText() || '';

  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch (err) {
    body = { raw: text };
  }

  if (code < 200 || code >= 300) {
    const errors = Array.isArray(body) ? body : [body];
    const keys = errors.map(function(item) { return String(item && item.error_key || '').replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 100); }).filter(Boolean);
    const safeMessage = failMessage + ': HTTP ' + code + (keys.length ? ' (' + keys.join(', ') + ')' : '');
    console.error(safeMessage);
    throw new Error(safeMessage);
  }

  return body;
}

function basicAuthHeader_() {
  const id = requiredProp_('CC_PREFS_CLIENT_ID');
  const secret = requiredProp_('CC_PREFS_CLIENT_SECRET');
  return 'Basic ' + Utilities.base64Encode(id + ':' + secret);
}

function getProp_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function setProp_(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, String(value));
}

function requiredProp_(key) {
  const value = getProp_(key);
  if (!value) throw new Error('Missing Script Property: ' + key);
  return value;
}

function toQueryString_(obj) {
  return Object.keys(obj)
    .filter(function (key) { return obj[key] !== undefined && obj[key] !== null && obj[key] !== ''; })
    .map(function (key) { return encodeURIComponent(key) + '=' + encodeURIComponent(String(obj[key])); })
    .join('&');
}

function redirect_(url) {
  return HtmlService.createHtmlOutput(
    '<!doctype html><html><head>' +
      '<meta http-equiv="refresh" content="0; url=' + escapeHtml_(url) + '">' +
      '</head><body>' +
      '<p>Redirecting to Constant Contact...</p>' +
      '<p><a href="' + escapeHtml_(url) + '">Click here if you are not redirected</a></p>' +
      '<script>window.top.location.href = ' + JSON.stringify(url) + ';</script>' +
      '</body></html>'
  );
}

function html_(body) {
  return HtmlService.createHtmlOutput(
    '<!doctype html><html><body style="font-family:Arial,sans-serif;padding:24px;">' + body + '</body></html>'
  );
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonOrJsonp_(obj, params) {
  params = params || {};
  const callback = String(params.callback || '').trim();

  if (callback && /^[A-Za-z_$][0-9A-Za-z_$]*(\.[A-Za-z_$][0-9A-Za-z_$]*)*$/.test(callback)) {
    return ContentService
      .createTextOutput(callback + '(' + JSON.stringify(obj) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return json_(obj);
}

function isValidEmail_(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function normalizePhone_(value) {
  const digits = String(value || '').replace(/\D+/g, '');
  if (!digits) return '';
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.charAt(0) === '1') return digits;
  return digits.slice(0, 15);
}

function toBool_(value) {
  return value === true || value === 'true' || value === '1' || value === 1 || value === 'yes';
}

function trimMax_(value, max) {
  return String(value || '').trim().slice(0, max);
}

function escapeHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
