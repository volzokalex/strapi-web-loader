/* PDF parser — extracts plain text via pdf.js, then routes through MD parser.
   Best effort: PDFs that don't carry our markdown conventions will fail at the MD layer
   with an informative error.
*/

import { parseMd } from './md.js';

let pdfjsLib = null;

async function loadPdfjs() {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import('../../vendor/pdf.min.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../../vendor/pdf.worker.min.mjs', import.meta.url).toString();
  return pdfjsLib;
}

export async function parsePdf(arrayBuffer) {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const text = tc.items.map(item => item.str).join(' ');
    pages.push(text);
  }
  const fullText = pages.join('\n\n');
  // Route through MD parser
  return parseMd(fullText);
}
