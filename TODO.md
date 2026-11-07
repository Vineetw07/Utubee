# Project Tasks (TODO.md)

> Governed by the Bidirectional Human-Agent Task Lifecycle Protocol (HATL-P).
> Tasks require verifiable machine proof (Exit Code 0) before being marked complete.

---

## In Progress

---

## Backlog

---

## Technical Debt / Deferred
- [ ] [CLEANUP] TASK-106: Add optional custom export for A-B timestamps to Markdown.

---

## Done
- [x] TASK-109: Zero-Flicker Scroll Shield, Targeted Attribute Observer, `srcset` Property Lock & O(1) Fast-Path
  - Completed: 2026-11-07T10:26:00Z
  - Proof: Exit code 0 | `node --check content/content.js; node --check popup/popup.js; node tests/test_thumbnail_engine.js; node tests/test_study_shields.js; node tests/test_comprehension_tools.js; node tests/test_popup.js; node tests/test_production_fixes.js; node tests/test_modern_youtube.js; node tests/test_scroll_performance.js` (63/63 unit assertions passed)
  - Zero-Flicker CSS: Injected `html[data-utubee-enabled="true"] img[data-utubee-loading="true"] { opacity: 0 !important; }` to eliminate Flash of Original Thumbnail (FOOT).
  - Descriptor Lock: Implemented `Object.defineProperty(img, 'srcset', ...)` to prevent YouTube's lazy-loader from overwriting authentic frames.
  - O(1) Fast-Path: Added instant anchor verification on active cards, bypassing 500+ DOM queries per scroll tick.
  - Targeted Observer: Augmented MutationObserver with `attributeFilter: ['src', 'srcset', 'href']` and passive scroll listener.
  - Files: `content/content.js`, `content/styles.css`, `tests/test_scroll_performance.js`
- [x] TASK-108: Modern YouTube Card Selectors (`yt-lockup-view-model`, `yt-thumbnail-view-model`), Trusted Types CSP Fix, & Clean Slate Study HUD
  - Completed: 2026-11-06T13:10:00Z
  - Proof: Exit code 0 | `node --check content/content.js; node --check popup/popup.js; node tests/test_thumbnail_engine.js; node tests/test_study_shields.js; node tests/test_comprehension_tools.js; node tests/test_popup.js; node tests/test_production_fixes.js; node tests/test_modern_youtube.js` (58/58 unit assertions passed)
  - CSP Compliance: Eliminated all `innerHTML` assignments, replacing with `document.createElementNS` and `.textContent` to comply with YouTube's `require-trusted-types-for 'script'` policy.
  - HUD UX: Injected centered Clean Slate Focus HUD card on homepage feed void with zero distraction guidance.
  - Files: `content/content.js`, `content/styles.css`, `tests/test_modern_youtube.js`
- [x] TASK-107: Apply 4 Critical Production Fixes & Launch External Chrome Extension
  - Completed: 2026-11-06T12:51:00Z
  - Proof: Exit code 0 | `node tests/test_thumbnail_engine.js; node tests/test_study_shields.js; node tests/test_comprehension_tools.js; node tests/test_popup.js; node tests/test_production_fixes.js` (54/54 unit assertions passed)
  - Repro Suite: `tests/test_production_fixes.js` captured RED failure on node recycling, GREEN on surgical patch
  - External Browser: Launched standalone Google Chrome with `--load-extension="D:\TP\Utubee-Thumbnail"`
  - Files: `content/content.js`, `tests/test_production_fixes.js`, `tests/test_comprehension_tools.js`, `tests/test_thumbnail_engine.js`
- [x] TASK-105: End-to-End Verification, Syntax Checking & Chrome Packaging
  - Completed: 2026-11-06T12:33:00Z
  - Proof: Exit code 0 | `node --check content/content.js; node --check popup/popup.js; node tests/test_thumbnail_engine.js; node tests/test_study_shields.js; node tests/test_comprehension_tools.js; node tests/test_popup.js` (50/50 unit assertions passed)
  - Manifest Check: Exit code 0 | `Get-Content manifest.json | ConvertFrom-Json`
  - Review: Reviewed by Reviewer sub-agent; zero must-fix blockers; addressed contenteditable nesting guard, fullscreen toast re-parenting, and reduced-motion toast centering
  - Files: `manifest.json`, `tests/*`, `popup/*`, `content/*`
