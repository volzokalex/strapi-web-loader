# Strapi Web Loader — Design Spec

> **Status:** draft, awaiting Alex review
> **Date:** 2026-05-05
> **Owner:** Alex (CEO) + content team
> **Spec lives at:** `tech/strapi/web-loader/design.md`
> **Related:** `tech/strapi/content-loader/upload_lesson.py` (Python reference parser, mirrored to JS)

---

## 1. Problem

Alex's team — content manager(s) plus Alex — needs a self-service way to upload lesson content to Strapi (`content.shidev.cc`) without running a Python script in a terminal. Source files vary in shape: raw `.md`, `.txt`, `.html` (often whole-mission files with multiple lessons), and `.pdf`. Current flow is Alex pasting source into Claude → Claude parses → Python script POSTs. The team needs a browser tool that performs the same parse + upload in one click.

## 2. Goals & non-goals

**In scope (MVP):**
- Drag-and-drop or click-to-pick a single file
- Accept `.md`, `.txt`, `.html`, `.pdf`
- Detect 1+ lessons in the file, parse all
- Pre-validate against Strapi `string` 255-char limit
- POST each parsed lesson to Strapi as a draft
- Result panel in **Ukrainian** with per-lesson success/failure status
- Hosted on Alex's GitHub (Pages) — no backend, no third-party host
- UI in **English**, visual style anchored in Sqills DS v1
- Multi-user via individual Strapi API tokens (each teammate pastes own token, stored in `localStorage`)

**Out of scope (MVP, possible later):**
- Mission slotting — requires `mission.update` permission not on the team's tokens
- Lesson update — current write-tokens are scoped to `lesson.find/findOne/create/delete` only
- Batch select (UI to pick which lessons to upload from a multi-lesson file)
- Login via Strapi user JWT (instead of API token paste)
- History of past uploads inside the app
- Image/media upload to Strapi
- Mobile layout (desktop browser only)

## 3. Architecture

```
GitHub Pages (volzokalex/strapi-web-loader)
  ├── index.html     ← drop zone + button + result panel
  ├── styles.css     ← Sqills DS tokens, hand-translated
  ├── app.js         ← parser + state machine + upload (~400-500 LOC)
  └── vendor/
      └── pdf.min.js ← Mozilla pdf.js, vendored
                ↓
                fetch POST + Bearer token
                ↓
        content.shidev.cc/api/lessons?status=draft&locale=en
```

- **No backend.** Strapi token lives in `localStorage` of each teammate's browser, scoped per-user. Cleared via "Reset token" link.
- **No build step.** Vanilla HTML/CSS/JS, pdf.js vendored. Push to `main` → GitHub Pages updates in ~30 s.
- **Token security trade-off.** Custom Strapi API tokens, scoped to `lesson.find/findOne/create/delete` only — cannot touch missions, users, uploads, or schemas. If a teammate's machine is compromised, the blast radius is "create draft lessons in Strapi" (already manually reviewed before publish). Tokens rotate via Strapi admin if needed.

## 4. UI / interaction

### 4.1 Layout

Centered single-column, max-width ~720 px on a `surface/canvas` (warm white) background. Single-task flow — no nav, no other surfaces.

