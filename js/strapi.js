const STRAPI_BASE = 'https://content.shidev.cc';
const ENDPOINT = '/api/lessons?status=draft&locale=en';

export async function uploadLesson(payload, token) {
  const res = await fetch(STRAPI_BASE + ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ data: payload }),
  });
  if (!res.ok) {
    let bodyText = '';
    try { bodyText = await res.text(); } catch {}
    const err = new Error(`HTTP ${res.status} ${res.statusText}`);
    err.status = res.status;
    err.body = bodyText;
    throw err;
  }
  const json = await res.json();
  return {
    id: json.data?.id,
    documentId: json.data?.documentId,
    title: json.data?.title,
    publishedAt: json.data?.publishedAt,
    adminUrl: `${STRAPI_BASE}/admin/content-manager/collection-types/api::lesson.lesson/${json.data?.documentId}`,
  };
}

export async function uploadAll(lessons, token) {
  const results = [];
  for (const lesson of lessons) {
    try {
      const r = await uploadLesson(lesson, token);
      results.push({ status: 'ok', lesson, result: r });
    } catch (e) {
      results.push({ status: 'fail', lesson, error: e });
    }
  }
  return results;
}
