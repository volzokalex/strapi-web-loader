import { parseMd } from './parsers/md.js';
import { parseHtml } from './parsers/html.js';
import { parsePdf } from './parsers/pdf.js';

const STRAPI_STRING_MAX = 255;

export async function parseFile(file) {
  const ext = file.name.toLowerCase().split('.').pop();
  if (!['md', 'txt', 'html', 'htm', 'pdf'].includes(ext)) {
    throw new Error(`Unsupported file type: .${ext}. Accepted: .md .txt .html .pdf`);
  }
  if (ext === 'pdf') {
    const buf = await file.arrayBuffer();
    return await parsePdf(buf);
  }
  const text = await file.text();
  if (ext === 'html' || ext === 'htm') return parseHtml(text);
  // .md and .txt both go through MD parser
  return parseMd(text);
}

export function applyMarker(lessons, marker) {
  if (!marker) return lessons;
  const slugSuffix = marker.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return lessons.map(l => ({
    ...l,
    title: `${l.title} — ${marker}`,
    slug: `${l.slug}-${slugSuffix}`,
  }));
}

export function validateLengths(lessons) {
  const errors = [];
  lessons.forEach((lesson, lIdx) => {
    if ((lesson.title || '').length > STRAPI_STRING_MAX) {
      errors.push(`Lesson ${lIdx + 1}: title is ${lesson.title.length} chars (max ${STRAPI_STRING_MAX})`);
    }
    if ((lesson.slug || '').length > STRAPI_STRING_MAX) {
      errors.push(`Lesson ${lIdx + 1}: slug is ${lesson.slug.length} chars (max ${STRAPI_STRING_MAX})`);
    }
    (lesson.screens || []).forEach((s, sIdx) => {
      if ((s.heading || '').length > STRAPI_STRING_MAX) {
        errors.push(`Lesson ${lIdx + 1}, Screen ${sIdx + 1}: heading is ${s.heading.length} chars (max ${STRAPI_STRING_MAX}). Move long content into body.`);
      }
      if ((s.subheading || '').length > STRAPI_STRING_MAX) {
        errors.push(`Lesson ${lIdx + 1}, Screen ${sIdx + 1}: subheading is ${s.subheading.length} chars (max ${STRAPI_STRING_MAX}).`);
      }
      (s.options || []).forEach((opt, oIdx) => {
        if ((opt.label || '').length > STRAPI_STRING_MAX) {
          errors.push(`Lesson ${lIdx + 1}, Screen ${sIdx + 1}, Option ${oIdx + 1}: label is ${opt.label.length} chars (max ${STRAPI_STRING_MAX}).`);
        }
      });
    });
  });
  return errors;
}
