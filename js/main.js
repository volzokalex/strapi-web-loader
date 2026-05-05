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
