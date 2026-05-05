import { getToken, setToken, clearToken } from './state.js';

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

function handleFile(file) {
  // Stub — parser wires up in later tasks
  console.log('handleFile:', file.name, file.size, file.type);
  dropzone.classList.add('dropzone--filled');
}
