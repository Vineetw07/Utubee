# Project Specification (SPEC.md)

> **Status:** IMMUTABLE BASELINE | Read-only during implementation turns to preserve prompt prefix caching.
> Changes require formal re-planning by the Lead Orchestrator.

---

## 1. Product Outcome & Core Problem
- **Problem Statement:** Students and serious learners use YouTube as an educational resource, but face two massive obstacles:
  1. *Deceptive Clickbait Thumbnails:* Artificial facial expressions and misleading graphic teasers that hide actual lecture quality.
  2. *Algorithmic Distraction Traps:* The homepage recommendation grid, peripheral watch sidebar, and vertical Shorts pull students down unproductive rabbit holes.
- **Target Outcome:** A zero-bloat, lightning-fast Manifest V3 Chrome extension that replaces clickbait thumbnails with authentic midpoint video frames (`hq2.jpg`), provides a distraction-free "Search-Only" study environment, and equips students with instant slide clipping (`Alt + S`) and A-B concept looping.
- **Target Users:** Students, developers, and academics studying lectures and technical tutorials on Windows / Chrome.

---

## 2. Prioritized User Stories & Flows

### US-01 [P0]: Authentic Midpoint Thumbnail Swapper
- **Story:** As a student, I want YouTube video cards to show the authentic middle frame (~50% mark) of the video rather than the creator's designed clickbait image.
- **Acceptance Criteria:**
  - Content script identifies all standard video cards (`ytd-rich-item-renderer`, `ytd-video-renderer`, `ytd-compact-video-renderer`, `ytd-grid-video-renderer`).
  - Swaps `img.src` to `https://i.ytimg.com/vi/<VIDEO_ID>/hq2.jpg` (or configured milestone).
  - Clears/overrides `srcset` so Chrome does not reload the original WebP thumbnail.
  - Applies CSS `object-fit: cover` and letterbox compensation so 4:3 `hq2.jpg` frames fill modern 16:9 cards seamlessly without baked-in black bars.
  - Skips upcoming premieres and active live streams to prevent 404 broken frames.
  - Restores original thumbnails immediately if toggled OFF in the popup without page reload.

### US-02 [P0]: Distraction-Free Study Focus Shields (Declarative CSS)
- **Story:** As a student, I want to eliminate algorithmic distraction vectors so I can study without getting sidetracked.
- **Acceptance Criteria:**
  - **Clean Slate Home:** Hides the home recommendation grid (`ytd-browse[page-subtype="home"] #contents`), providing a clean search-first landing experience.
  - **Playlist-Safe Sidebar Hider:** Hides `#secondary #related` recommendations, but explicitly preserves course lecture series playlists (`ytd-playlist-panel-renderer`).
  - **Shorts Eradication:** Completely removes Shorts tabs from the navigation bar, homepage shelf, and search results shelves.
  - **Comments Shield:** Comments hidden by default, with a 1-click on-screen button to view errata and pinned notes when necessary.
  - Zero FOUC: Injected at `document_start` via root dataset selectors (`html[data-utubee-...="true"]`).

### US-03 [P1]: Instant Lecture Slide & Frame Capture
- **Story:** As a visual learner, I want to capture pristine lecture slides directly to my clipboard with a single keystroke.
- **Acceptance Criteria:**
  - Pressing `Alt + S` (or clicking a discreet player button) grabs the current frame from `<video>` onto an offscreen `<canvas>`.
  - Drawn at full native resolution (`video.videoWidth` × `video.videoHeight`) for crisp 1080p/4K notes.
  - Writes PNG blob to clipboard via `navigator.clipboard.write()` for instant `Ctrl + V` into Notion, Obsidian, Anki, or Word.
  - Guaranteed zero conflict with native YouTube shortcuts (does NOT touch `'c'`, which is reserved for Captions).
  - Shows an elegant, non-intrusive 1.5s toast HUD ("Slide copied to clipboard").

