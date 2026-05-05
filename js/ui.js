/* UI rendering helpers — all user-facing text in the result panel is in Ukrainian per spec. */

function statusIcon(status) { return status === 'ok' ? '✅' : '❌'; }

function ukrainianErrorReason(error) {
  if (!error) return 'Невідома помилка';
  if (error.status === 401 || error.status === 403) {
    return 'Токен недійсний — оновіть через Reset token у верхньому правому куті.';
  }
  if (error.status === 500) {
    return `Strapi помилка (HTTP 500): ${(error.body || '').slice(0, 200)}`;
  }
  if (error.status === 400) {
    return `Strapi відхилив запит (HTTP 400): ${(error.body || '').slice(0, 200)}`;
  }
  if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
    return 'Немає звʼязку зі Strapi — перевірте інтернет.';
  }
  return error.message || String(error);
}

function pluralUk(n) {
  // Plural rules for "урок"
  if (n === 1) return 'урок';
  if (n >= 2 && n <= 4) return 'уроки';
  return 'уроків';
}

function escape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderResult(results, container) {
  const ok = results.filter(r => r.status === 'ok');
  const fail = results.filter(r => r.status === 'fail');
  const total = results.length;
  let titleClass, titleText;

  if (fail.length === 0) {
    titleClass = 'result-panel__title--success';
    titleText = `✅ Завантаження успішне — ${ok.length} ${pluralUk(ok.length)}`;
  } else if (ok.length > 0) {
    titleClass = 'result-panel__title--partial';
    titleText = `⚠️ Частковий успіх: ${ok.length} з ${total} ${pluralUk(total)} завантажено`;
  } else {
    titleClass = 'result-panel__title--fail';
    titleText = `❌ Не вдалося завантажити`;
  }

  const items = results.map((r, i) => {
    if (r.status === 'ok') {
      const adminUrl = r.result.adminUrl;
      return `<li>${statusIcon('ok')} <strong>${escape(r.lesson.title)}</strong> — id <code>${r.result.id}</code> · <a href="${adminUrl}" target="_blank" rel="noopener">Open in admin</a></li>`;
    }
    return `<li>${statusIcon('fail')} <strong>${escape(r.lesson.title)}</strong> — ${escape(ukrainianErrorReason(r.error))}</li>`;
  }).join('');

  const hint = fail.length === 0
    ? 'Усі уроки створені як drafts. Перевірте у Strapi admin.'
    : ok.length > 0
      ? 'Виправте джерело для невдалих уроків та спробуйте ще раз.'
      : 'Перевірте токен / звʼязок та повторіть спробу.';

  container.innerHTML = `
    <h2 class="result-panel__title ${titleClass}">${titleText}</h2>
    <ol>${items}</ol>
    <p class="result-panel__hint">${hint}</p>
    <button type="button" id="upload-another" class="btn-primary result-panel__again">Upload another</button>
  `;
}