```
┌──────────────────────────────────────────────────────────────┐
│  Strapi Sqills                  marker: [_____]   reset key  │  ← top bar
├──────────────────────────────────────────────────────────────┤
│                                                              │
│      ┌────────────────────────────────────────────────┐      │
│      │                                                │      │
│      │       [icon]  Drop file or click to browse     │      │
│      │              .md  ·  .txt  ·  .html  ·  .pdf   │      │
│      │                                                │      │
│      └────────────────────────────────────────────────┘      │
│                                                              │
│      [parse-summary panel — appears after drop]              │
│                                                              │
│              ┌──────────────────────────┐                    │
│              │     Send to Strapi       │  ← Button/Primary  │
│              └──────────────────────────┘                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 Components & DS tokens

| UI element | Sqills DS reference | Notes |
|---|---|---|
| Page background | `surface/canvas` | Warm white, never pure white |
| Top bar | `surface/default` + `border/subtle` bottom hairline | Single-line chrome |
| Logo / app title | `Display/Small` (Manrope 20 / w700) | "Strapi Sqills" |
| Marker input | `Text field` at `radius/field` | Placeholder "marker (optional)", `UI/SM` |
| Reset token link | `Button / Ghost` style, `CTA/Ghost` typography | Right-aligned, low-emphasis. Click → confirm dialog → clears `localStorage.token` only (marker input is per-session, not stored). Returns to token modal. |
| Drop zone | Dashed `border/default`, `radius/interactive`, `surface/subtle` fill on hover/drag-over (`border/brand` accent) | Large central target |
| Drop zone copy | `UI/Base` for primary line, `UI/SM` + `text/tertiary` for accepted-types line | |
| Parse summary | `Static Card` pattern (`surface/subtle`, `radius/interactive`, no border) | Contains list of validations |
| Send button | `Button / Primary` — `surface/brand` fill, `text/inverse` label, `radius/interactive`, `Shadow/Stack/CTA` (6 px slab + warm bloom inset) | Sentence case "Send to Strapi" |
| Loading state | Same button + inline `Loader` (24px) + `Icon/sparkles` glyph + label "Magic…" | Sparkles is the canonical AI-moment glyph |
| Result panel | `Static Card` replacing drop zone | Per-lesson rows with status icon + admin link |
| Token modal | `Modal` shell (`Shadow/Elevation/LG`, dimmed backdrop) + `Close Button` + `Text field` + `Button / Primary` | First-visit gate |
| Error indicators | `text-accent/error` for inline errors, `Alert` component for blocking errors | |

### 4.3 Button states

Per Alex's spec — the orange button has 3 states:

| State | When | Visual | Label |
|---|---|---|---|
| **Inactive** | No file dropped, OR pre-check failed | `surface/muted` fill, `text/tertiary` label, no shadow, cursor `not-allowed` | `Send to Strapi` |
| **Active** | File parsed successfully, pre-check passed | `surface/brand` fill, `text/inverse` label, `Shadow/Stack/CTA` (6 px slab + bloom) | `Send to Strapi` |
| **Loading** | Click pressed, upload in progress | `surface/brand` fill, `text/inverse` label, `Shadow/Stack/CTA Pressed` (1–2 px slab — already-pressed feel), inline `Loader` (24px) + `Icon/sparkles` glyph | `Magic…` |

Press transition ≈ 90 ms ease per DS motion conventions.

### 4.4 State machine

```
[init]
  │
  ├── localStorage.token == null  ──→  [token-gate]
  │                                          │
  │                                          ▼
  │                                  Show token modal
  │                                  User pastes + Save
  │                                  Save to localStorage
  │                                          │
  ▼                                          ▼
[idle]  ←──────────────────────────────────────
  │
  │ user drops file or clicks to browse
  ▼
[parsing]
  │  detect file type by extension
  │  read text via FileReader (PDF: pdf.js)
  │  parse → array of lesson payloads
  │  apply marker (if entered in top bar)
  │  run length pre-check (255-char limit)
  │
  ├── parse failed OR pre-check failed  ──→  show errors in parse-summary, button stays inactive  ──→  [idle]
  │
  ├── parse OK  ──→  show parse-summary with counts, activate button  ──→  [ready]
  │
  ▼
[ready]
  │ user clicks "Send to Strapi"
  ▼
[uploading]
  │  button shows "Magic…" + spinner, drop zone disabled
  │  for each lesson in payload[]:
  │     POST /api/lessons?status=draft&locale=en
  │     headers: Authorization: Bearer <token>, User-Agent: sqills-web-loader/0.1
  │  collect successes + failures
  ▼
[result]
  │  result panel replaces drop zone
  │  Ukrainian copy with per-lesson status
  │  "Upload another" button → reset → [idle]
```

### 4.5 Result message (Ukrainian)

**Full success (all lessons uploaded):**
```
✅ Завантаження успішне — N уроків

1. <title> — id <id>  ·  Open in admin (`https://content.shidev.cc/admin/content-manager/collection-types/api::lesson.lesson/<documentId>`)
2. <title> — id <id>  ·  Open in admin (`https://content.shidev.cc/admin/content-manager/collection-types/api::lesson.lesson/<documentId>`)
   …

Усі уроки створені як drafts. Перевірте у Strapi admin.

[Upload another]
```

**Partial success:**
```
⚠️ Частковий успіх: M з N уроків завантажено

1. <title> — id <id>  ✅  Open in admin (`https://content.shidev.cc/admin/content-manager/collection-types/api::lesson.lesson/<documentId>`)
2. <title> — ❌ <error reason in plain Ukrainian>
3. <title> — id <id>  ✅  Open in admin (`https://content.shidev.cc/admin/content-manager/collection-types/api::lesson.lesson/<documentId>`)
   …

Виправте джерело для невдалих уроків та спробуйте ще раз.

[Upload another]
```

**Full failure (e.g., bad token, network down):**
```
❌ Не вдалося завантажити

<error reason in plain Ukrainian + what to do>

