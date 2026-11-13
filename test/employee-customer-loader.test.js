'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../headermodern.js'), 'utf8');
const loader = source.slice(source.indexOf('  function loadEmployeeCustomerPanel()'), source.indexOf('  function deferCartCheckoutUntilPilotReady('));

function fixture({ employee = true, framed = false, origin = 'https://webtrack.woodsonlumber.com', ready = false } = {}) {
  const scripts = [];
  const win = { location: { origin }, WLStaffCustomerPanel: ready ? {} : null };
  win.top = framed ? {} : win;
  const doc = {
    getElementById: () => employee ? {} : null,
    querySelector: () => scripts[0],
    createElement: () => ({ setAttribute() {} }),
    head: { appendChild: script => scripts.push(script) }
  };
  const context = vm.createContext({ window: win, document: doc, WEBTRACK: 'https://webtrack.woodsonlumber.com', EMPLOYEE_CUSTOMER_URL: 'EmployeeCustomerPanel.js?v=release' });
  vm.runInContext(loader, context);
  return { scripts, load: context.loadEmployeeCustomerPanel };
}

test('customer-only sessions and embedded pages never request the employee tool', () => {
  for (const options of [{ employee: false }, { framed: true }, { origin: 'https://www.woodsonlumber.com' }]) {
    const f = fixture(options); f.load(); assert.equal(f.scripts.length, 0);
  }
});

test('employee header loads the drawer once, with native controls available during delivery', () => {
  const f = fixture(); f.load(); f.load();
  assert.equal(f.scripts.length, 1);
  assert.equal(f.scripts[0].src, 'EmployeeCustomerPanel.js?v=release');
  assert.equal(f.scripts[0].async, true);
  const loaded = fixture({ ready: true }); loaded.load(); assert.equal(loaded.scripts.length, 0);
});