- [x] TASK-104: Implement Minimalist Extension Popup & Real-Time Sync
  - Completed: 2026-11-06T12:31:30Z
  - Proof: Exit code 0 | `node --check popup/popup.js; node tests/test_popup.js` (5 unit assertions passed, 50/50 overall)
  - Review: Reviewed by Reviewer sub-agent with zero must-fix blockers; confirmed MV3 CSP zero inline scripts, 336px high-density craft layout, and live storage sync
  - Files: `popup/popup.html`, `popup/popup.css`, `popup/popup.js`, `tests/test_popup.js`
- [x] TASK-103: Implement Lecture Slide Capture (`Alt + S`) & A-B Concept Looper (`[`, `]`)
  - Completed: 2026-11-06T12:28:45Z
  - Proof: Exit code 0 | `node --check content/content.js; node tests/test_thumbnail_engine.js; node tests/test_study_shields.js; node tests/test_comprehension_tools.js` (45 total unit assertions passed)
  - Review: Reviewed by Reviewer sub-agent with zero must-fix blockers; confirmed key 'c' preservation, input safety guard, and native resolution canvas capture
  - Files: `content/content.js`, `content/styles.css`, `tests/test_comprehension_tools.js`
- [x] TASK-102: Implement Declarative Study Focus Shields (Clean Home, Playlist-Safe Sidebar, Shorts, Comments)
  - Completed: 2026-11-06T12:14:14Z
  - Proof: Exit code 0 | `node --check content/content.js; node tests/test_thumbnail_engine.js; node tests/test_study_shields.js` (23 total unit assertions passed)
  - Review: Reviewed by Reviewer sub-agent with zero must-fix blockers; addressed watch-page mutation observer check & container repositioning
  - Files: `content/styles.css`, `content/content.js`, `tests/test_study_shields.js`
- [x] TASK-101: Implement Core Thumbnail Replacer Engine & Letterbox Scale Compensation
  - Completed: 2026-11-06T12:01:26Z
  - Proof: Exit code 0 | `node --check content/content.js; node tests/test_thumbnail_engine.js` (11 unit tests passed)
  - Review: Reviewed by Reviewer sub-agent with zero must-fix blockers remaining
  - Files: `content/content.js`, `content/styles.css`, `tests/test_thumbnail_engine.js`
- [x] TASK-100: Initialize Manifest V3 Scaffolding & Configuration Contract
  - Completed: 2026-11-06T11:50:37Z
  - Proof: Exit code 0 | `Get-Content manifest.json | ConvertFrom-Json` & `node -e "JSON.parse(fs.readFileSync('manifest.json'))"`
  - Icons: Generated 16x16, 48x48, 128x128 PNG badges in `icons/`
- [x] TASK-099: Architecture Blueprint & Planning Handshake
  - Completed: 2026-11-06T11:43:00Z
  - Proof: Approved by user after 3 rounds of grilling and multi-agent feasibility audit.
  - Commit/Hash: `blueprint-v1`

---

## Locked Invariants & Dead-Ends (Max 10 Lines)
1. Key Map Invariant: Never use key 'c' (reserved for native YouTube captions); use Alt + S for slide capture.
2. Letterbox Crop Invariant: hq2.jpg is 480x360 (4:3); must apply object-fit: cover and scale compensation for 16:9 cards.
3. Playlist Safety Invariant: Never hide course playlists (ytd-playlist-panel-renderer) when hiding sidebar.
4. Anti-Bloat Invariant: Do NOT implement custom playback speed hotkeys (conflicts with native & Video Speed Controller).
5. Zero FOUC Invariant: Hide distraction elements via declarative CSS at document_start, never periodic JS intervals.
6. SPA Lifecycle Invariant: Clear A-B loop state and update observers on 'yt-navigate-finish' events.
7. Concurrency Invariant: Sub-agents must never edit SPEC.md or TODO.md; only Lead Orchestrator updates state ledgers.
8. Trusted Types Invariant: Never use .innerHTML on YouTube DOM due to CSP TrustedHTML enforcement; use createElement/NS only.