For example:
  - "Токен недійсний — оновіть через Reset token у верхньому правому куті"
  - "Немає звʼязку зі Strapi — перевірте інтернет"
  - "Strapi повернув HTTP 500 — спробуйте ще раз через хвилину"

[Upload another]
```

### 4.6 Marker handling

Optional input on top bar, default empty. If non-empty, suffix `— <marker>` appended to title and `-<slugified-marker>` to slug — same logic as `upload_lesson.py --marker`. **In batch uploads (multi-lesson files), the same marker applies to every lesson in that batch.** Not persisted between sessions (clean each visit). Use cases:

- Alex enters `volzok-test` for his own draft uploads
- Content manager leaves empty for production uploads
- Anyone enters `cm-draft` / `qa-test` / etc. for their own scoped marker

## 5. Parser (JS, mirrored from Python)

The current Python parser (`upload_lesson.py`) handles:

1. **MD section parsing** — `## Screen N — Type` → component UID; `**Heading:**` / `**Subheading:**` / `**Body:**` / `**Options**` / `**Explanation:**` → fields
2. **Screen type normalization** — Information / Practice (Opinion) / Knowledge (T/F | MCQ | Comparison) / AI Box, with fallbacks for "Knowledge Check", "Case Study", "Video Script", "Robot"
3. **Annotation stripping** — `_[parser-meta]_` (e.g., `_(correct)_`, `_[manual upload]_`) regex-stripped before send
4. **Whitespace cleanup** — collapse runs of spaces (preserve newlines), trim trailing spaces, collapse 3+ blank lines to 2
5. **Length pre-check** — `string` fields capped at 255 chars (Strapi default), pre-validate before POST
6. **Marker application** — append `— <marker>` to title, `-<slug-marker>` to slug

JS port keeps identical logic. Same regex patterns. Same component UID map. Same screen-type normalizer. Tests are sample files in `samples/` — JS output JSON should match Python output JSON byte-for-byte for the same input.

**Source-format converters** (input → MD-form intermediate):

- `.md` / `.txt`: as-is (already in canonical form, or `.txt` is just plain MD without front-matter)
- `.html`: `DOMParser` → walk DOM → emit MD form. Selectors mirror the cw-editable HTML pattern Alex's content team uses (`<div class="lesson">`, `<h2 class="lesson-title">`, `<div class="screen-card">`, `<span class="screen-type-tag tag-*">`, etc.)
- `.pdf`: `pdf.js` → extract text per page → heuristic split into lessons → MD form. Robust on simple PDFs; on complex layouts (multi-column, tables, scanned), parser may produce noise — surface as warning in parse-summary.

## 6. Error handling

| Failure | Where caught | User-facing message (English in UI, Ukrainian in result panel) |
|---|---|---|
| No token in localStorage | `init` | Token modal shown, no error message needed |
| Wrong file type dropped | `onDrop` | Inline notice on drop zone: "Only .md, .txt, .html, .pdf are supported" |
| Token modal save with empty input | Modal save handler | Inline: "Please paste your Strapi API token" |
| PDF can't be parsed (encrypted, scanned-only image) | pdf.js error handler | Parse summary: "Couldn't read PDF — try copy-paste into a .txt file" |
| HTML has no detectable lesson structure | parser | Parse summary: "No lessons detected — check that the file contains `.lesson` blocks" |
| Length pre-check fails | parser | Parse summary lists each violation: "Lesson 3, Screen 8: heading is 276 chars (max 255). Move long content into body." Button stays inactive. |
| Strapi 401 / 403 | upload step, on first failed POST | Result panel: "❌ Токен недійсний — оновіть через Reset token" |
| Strapi 500 on a single lesson | upload step | Continue with remaining lessons; mark this one as failed in result panel with returned error message |
| Cloudflare 1010 | upload step | Result panel: "❌ Cloudflare заблокував запит" — with note that User-Agent header is set; if persists, contact Alex |
| Network error / fetch reject | upload step | Result panel: "❌ Немає звʼязку зі Strapi — перевірте інтернет" |
| Slug collision (Strapi rejects with 400 due to duplicate uid) | upload step | Per-lesson failure with reason: "Slug already exists in Strapi. Add a marker or rename the lesson." |

All upload errors during the loop are non-fatal — every lesson POST is independent, and the result panel shows the full breakdown.

## 7. File structure

