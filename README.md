# Strapi Sqills — web loader

A self-service tool for the Sqills team to drop a content file (MD / TXT / HTML / PDF) and upload its lessons to Strapi as drafts.

**Live:** https://volzokalex.github.io/strapi-web-loader/

## What it does

1. You paste your Strapi API token once (browser remembers it)
2. Drag a file (or click to pick) — `.md` / `.txt` / `.html` / `.pdf`
3. The tool parses lessons from the file (one or many per file)
4. Click **Send to Strapi** — every lesson is created as a draft
5. You see a Ukrainian result panel with per-lesson status + admin links

## Setup (per teammate, one-time)

1. Ask Alex for your Strapi API token (Custom-type, scoped to `lesson.find/findOne/create/delete` only, 90-day TTL)
2. Open https://volzokalex.github.io/strapi-web-loader/
3. Paste the token in the modal that appears, click Save
4. Done. The token is stored in your browser's `localStorage` — never sent anywhere except Strapi itself

## Daily use

- **Drop file** → see parse summary
- **Optional:** type a marker in the top bar (e.g. your initials) — gets appended to title and slug for traceability
- **Click Send to Strapi** — wait a few seconds while uploads run
- **Result panel:** Ukrainian summary with per-lesson `id`, `documentId`, and admin link

## Troubleshooting

| Problem | Fix |
|---|---|
| Modal doesn't go away after pasting | Token field empty or invalid — paste a real token |
| "Pre-check failed" with heading >255 chars | The source has a long heading — shorten it or move content into body |
| Result shows "Токен недійсний" | Token expired or revoked — click **Reset token** top-right, paste a new one |
| Result shows "Немає звʼязку" | Network is down or Strapi is unreachable — check internet, retry later |
| PDF parse fails | PDF format may be too complex — copy the text into a `.txt` file and try again |

## Limitations (MVP)

- **No mission slotting** — uploaded lessons aren't slotted into a Strapi mission. Slot them manually in Strapi admin under the relevant Mission entry's `lesson_slots`.
- **Drafts only** — uploads always go in as drafts. Publish them manually in Strapi admin after review.
- **PDF best-effort** — complex layouts (tables, multi-column) may parse imperfectly. Falls back to plain text per page.
- **One file at a time** — drop a single file. Multi-file batching not in MVP.

## For developers

- Source: vanilla HTML / CSS / ES2020 modules, no build step
- Parsers: `js/parsers/{md,html,pdf}.js` — MD parser ported from `tech/strapi/content-loader/upload_lesson.py` in the parent Sqills repo
- Tests: open `tests/index.html` in a browser; runner is browser-based, no Node needed
- Deploy: push to `main`, GitHub Pages updates in ~30 sec

## Spec

Full design at [`design.md`](./design.md). Token scope, error handling, button states, DS tokens, result-panel format — all there.