### US-04 [P1]: A-B Concept Looper
- **Story:** As a student studying a difficult derivation, code walkthrough, or diagram, I want to loop a short 15–30 second segment until I understand it.
- **Acceptance Criteria:**
  - Pressing `[` sets Loop Point A (start).
  - Pressing `]` sets Loop Point B (end) and immediately begins continuous looping.
  - Pressing `\` or `Escape` clears the active loop.
  - Shows an on-screen indicator badge on the player with loop range and active status.
  - Resets automatically on video navigation (`yt-navigate-finish`) to prevent state leaks across videos.

### US-05 [P1]: Minimalist Settings Popup
- **Story:** As a user, I want a clean, fast popup menu to toggle features on or off.
- **Acceptance Criteria:**
  - Minimalist layout with Master ON/OFF Switch.
  - Frame Selector: 50% Middle (Default), 25% Start, 75% End.
  - Modular Study Toggles: Clean Home, Hide Sidebar, Block Shorts, Hide Comments.
  - Instant live synchronization across open YouTube tabs via `chrome.storage.sync`.

---

## 3. Explicit Non-Goals (Out of Scope)
- **NON-GOAL 1 (No Speed Controller):** Do NOT implement custom playback speed or seek hotkeys (`S, D, R, Z, X`). YouTube has native speed controls (`Shift + >`) and seeking (`j/l/arrows`), and custom key listeners collide with existing tools (*Video Speed Controller*).
- **NON-GOAL 2 (No Title Rewrites):** Do NOT manipulate or de-capitalize video titles.
- **NON-GOAL 3 (No External Servers or Paid APIs):** 100% client-side operation with zero telemetry, zero analytics, and zero backend infrastructure.
- **NON-GOAL 4 (No Shorts Portrait Replacements):** Do NOT attempt to swap thumbnails on 9:16 Shorts cards; Shorts are to be hidden, not refitted.

---

## 4. Domain Entities & Storage Schemas
```typescript
export interface UtubeeSettings {
  // Core thumbnail replacement
  extensionEnabled: boolean;           // Default: true
  thumbnailMilestone: 'hq1' | 'hq2' | 'hq3'; // Default: 'hq2' (50% midpoint)

  // Distraction shields
  cleanHome: boolean;                  // Default: true (Search-only homepage)
  hideSidebar: boolean;                // Default: true (Algorithmic recommendations hidden)
  hideShorts: boolean;                 // Default: true (Shorts eradication)
  hideComments: boolean;               // Default: true (Comments collapsed with errata button)

  // Comprehension tools
  slideCaptureEnabled: boolean;        // Default: true (Alt + S)
  abLooperEnabled: boolean;            // Default: true ([, ])
}
```

---

## 5. Keyboard Map & Action Contracts

| Action | Shortcut | Scope | Behavior |
| :--- | :--- | :--- | :--- |
| **Capture Slide** | `Alt + S` | Watch Page Player | Copies native 1080p/4K frame to clipboard + HUD toast |
| **Set Loop Point A** | `[` | Watch Page Player | Sets loop start at `video.currentTime` |
| **Set Loop Point B** | `]` | Watch Page Player | Sets loop end & activates loop |
| **Clear Loop** | `\` or `Escape` | Watch Page Player | Disables looping & restores normal playback |

*Input Safety Guard:* All keyboard listeners check `if (e.target.matches('input, textarea, [contenteditable="true"], ytd-searchbox *')) return;` to prevent triggering shortcuts while searching or typing.

---

## 6. System Invariants & Verification Protocol
1. **Zero-Lag Declarative CSS:** Focus shields are powered by `html[data-utubee-...="true"]` rules injected at `document_start` to eliminate FOUC.
2. **Aspect Ratio Crop:** Letterbox bars on `hq2.jpg` (480×360) are cropped via `object-fit: cover` and scale transform to perfectly match 16:9 cards.
3. **Surgical Diffs & File Leases:** Content scripts, styles, and popup files maintain strict separation of concerns.
4. **Verification Gate:**
   - Manifest V3 JSON schema validation.
   - Syntax validation via `node --check`.
   - Live loading test in Google Chrome without console errors.