```
volzokalex/strapi-web-loader/
├── README.md                 ← what this is, deploy instructions, FAQ for non-technical users
├── index.html                ← single-page UI
├── styles.css                ← DS-token-translated CSS variables + component styles
├── app.js                    ← parser (~250 LOC) + state machine (~150 LOC) + upload (~50 LOC)
├── vendor/
│   └── pdf.min.js            ← Mozilla pdf.js, pinned to a known-good version
├── samples/                  ← test files for manual smoke-testing
│   ├── m6-lesson-1-where-you-are-on-the-map.md
│   ├── Mission_7_Real_Ways_to_Earn.html
│   └── single-lesson.txt
├── design.md                 ← copy of this spec, lives in the deployable repo for context
└── .gitignore                ← node_modules ignored just in case, .DS_Store
```

**Note on `design.md`:** the canonical spec lives here in `tech/strapi/web-loader/design.md` (in Sqills repo). A copy ships in the deployable repo so anyone reading the GitHub repo has full context without cross-repo lookups.

## 8. Deploy & rollout

1. **Repo creation:** Alex creates `volzokalex/strapi-web-loader` (public, GitHub Pages enabled from `main` root)
2. **First deploy:** push the implementation; Pages serves at `volzokalex.github.io/strapi-web-loader/`
3. **Optional custom domain:** CNAME `loader.shidev.cc` → `volzokalex.github.io`, set in repo Settings → Pages → Custom domain
4. **Token issuance:** Alex generates a Custom-type Strapi API token per teammate (incl. himself) with `lesson.find/findOne/create/delete` only, valid 30 days
5. **Onboarding the team:** each teammate gets the URL + their token, pastes once, browser remembers
6. **Smoke test:** drop sample MD from `samples/`, verify draft created in Strapi admin, confirm marker applied if entered
7. **Production use:** team uploads real content; Alex reviews drafts and publishes manually in Strapi admin

## 9. Testing approach

Manual for MVP (no CI for this repo):

- **Smoke test checklist** in `README.md` — clean-browser test: paste token → drop sample MD → verify result panel → check Strapi admin
- **Sample files** in `samples/` — same files Alex's team has actually used, so JS parser output can be compared against Python parser output (which has been verified through the manual `m1` / `m3` / `m3c` / `m4` / `m4c` / `m5c` / `m6` / `m7` upload runs — known-good outputs)
- **Per-format check:** at minimum 1 sample of each accepted file type (`.md`, `.txt`, `.html`, `.pdf`) tested before each release
- **Cross-browser sanity:** Chrome + Safari (most likely teammate browsers) before release. Firefox aspirational.

CI / unit tests can be added later if the parser becomes complex enough to need them. For MVP, manual smoke is sufficient.

## 10. Open questions resolved (2026-05-05)

1. **Repo name:** `strapi-web-loader` ✅
2. **URL:** `volzokalex.github.io/strapi-web-loader/`, no custom domain ✅
3. **UI title (top bar):** `Strapi Sqills` ✅
4. **Sparkles glyph in loading state:** `Icon/sparkles` from §3 of DS — confirmed
5. **Token TTL:** 90 days (default) — balances rotation hygiene with convenience for an internal team. Tokens are custom-scoped to `lesson.*` only, so blast radius on leak is "create draft lessons" (no mission/user/upload access).

## 11. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Token leak via teammate's compromised browser | Low (per-machine) | Medium (draft creates + deletes only, no production data touched) | Custom token scope, manual rotation, audit Strapi admin for unexpected drafts |
| PDF parsing fails on complex layouts | Medium | Low (parse-summary surfaces noise, user can copy-paste into `.txt` instead) | Document the workaround in README; PDF is "best effort" |
| Strapi 255-char string limit changes (Strapi schema migration) | Low | Medium (false-positive pre-check, valid uploads blocked) | Pre-check is a soft warning; if it fires, user can override or rename and retry |
| GitHub Pages outage | Very low | High (tool unavailable) | Acceptable for an internal tool; mitigation = `git clone` + open `index.html` locally |
| New screen type appears in source content | Medium (content evolves) | Low (parser throws unknown-type error, easy fix) | Parser maintenance — when it happens, update the screen-type normalizer in `app.js` (5-line change) |

## 12. Definition of done

The MVP is shipped when:

- ✅ `volzokalex/strapi-web-loader` repo exists, public, GitHub Pages enabled
- ✅ A teammate (not Alex) can: open the URL → paste a token → drop a `Mission_X.html` file → click button → see Ukrainian result panel showing N drafts created
- ✅ Created drafts visible in Strapi admin with correct titles, slugs, screens, options, capability statements
- ✅ Marker applied correctly when entered (verified by inspecting an admin entry's title/slug)
- ✅ Reset-token flow works (clears localStorage, modal returns)
- ✅ All four file types tested with sample inputs from `samples/`
- ✅ README explains setup, daily use, and reset
