/* MD parser — port of upload_lesson.py.
   Input: full markdown text (possibly multi-lesson, separated by `---` between top-level `# Lesson:` blocks).
   Output: array of Strapi lesson payload dicts (without the enclosing `data` wrapper).

   Single-lesson input returns array of length 1.
   Multi-lesson input is detected by multiple `# Lesson:` headings.
*/

const SCREEN_TYPE_TO_UID = {
  'information': 'screens.information',
  'practice-opinion': 'screens.practice-opinion',
  'knowledge-mcq': 'screens.practice-knowledge-mcq',
  'knowledge-tf': 'screens.practice-knowledge-tf',
  'knowledge-compare': 'screens.practice-knowledge-compare',
  'ai-box': 'screens.ai-box',
};

function normaliseScreenType(label) {
  const s = label.toLowerCase();
  if (s.includes('ai box') || s.includes('ai-box') || s.includes('aibox')) return 'ai-box';
  if (s.includes('comparison') || s.includes('compare')) return 'knowledge-compare';
  if (s.includes('true') || s.includes('t/f') || s.includes(' tf') || s.includes('(tf)')) return 'knowledge-tf';
  if (s.includes('mcq') || s.includes('multiple') || s.includes('case study') || s.includes('knowledge')) return 'knowledge-mcq';
  if (s.includes('opinion')) return 'practice-opinion';
  if (s.includes('information') || s.includes('info')) return 'information';
  throw new Error(`Unknown screen type label: ${JSON.stringify(label)}`);
}

function cleanInlineAnnotations(text) {
  if (!text) return '';
  // Strip _[parser-meta]_ markers
  text = text.replace(/\s*_\[[^\]]*\]_\s*/g, ' ');
  // Collapse runs of spaces/tabs (preserve newlines)
  text = text.replace(/[ \t]+/g, ' ');
  // Trim trailing whitespace per line
  text = text.split('\n').map(line => line.replace(/\s+$/, '')).join('\n');
  // Collapse 3+ blank lines
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

function trimBlankEdges(lines) {
  const out = [...lines];
  while (out.length && !out[0].trim()) out.shift();
  while (out.length && !out[out.length - 1].trim()) out.pop();
  return out;
}

function parseOptionLine(raw, hasCorrect) {
  let s = raw.trim();
  let isCorrect = false;
  const m = s.match(/^(.+?)\s*[_*]*\(\s*correct\s*\)[_*]*\s*$/i);
  if (m) {
    s = m[1].trim();
    isCorrect = true;
  }
  s = s.replace(/^\*\*(.+?)\*\*$/, '$1').trim();
  s = s.replace(/^_(.+?)_$/, '$1').trim();
  const out = { label: s };
  if (hasCorrect) out.is_correct = isCorrect;
  return out;
}

function splitIntoSections(lines) {
  const sections = [];
  let current = null;
  for (const line of lines) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) {
      current = { heading: m[1].trim(), lines: [] };
      sections.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }
  return sections;
}

