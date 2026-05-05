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

import { parseMd } from '../js/parsers/md.js';

const SAMPLE_INFO_LESSON = `# Lesson: Test Lesson

> **Slug (suggested):** \`test-lesson\`

---

## Capability statement

You can run a basic parse-and-upload smoke test.

---

## Screen 1 — Information

**Heading:** Hello world

**Body:**

This is a test body.

It has two paragraphs.

---

## Screen 2 — Knowledge (True / False)

**Heading:** Is the sky blue?

**Subheading:** Tap the right one.

**Options** (exactly 2):

- True _(correct)_
- False

**Explanation:**

The sky scatters blue light.
`;

test('parseMd · single lesson with two screens', () => {
  const lessons = parseMd(SAMPLE_INFO_LESSON);
  assertEqual(lessons.length, 1);
  assertEqual(lessons[0].title, 'Test Lesson');
  assertEqual(lessons[0].slug, 'test-lesson');
  assertEqual(lessons[0].capability_statement, 'You can run a basic parse-and-upload smoke test.');
  assertEqual(lessons[0].screens.length, 2);
});

test('parseMd · screen 1 is Information with body', () => {
  const lessons = parseMd(SAMPLE_INFO_LESSON);
  const s = lessons[0].screens[0];
  assertEqual(s.__component, 'screens.information');
  assertEqual(s.heading, 'Hello world');
  assertTrue(s.rich_text_body.includes('two paragraphs'));
});

test('parseMd · screen 2 is T/F with correct option marked', () => {
  const lessons = parseMd(SAMPLE_INFO_LESSON);
  const s = lessons[0].screens[1];
  assertEqual(s.__component, 'screens.practice-knowledge-tf');
  assertEqual(s.options.length, 2);
  assertEqual(s.options[0], { label: 'True', is_correct: true });
  assertEqual(s.options[1], { label: 'False', is_correct: false });
  assertTrue(s.explanation_block.includes('scatters blue'));
});

test('parseMd · annotations stripped', () => {
  const txt = `# Lesson: A
> **Slug (suggested):** \`a\`
## Capability statement
A test.
## Screen 1 — Information
**Heading:** Test
**Body:**
Foo \`yoursel\` _[source typo — likely \`yourself\`]_.
`;
  const lessons = parseMd(txt);
  const body = lessons[0].screens[0].rich_text_body;
  assertTrue(!body.includes('source typo'), 'annotation should be stripped');
});

test('parseMd · multi-lesson', () => {
  const txt = SAMPLE_INFO_LESSON + '\n\n' + SAMPLE_INFO_LESSON.replace('Test Lesson', 'Second Lesson').replace('test-lesson', 'second-lesson');
  const lessons = parseMd(txt);
  assertEqual(lessons.length, 2);
  assertEqual(lessons[0].title, 'Test Lesson');
  assertEqual(lessons[1].title, 'Second Lesson');
});

import { parseHtml } from '../js/parsers/html.js';

const SAMPLE_HTML = `
<div class="lesson">
  <div class="lesson-header">
    <span class="lesson-title">Test HTML Lesson</span>
  </div>
  <div class="screens-grid">
    <div class="screen-card">
      <div class="screen-content">
        <span class="screen-type-tag tag-info">Info</span>
        <div class="heading-block"><div class="screen-heading">Hello HTML</div></div>
        <div class="screen-body"><p>HTML body text.</p></div>
      </div>
    </div>
    <div class="screen-card">
      <div class="screen-content">
        <span class="screen-type-tag tag-knowledge">Knowledge Check</span>
        <div class="heading-block">
          <div class="screen-heading">MCQ heading</div>
          <div class="screen-subheading">Pick one</div>
        </div>
        <div class="mcq-tiles">
          <div class="mcq-tile"><span>A. First</span></div>
          <div class="mcq-tile"><span>B. Second</span></div>
        </div>
        <div class="explanation-block"><strong>Correct: B.</strong> Because reasons.</div>
      </div>
    </div>
    <div class="screen-card">
      <span class="screen-type-tag tag-congrats">Congratulation · system · LESSON COMPLETE</span>
      <div class="congrats-card">
        <div class="congrats-statement">You can complete the test.</div>
      </div>
    </div>
  </div>
</div>
`;

test('parseHtml · single lesson', () => {
  const lessons = parseHtml(SAMPLE_HTML);
  assertEqual(lessons.length, 1);
  assertEqual(lessons[0].title, 'Test HTML Lesson');
  assertEqual(lessons[0].slug, 'test-html-lesson');
  assertEqual(lessons[0].capability_statement, 'You can complete the test.');
});

test('parseHtml · screens parsed with correct types', () => {
  const lessons = parseHtml(SAMPLE_HTML);
  assertEqual(lessons[0].screens.length, 2);
  assertEqual(lessons[0].screens[0].__component, 'screens.information');
  assertEqual(lessons[0].screens[1].__component, 'screens.practice-knowledge-mcq');
});

test('parseHtml · MCQ correct inferred from explanation', () => {
  const lessons = parseHtml(SAMPLE_HTML);
  const opts = lessons[0].screens[1].options;
  assertEqual(opts[0].is_correct, false);
  assertEqual(opts[1].is_correct, true);
});

test('parseHtml · throws on no lesson blocks', () => {
  let threw = false;
  try { parseHtml('<html><body><p>nothing here</p></body></html>'); }
  catch (e) { threw = true; }
  assertTrue(threw, 'expected throw on no .lesson blocks');
});

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
