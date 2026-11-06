# AGENTS.md — Root Project Router

> Universal project map and operational contract for AI agents.

## 1. Tech Stack & Major Versions
- **Platform:** Google Chrome Browser Extension (Manifest V3)
- **Language / Runtime:** Vanilla ECMAScript 2022+ / Native Web APIs (Canvas, DOM, Storage, Clipboard)
- **Styling:** Vanilla CSS3 (declarative root-attribute selectors, scoped styling)
- **Storage:** `chrome.storage.sync` & `chrome.storage.local`
- **Build System:** Zero-build / No bundler needed (loaded directly as unpacked extension)

## 2. Mandatory Verification Protocol
- **Syntax Check:** `node --check content/content.js; node --check popup/popup.js`
- **Manifest Lint:** Mechanical JSON validation (`Get-Content manifest.json | ConvertFrom-Json`)
- **Live Chrome DevTools Audit:** Load unpacked via `chrome://extensions`, verify zero console errors on `youtube.com`.

## 3. High-Level Directory Map
- `manifest.json` — Chrome MV3 Extension manifest & permissions contract
- `content/` — Content scripts (`content.js`, `styles.css`) for YouTube DOM injection
- `popup/` — Extension settings menu (`popup.html`, `popup.css`, `popup.js`)
- `icons/` — Extension iconography (16px, 48px, 128px)
- `tests/` — Automated test scripts / reproduction assertions

## 4. Operational State Pointers
- **Project Blueprint & Contracts:** [`./SPEC.md`](SPEC.md) (Immutable single source of truth; read-only during execution)
- **Live Task Machine & Locked Invariants:** [`./TODO.md`](TODO.md) (HATL-P state machine; check file leases before editing)
- **Domain Vocabulary & Terms:** [`./GLOSSARY.md`](GLOSSARY.md) (Canonical language; avoid synonyms)

## Agent skills

### Issue tracker

Local markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical defaults (`needs-triage`, `ready-for-agent`, etc.). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context root `GLOSSARY.md`. See `docs/agents/domain.md`.

