/* HTML parser — extracts lessons from the cw-editable mission preview format.
   Input: full HTML text.
   Output: array of Strapi lesson payload dicts.

   Strategy: parse with DOMParser, walk .lesson blocks, extract per-lesson
   title + screens, then convert each screen card to the canonical lesson-payload shape.
*/

import { parseMd } from './md.js';

const SCREEN_TAG_TO_TYPE = {
  'video script': 'information',
  'robot': 'information',
  'info': 'information',
  'opinion': 'practice-opinion',
  'knowledge': 'knowledge-mcq',           // bare "Knowledge" → MCQ
  'knowledge check': 'knowledge-mcq',
  'knowledge · case study': 'knowledge-mcq',
  'knowledge · mcq': 'knowledge-mcq',
  'knowledge · true/false': 'knowledge-tf',
  'true / false': 'knowledge-tf',
  'ai box': 'ai-box',
};

function slugify(s) {
  return s.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getScreenType(card) {
  const tagEl = card.querySelector('.screen-type-tag');
  if (!tagEl) return 'information';
  const raw = tagEl.textContent.toLowerCase().trim();
  for (const key of Object.keys(SCREEN_TAG_TO_TYPE)) {
    if (raw.includes(key)) return SCREEN_TAG_TO_TYPE[key];
  }
  return 'information';
}

function htmlToText(el) {
  if (!el) return '';
  // Convert basic inline formatting to markdown
  let html = el.innerHTML;
  html = html.replace(/<br\s*\/?>/gi, '\n');
  html = html.replace(/<\/?strong[^>]*>/gi, (m) => m.startsWith('</') ? '**' : '**');
  html = html.replace(/<\/?em[^>]*>/gi, (m) => m.startsWith('</') ? '_' : '_');
  html = html.replace(/<\/?i[^>]*>/gi, (m) => m.startsWith('</') ? '_' : '_');
  html = html.replace(/<\/?b[^>]*>/gi, (m) => m.startsWith('</') ? '**' : '**');
  html = html.replace(/<p[^>]*>/gi, '');
  html = html.replace(/<\/p>/gi, '\n\n');
  html = html.replace(/<div[^>]*>/gi, '');
  html = html.replace(/<\/div>/gi, '\n');
  // Strip remaining HTML tags
  html = html.replace(/<[^>]+>/g, '');
  // Decode common entities
  html = html.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  // Collapse 3+ blank lines
  html = html.replace(/\n{3,}/g, '\n\n');
  return html.trim();
}

function getOptionsFromList(listEl, hasCorrect) {
  if (!listEl) return [];
  const tiles = listEl.querySelectorAll('.option-tile, .mcq-tile');
  return Array.from(tiles).map(tile => {
    const labelEl = tile.querySelector('span.cw-editable, span:not(.option-radio)') || tile.querySelector('span');
    let label = labelEl ? labelEl.textContent.trim() : tile.textContent.trim();
    // Strip leading "A. " / "B. " etc.
    label = label.replace(/^[A-D]\.\s*/, '');
    const out = { label };
    if (hasCorrect) {
      out.is_correct = tile.classList.contains('correct') ||
                       !!tile.querySelector('.correct-dot, .option-radio.correct-dot, .mcq-radio.correct-dot');
    }
    return out;
  });
}

function inferCorrectFromExplanation(options, explanationText) {
  // Source pattern: "Correct: A." or "Correct: Option C."
  const m = explanationText.match(/Correct:\s*(?:Option\s+)?([A-D])\b/i);
  if (!m) return options;
  const idx = m[1].toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
  return options.map((o, i) => ({ ...o, is_correct: i === idx }));
}

function parseScreenCard(card) {
  const screenType = getScreenType(card);
  const headingEl = card.querySelector('.screen-heading');
  const subheadingEl = card.querySelector('.screen-subheading');
  const bodyEl = card.querySelector('.screen-body');
  const optionsEl = card.querySelector('.options-list, .mcq-tiles');
  const explanationEl = card.querySelector('.explanation-block');

  const screen = { __component: `screens.${screenType === 'information' ? 'information' :
                                  screenType === 'practice-opinion' ? 'practice-opinion' :
                                  screenType === 'knowledge-mcq' ? 'practice-knowledge-mcq' :
                                  screenType === 'knowledge-tf' ? 'practice-knowledge-tf' :
                                  screenType === 'knowledge-compare' ? 'practice-knowledge-compare' :
                                  'ai-box'}` };

  if (headingEl) screen.heading = headingEl.textContent.trim();
  if (subheadingEl && subheadingEl.textContent.trim()) screen.subheading = subheadingEl.textContent.trim();

  if (bodyEl) {
    const body = htmlToText(bodyEl);
    if (body) screen.rich_text_body = body;
  }

  if (screenType === 'practice-opinion') {
    screen.options = getOptionsFromList(optionsEl, false);
  } else if (['knowledge-mcq', 'knowledge-tf', 'knowledge-compare'].includes(screenType)) {
    let opts = getOptionsFromList(optionsEl, true);
    const explanation = explanationEl ? htmlToText(explanationEl) : '';
    // If no tile carries correct marker, infer from explanation text
    if (opts.length && !opts.some(o => o.is_correct) && explanation) {
      opts = inferCorrectFromExplanation(opts, explanation);
    }
    screen.options = opts;
    if (explanation) screen.explanation_block = explanation;
  } else if (screenType === 'ai-box') {
    const inputEl = card.querySelector('.aibox-input');
    if (inputEl) {
      screen.input_prefill = (inputEl.value || inputEl.textContent || '').trim();
    }
    screen.interaction_mode = 'submit';
  }

  return screen;
}

function parseLessonBlock(lessonEl) {
  const titleEl = lessonEl.querySelector('.lesson-title');
  const title = titleEl ? titleEl.textContent.trim() : 'Untitled';
  const slug = slugify(title);

  const screenCards = lessonEl.querySelectorAll('.screen-card');
  const screens = [];
  let congratsStatement = '';

  for (const card of screenCards) {
    // Skip system-congrats card — extract capability statement instead
    const tag = card.querySelector('.screen-type-tag');
    if (tag && tag.textContent.toLowerCase().includes('congrat')) {
      const stmt = card.querySelector('.congrats-statement');
      if (stmt) congratsStatement = stmt.textContent.trim();
      continue;
    }
    screens.push(parseScreenCard(card));
  }

  if (!congratsStatement) {
    // No system-congrats card → synthesize a placeholder
    congratsStatement = `You can complete the ${title} lesson.`;
  }

  return {
    title,
    slug,
    capability_statement: congratsStatement,
    screens,
  };
}

export function parseHtml(text) {
  const doc = new DOMParser().parseFromString(text, 'text/html');
  const lessonEls = doc.querySelectorAll('.lesson');
  if (!lessonEls.length) {
    throw new Error('No `.lesson` blocks found — check the HTML structure');
  }
  return Array.from(lessonEls).map(parseLessonBlock);
}
