import { getToken, setToken, clearToken } from './state.js';
import { parseFile, applyMarker, validateLengths } from './parser.js';
import { uploadAll } from './strapi.js';
import { renderResult } from './ui.js';

const modal = document.getElementById('token-modal');
const input = document.getElementById('token-input');
const error = document.getElementById('token-error');
const saveBtn = document.getElementById('token-save');
const resetBtn = document.getElementById('reset-token');

function showModal() {
  input.value = '';
  error.hidden = true;
  modal.hidden = false;
  setTimeout(() => input.focus(), 0);
}

function hideModal() { modal.hidden = true; }

saveBtn.addEventListener('click', () => {
  const value = input.value.trim();
  if (!value) {
    error.textContent = 'Please paste a token.';
    error.hidden = false;
    return;
  }
  setToken(value);
  hideModal();
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveBtn.click();
});

resetBtn.addEventListener('click', () => {
  if (confirm('Clear stored Strapi token?')) {
    clearToken();
    showModal();
  }
});

// On load, if no token, prompt
if (!getToken()) showModal();

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const summary = document.getElementById('parse-summary');
const markerInput = document.getElementById('marker');

let parsedLessons = null;

const sendBtn = document.getElementById('send-btn');
const sendLabel = document.getElementById('send-label');
const sendIcon = document.getElementById('send-icon');
const sendSpinner = document.getElementById('send-spinner');

function activateSend(active) {
  sendBtn.disabled = !active;
  sendBtn.classList.toggle('btn-primary--inactive', !active);
}

['dragenter', 'dragover'].forEach(ev =>
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.add('dropzone--hover');
  })
);
['dragleave', 'drop'].forEach(ev =>
  dropzone.addEventListener(ev, () => dropzone.classList.remove('dropzone--hover'))
);

dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) handleFile(file);
});

async function handleFile(file) {
  dropzone.classList.add('dropzone--filled');
  summary.hidden = false;
  summary.classList.remove('parse-summary--error');
  summary.innerHTML = `Reading <strong>${escapeHtml(file.name)}</strong>…`;
  try {
    let lessons = await parseFile(file);
    const marker = markerInput.value.trim();
    lessons = applyMarker(lessons, marker);
    const errors = validateLengths(lessons);
    if (errors.length) {
      summary.classList.add('parse-summary--error');
      summary.innerHTML = `<strong>Pre-check failed</strong><ul>${errors.map(e => `<li>${escapeHtml(e)}</li>`).join('')}</ul>`;
      parsedLessons = null;
      activateSend(false);
      return;
    }
    parsedLessons = lessons;
    const totalScreens = lessons.reduce((acc, l) => acc + (l.screens?.length || 0), 0);
    summary.innerHTML = `
      ✓ Distilled <strong>${lessons.length}</strong> lesson${lessons.length === 1 ? '' : 's'},
      <strong>${totalScreens}</strong> screen${totalScreens === 1 ? '' : 's'} total<br>
      ✓ Length pre-check: passed${marker ? `<br>✓ Marker: <code>${escapeHtml(marker)}</code>` : ''}
    `;
  } catch (e) {
    summary.classList.add('parse-summary--error');
    summary.innerHTML = `<strong>Parse failed:</strong> ${escapeHtml(e.message)}`;
    parsedLessons = null;
  }
  activateSend(!!parsedLessons);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

sendBtn.addEventListener('click', async () => {
  if (!parsedLessons) return;
  // Loading state
  sendBtn.disabled = true;
  sendLabel.textContent = 'Magic…';
  sendIcon.hidden = false;
  sendSpinner.hidden = false;

  const token = getToken();
  const results = await uploadAll(parsedLessons, token);

  // Hide drop UI, show result panel
  const result = document.getElementById('result-panel');
  dropzone.hidden = true;
  summary.hidden = true;
  sendBtn.hidden = true;
  result.hidden = false;
  renderResult(results, result);

  // Wire "Upload another" button (added by renderResult)
  document.getElementById('upload-another').addEventListener('click', () => {
    parsedLessons = null;
    fileInput.value = '';
    dropzone.classList.remove('dropzone--filled');
    summary.innerHTML = '';
    summary.hidden = true;
    result.hidden = true;
    dropzone.hidden = false;
    sendBtn.hidden = false;
    sendLabel.textContent = 'Send to Strapi';
    sendIcon.hidden = true;
    sendSpinner.hidden = true;
    activateSend(false);
  });
});