function extractTitle(lines) {
  for (const line of lines) {
    const m = line.match(/^#\s+Lesson:\s*(.+?)\s*$/);
    if (m) return m[1].trim();
  }
  return null;
}

function extractSlug(lines) {
  for (const line of lines) {
    const m = line.match(/^>\s*\*\*Slug \(suggested\):\*\*\s*`?([A-Za-z0-9\-]+)`?\s*$/);
    if (m) return m[1].trim();
  }
  return null;
}

function parseScreen(screenType, bodyLines) {
  const fields = {
    heading: null,
    subheading: null,
    body_lines: [],
    options_lines: [],
    explanation_lines: [],
    interaction_mode: null,
    input_prefill: null,
  };
  let state = null;

  for (const raw of bodyLines) {
    const stripped = raw.trim();
    if (stripped === '---') { state = null; continue; }

    let m = stripped.match(/^\*\*([A-Za-z][A-Za-z _\-/]+?):\*\*\s*(.*)$/);
    if (m) {
      const name = m[1].trim().toLowerCase().replace(/[ \-]/g, '_');
      const content = m[2].trim();
      if (name === 'heading') { fields.heading = content; state = null; }
      else if (name === 'subheading') { fields.subheading = content; state = null; }
      else if (name === 'image') { state = null; }
      else if (name === 'body') { state = 'body'; if (content) fields.body_lines.push(content); }
      else if (name === 'explanation') { state = 'explanation'; if (content) fields.explanation_lines.push(content); }
      else if (name === 'input_prefill') { fields.input_prefill = content; state = null; }
      else if (name === 'interaction_mode' || name === 'mode') { fields.interaction_mode = content; state = null; }
      else { state = null; }
      continue;
    }

    if (/^\*\*Options\*\*.*?:\s*$/.test(stripped) || /^\*\*Options:\*\*\s*$/.test(stripped)) {
      state = 'options';
      continue;
    }

    if (state === 'body') fields.body_lines.push(raw);
    else if (state === 'explanation') fields.explanation_lines.push(raw);
    else if (state === 'options') {
      const mo = stripped.match(/^-\s+(.+)$/);
      if (mo) fields.options_lines.push(mo[1]);
    }
  }

  return assembleScreen(screenType, fields);
}

function assembleScreen(screenType, fields) {
  const uid = SCREEN_TYPE_TO_UID[screenType];
  const out = { __component: uid };
  if (fields.heading) out.heading = fields.heading;
  if (fields.subheading) out.subheading = fields.subheading;

  const bodyText = cleanInlineAnnotations(trimBlankEdges(fields.body_lines).join('\n'));
  if (bodyText) out.rich_text_body = bodyText;

  const explanationText = cleanInlineAnnotations(trimBlankEdges(fields.explanation_lines).join('\n'));

  if (screenType === 'information') {
    /* nothing more */
  } else if (screenType === 'practice-opinion') {
    out.options = fields.options_lines.map(o => parseOptionLine(o, false));
  } else if (['knowledge-mcq', 'knowledge-tf', 'knowledge-compare'].includes(screenType)) {
    out.options = fields.options_lines.map(o => parseOptionLine(o, true));
    if (explanationText) out.explanation_block = explanationText;
  } else if (screenType === 'ai-box') {
    if (fields.input_prefill) out.input_prefill = fields.input_prefill;
    if (fields.interaction_mode) out.interaction_mode = fields.interaction_mode;
  }
  return out;
}

function parseSingleLesson(text) {
  const lines = text.split('\n');
  const title = extractTitle(lines);
  const slug = extractSlug(lines);
  const sections = splitIntoSections(lines);

  let capability = '';
  const screens = [];

  for (const s of sections) {
    let body = trimBlankEdges(s.lines);
    if (body.length && body[0].trim() === '---') body = body.slice(1);
    if (body.length && body[body.length - 1].trim() === '---') body = body.slice(0, -1);

    if (s.heading.toLowerCase().startsWith('capability')) {
      capability = cleanInlineAnnotations(body.join('\n'));
      continue;
    }
    const m = s.heading.match(/^Screen\s+(\d+)\s*[—\-–]\s*(.+?)\s*$/);
    if (m) {
      const stype = normaliseScreenType(m[2].trim());
      screens.push(parseScreen(stype, body));
    }
  }

  if (!title) throw new Error('Lesson title is empty');
  if (!slug) throw new Error("Slug not found in frontmatter (expected '> **Slug (suggested):** `…`')");
  if (!capability) throw new Error('Capability statement section is empty');
  if (!screens.length) throw new Error('No screens parsed');

  return { title, slug, capability_statement: capability, screens };
}

export function parseMd(text) {
  // Detect multi-lesson by counting top-level `# Lesson:` headings
  const lessonStarts = [...text.matchAll(/^#\s+Lesson:/gm)].map(m => m.index);
  if (lessonStarts.length <= 1) {
    return [parseSingleLesson(text)];
  }
  // Split text by lesson boundaries
  const lessons = [];
  for (let i = 0; i < lessonStarts.length; i++) {
    const start = lessonStarts[i];
    const end = i + 1 < lessonStarts.length ? lessonStarts[i + 1] : text.length;
    const chunk = text.substring(start, end);
    lessons.push(parseSingleLesson(chunk));
  }
  return lessons;
}
