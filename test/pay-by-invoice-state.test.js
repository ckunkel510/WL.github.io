const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'PayByInvoice.js'),
  'utf8'
);

function between(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing start marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

test('cash reload keeps a $5 amount and saved bank choice through WebForms postbacks', () => {
  const amountPersistence = between(
    'function wireFieldPersistence()',
    '/* =============================\n     Boot'
  );
  assert.match(amountPersistence, /total:\s*amt\s*\?\s*amt\.value/);

  const savedBankSelection = between(
    "st.bank = { mode:'saved', value: val, text, __pickedAccount:true };",
    'autoAdvanceToFinalPaymentStep();'
  );
  const saveIndex = savedBankSelection.indexOf('savePayState(st);');
  const pickedIndex = savedBankSelection.indexOf('markPickedThisRun()');
  const syncIndex = savedBankSelection.indexOf("syncNativeBankChoice('saved', val, true)");

  assert.ok(saveIndex >= 0, 'saved account state must be persisted');
  assert.ok(pickedIndex > saveIndex, 'saved account must be marked as picked after persistence');
  assert.ok(syncIndex > pickedIndex, 'picked marker must be written before WebForms can post back');
});

test('wizard mount does not clear a saved account during a same-page reload', () => {
  const mountSetup = between(
    'shell.parentNode.insertBefore(wiz, shell);',
    '// Move cards into steps (keeps all original logic intact)'
  );

  assert.doesNotMatch(mountSetup, /clearPickedThisRun\s*\(/);
  assert.doesNotMatch(mountSetup, /__pickedAccount\s*=\s*false/);
  assert.doesNotMatch(mountSetup, /__userPicked\s*=\s*false/);

  const freshArrivalReset = between(
    '// Reset wizard state when arriving from another page',
    'function injectCSS()'
  );
  assert.match(freshArrivalReset, /if\s*\(cameFromOtherPage\(\)\)\s*\{\s*resetWizardState\(\)/);
  assert.match(freshArrivalReset, /sessionStorage\.removeItem\('wlPayState'\)/);
  assert.match(freshArrivalReset, /sessionStorage\.removeItem\('wlPayPickedThisRun'\)/);
});
