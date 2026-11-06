# Spec: Utubee-Thumbnail & Study Companion

Status: ready-for-agent

## Problem Statement

When students and technical learners use YouTube for coursework, lectures, and academic research on desktop browsers, they are constantly undermined by two deliberate platform dynamics:
1. **Misleading Creator Thumbnails:** Clickbait graphics, exaggerated facial expressions, and marketing teasers obscure the actual content of tutorials, making it difficult to gauge whether a video actually demonstrates code, shows mathematical proofs, or presents lecture slides.
2. **Algorithmic Attention Traps:** Opening YouTube immediately confronts the learner with a high-dopamine recommendation grid. While watching a 45-minute lecture, peripheral recommendation sidebars and vertical Shorts tempt the student into unproductive rabbit holes, while native controls lack academic study tools like instant slide clipping and concept repetition.

## Solution

A zero-bloat, privacy-respecting browser extension that converts YouTube into an intentional academic workspace. The extension automatically replaces promotional creator thumbnails with authentic video frames extracted from the midpoint of the video, provides a clean-slate query-first landing page, activates study shields that suppress peripheral recommendations while preserving course playlists, and equips learners with single-keystroke slide capture to the clipboard (`Alt + S`) and A-B concept micro-looping.

## User Stories

1. As a student browsing YouTube for academic lectures, I want video cards to display an Authentic Frame sampled from the midpoint of the video, so that I can immediately judge the lecture's real visual content without being misled by sensationalist creator thumbnails.
2. As a visual learner, I want 4:3 Authentic Frames on modern 16:9 widescreen video cards to be letterbox-compensated, so that the image cleanly fills the card without distracting black bars.
3. As a student comparing content, I want the option to choose between different Frame Milestones (25% start, 50% midpoint, 75% end) in the settings menu, so that I can preview different phases of a video's runtime.
4. As a student, I want upcoming Premieres and active Live Streams to be automatically skipped by the frame replacement engine, so that I do not encounter broken or missing images for unfinalized broadcasts.
5. As a student visiting YouTube to find a specific tutorial, I want to land on a Clean Slate Homepage with only the search interface, so that I can search intentionally without being ambushed by algorithmic recommendation feeds.
6. As a student watching a multi-part lecture series, I want Tunnel-Vision Watch mode to hide algorithmic sidebar recommendations while preserving the Course Playlist, so that I can navigate sequential course modules without seeing unrelated clickbait.
7. As a student preparing for exams, I want all YouTube Shorts shelves, navigation links, and reels to be eradicated across all feeds, so that the primary vector for impulsive doomscrolling is completely removed.
8. As a student reviewing challenging technical lectures, I want user comments to be hidden by default with a quick toggle to reveal the Errata Panel, so that I can access professor corrections, code repositories, and timestamps without getting pulled into comment arguments.
9. As a student taking notes in Obsidian, Notion, or Anki, I want to press `Alt + S` to copy the current video slide at full native resolution directly to my system clipboard, so that I can paste crisp diagrams and formulas into my notes with zero cropping.
10. As an accessibility-reliant student, I want the Slide Capture shortcut (`Alt + S`) to leave YouTube's native closed captions shortcut (`c`) untouched, so that my subtitles remain fully functional.
11. As a student typing notes or search queries, I want all extension keyboard shortcuts to be suppressed when focusing input fields, so that typing queries like "computer science" does not trigger extension actions.
12. As a student attempting to master a difficult 20-second derivation or code sequence, I want to press `[` to set Point A and `]` to set Point B to create an A-B Concept Loop, so that the segment repeats continuously without requiring manual seekbar scrubbing.
13. As a student looping a concept, I want to press `\` or `Escape` to clear the loop, so that normal linear playback resumes instantly.
14. As a student navigating between videos in a course, I want active A-B Concept Loops to reset automatically upon video navigation, so that previous loop bounds do not cause unexpected seeks on a new video.
15. As a student using visual hotkeys, I want a discreet Study HUD to briefly appear on the player confirming actions (e.g., slide copied or loop active), so that I know my command succeeded without obscuring video slides.
16. As a student reviewing an original thumbnail, I want to toggle the extension OFF in the settings popup and have all visible video cards immediately restore their original Creator Thumbnails without requiring a full page refresh.
17. As a multi-device student, I want my preferences (active state, selected milestone, active study shields) to persist and synchronize across all my browser sessions, so that my study setup remains consistent.
18. As a laptop user on battery, I want all visual shields and element suppression to execute via declarative CSS without JavaScript intervals or background polling, so that the extension consumes virtually zero CPU and memory.

## Implementation Decisions

### Architectural Seams & Modularity
- The extension is structured as a zero-build Manifest V3 Chrome Extension operating natively in standard ECMAScript and scoped CSS3.
- The system is partitioned into two primary boundaries:
  1. **Content Script & Declarative Style Engine:** Injected into `youtube.com` at `document_start` to enforce Study Shields before initial layout paint, eliminating visual flicker (FOUC).
  2. **Extension Popup Interface:** A lightweight configuration surface communicating state changes directly through browser synchronization storage.

### Domain Entities & Settings Schema
The configuration contract represents user preferences as a unified object:
```typescript
interface UtubeeSettings {
  extensionEnabled: boolean;           // Master toggle for frame replacement
  thumbnailMilestone: 'hq1' | 'hq2' | 'hq3'; // 25%, 50% (default), or 75%
  cleanHome: boolean;                  // Suppress homepage algorithmic grid
  hideSidebar: boolean;                // Tunnel-vision watch mode (playlist-safe)
  hideShorts: boolean;                 // Shorts eradication
  hideComments: boolean;               // Errata panel collapsed by default
  slideCaptureEnabled: boolean;        // Alt + S clipboard capture
  abLooperEnabled: boolean;            // [, ] concept looping
}
```

### Video Frame Swapper Decisions
- Video ID resolution targets the canonical 11-character identifier from video card anchors.
- High-quality authentic frame URLs are resolved directly from YouTube's static image CDN using deterministic milestone templates (`/hq1.jpg`, `/hq2.jpg`, `/hq3.jpg`).
- The engine neutralizes Chromium's responsive image preloader by clearing the `srcset` attribute on discovery, ensuring the browser renders the authentic frame rather than the responsive WebP creator thumbnail.
- To prevent 4:3 letterbox distortion on 16:9 video cards, an `object-fit: cover` rule paired with a scale transform is declaratively applied to thumbnail images when active.
- To prevent infinite loops and memory leaks in virtualized Polymer lists, elements are tracked with a non-retaining memory set (`WeakSet`) and scanned through a debounced observer locked to animation frames.

### Declarative Study Shield Decisions
- All Study Shields are driven by root dataset attributes attached to the top-level HTML document element (e.g. `data-utubee-clean-home="true"`).
- Distraction hiding rules are expressed purely in CSS using structural selectors (`:has()`, `:not()`).
- Playlist preservation explicitly excludes playlist panels (`ytd-playlist-panel-renderer`) from sidebar suppression rules so sequential course playlists remain fully interactive.
- Shorts eradication removes both shelf renderers in feed views and direct navigation links in drawer navigation.

### Comprehension & Study Tool Decisions
- **Slide Capture:** Reads raw video dimensions (`videoWidth`, `videoHeight`) onto an offscreen canvas and writes a PNG blob directly to the system clipboard via the asynchronous clipboard API. Fallbacks catch any DRM or security errors gracefully.
- **A-B Concept Looper:** Monitors current playback progress and seamlessly seeks to timestamp A whenever timestamp B is reached. Clears state on single-page navigation finish events.
- **Study HUD:** Injects an ephemeral DOM badge with CSS transitions on the video container that disappears automatically after 1.5 seconds.

## Testing Decisions

### Observable Behavior Seam
- Tests MUST target the single highest observable seam: the **DOM / Storage Boundary**.
- Internal helper functions and private variables are never tested directly; tests assert observable DOM states (attribute presence, image `src` values, CSS selector matchability, clipboard invocation, and video `currentTime` adjustments).
- Tests must pass cleanly in isolated headless environments without network calls to external servers.

### Test Suites
- **Thumbnail Engine Suite:** Asserts accurate video ID extraction, correct milestone URL assignment, `srcset` clearing, and letterbox crop transform styles on simulated Polymer video cards.
- **Study Shield Suite:** Asserts that CSS selectors correctly match and hide home feed containers, recommendation shelves, and Shorts elements, while verifying that playlist components are spared.
- **Comprehension Suite:** Asserts shortcut listeners ignore input fields, trigger canvas image drawing on `Alt + S`, enforce loop bounds on time updates, and reset on navigation events.

## Out of Scope

- **Custom Playback Speed Hotkeys:** YouTube natively provides speed adjustments (`Shift + >` and `Shift + <`), and existing specialized extensions (e.g. Video Speed Controller) already cover this space; implementing custom speed controls introduces hostile shortcut collisions.
- **Title Normalization & De-Capitalization:** Rewriting video titles creates discrepancies with search queries and is out of scope.
- **Shorts Aspect Ratio Refitting:** Shorts portrait cards are hidden entirely rather than modified.
- **External Backend Infrastructure:** No server-side proxies, user accounts, or cloud databases.

## Further Notes

- All changes adhere to the canonical language established in `GLOSSARY.md`.
- No new external runtime dependencies or npm packages are introduced; the extension remains a pure zero-build Manifest V3 package.
