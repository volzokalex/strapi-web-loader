/* Single source of truth for app state.
   Exposes token storage + simple state observer. */

const TOKEN_KEY = 'sqills.strapi.token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}
