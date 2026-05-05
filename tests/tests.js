const results = [];

export function test(name, fn) {
  try {
    fn();
    results.push({ name, status: 'ok' });
  } catch (e) {
    results.push({ name, status: 'fail', error: e.message, stack: e.stack });
  }
}

export function assertEqual(actual, expected, msg = '') {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${msg}\n  expected: ${e}\n  got:      ${a}`);
  }
}

export function assertTrue(cond, msg = 'assertion failed') {
  if (!cond) throw new Error(msg);
}

// Tests will be appended below as parsers come online (Tasks 7–11).
// For now, one smoke test to verify the runner works.
test('runner self-test', () => {
  assertEqual(1 + 1, 2);
});

// Render results
const summary = document.getElementById('summary');
const out = document.getElementById('results');
const passed = results.filter(r => r.status === 'ok').length;
const failed = results.filter(r => r.status === 'fail').length;
summary.textContent = `${passed} passed, ${failed} failed (of ${results.length})`;
summary.className = 'summary ' + (failed === 0 ? 'ok' : 'fail');
for (const r of results) {
  const div = document.createElement('div');
  div.className = r.status === 'ok' ? 'ok' : 'fail';
  div.innerHTML = `<strong>${r.status === 'ok' ? '✓' : '✗'} ${r.name}</strong>`;
  if (r.status === 'fail') {
    const pre = document.createElement('pre');
    pre.textContent = r.error;
    div.appendChild(pre);
  }
  out.appendChild(div);
}
