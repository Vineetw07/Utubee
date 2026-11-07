# Utubee: Authentic Thumbnails & Study Companion

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero-success.svg)]()
[![Privacy First](https://img.shields.io/badge/Privacy-100%25%20Client--Side-brightgreen.svg)]()
[![Platform](https://img.shields.io/badge/Platform-Chrome%20%7C%20Edge%20%7C%20Brave-orange.svg)]()

> **Anti-clickbait authentic thumbnail swapper and distraction-free study companion for YouTube.**

Students and serious learners rely heavily on YouTube for academic lectures, technical tutorials, and conceptual walkthroughs. However, the platform is optimized for engagement rather than deep learning:
1. **Deceptive Clickbait Thumbnails:** Exaggerated facial expressions, sensationalized text, and misleading graphics that disguise actual lecture content and quality.
2. **Algorithmic Distraction Traps:** Endless homepage recommendation grids, peripheral related-video sidebars, and vertical Shorts that pull focus into unproductive rabbit holes.

**Utubee** is a lightweight, zero-bloat Chrome extension (Manifest V3) that turns YouTube into an intentional, high-signal academic learning workstation.

---

## Key Features

### 1. Authentic Midpoint Thumbnail Swapper
- **Deterministic Frame Milestones:** Replaces creator clickbait with authentic video stills sampled directly from the video stream via YouTube's static CDN (`hq2.jpg` at the ~50% midpoint mark).
- **Milestone Customization:** Choose between **25% (Start)**, **50% (Midpoint)**, or **75% (End)** in the popup.
- **Zero-Flicker & Fast-Path Engine:** Employs an $O(1)$ fast-path on active cards and CSS loading state masks to eliminate thumbnail flickering during high-speed scrolling.
- **Aspect Ratio Compensation:** Intelligently crops 4:3 milestone stills with letterbox compensation (`object-fit: cover`) to seamlessly fit modern 16:9 cards without black bars.
- **Premieres & Live Stream Safety:** Automatically detects live streams and upcoming premieres to prevent 404 broken images.

---

### 2. Distraction-Free Study Focus Shields
All shields are applied declaratively at `document_start` via root dataset selectors (`html[data-utubee-...="true"]`) to guarantee **Zero Flash of Unstyled Content (Zero FOUC)**:

- **Clean Slate Home:** Suppresses the algorithmic homepage feed, turning YouTube into a quiet, query-first search interface.
- **Playlist-Safe Sidebar:** Hides distracting "related videos" while **explicitly preserving** structured course lecture series playlists (`ytd-playlist-panel-renderer`).
- **Shorts Eradication:** Completely removes Shorts tabs from the navigation bar, homepage shelves, and search results.
- **Shield Comments (Errata Panel):** Collapses noisy comment sections by default, providing a clean 1-click on-screen button to view instructor corrections, pinned timestamps, and lecture notes.

---

### 3. Comprehension & Note-Taking Tools

| Feature | Shortcut | Scope | Description |
| :--- | :---: | :--- | :--- |
| **Instant Slide Capture** | <kbd>Alt</kbd> + <kbd>S</kbd> | Watch Player | Captures full native resolution (1080p / 4K) video frames directly to your clipboard for instant pasting (<kbd>Ctrl</kbd> + <kbd>V</kbd>) into Notion, Obsidian, Anki, or OneNote. |
| **Set Loop Point A** | <kbd>[</kbd> | Watch Player | Marks the start timestamp of a difficult concept, derivation, or code walkthrough. |
| **Set Loop Point B** | <kbd>]</kbd> | Watch Player | Marks the end timestamp and initiates continuous A-B repetition with an on-screen HUD badge. |
| **Clear Loop** | <kbd>\</kbd> or <kbd>Esc</kbd> | Watch Player | Disables the active loop and restores standard playback. |

> **Smart Input Guard:** All keyboard listeners automatically deactivate whenever your focus is inside search inputs, comment boxes, or text fields to avoid shortcut collisions. Native YouTube keys (such as `c` for subtitles/captions) remain untouched.

---

## Installation

### Load Unpacked (Developer Mode)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/Vineetw07/Utubee.git
   ```
2. Open Google Chrome (or any Chromium browser: Brave, Edge, Opera, Vivaldi).
3. Navigate to `chrome://extensions/` in your address bar.
4. Enable **Developer mode** using the toggle switch in the top right corner.
5. Click the **Load unpacked** button in the top left.
6. Select the `Utubee` project folder (the folder containing `manifest.json`).
7. Open [YouTube](https://www.youtube.com) and click the **Utubee** icon in your extension toolbar to customize your settings!

---

## Extension Settings

Click the extension icon to access the popup control panel:

- **Master Toggle:** Instantly enable or disable all extension features without page reloads.
- **Thumbnail Milestone Selector:** Switch between 25% (Start), 50% (Middle), or 75% (End).
- **Modular Study Shields:**
  - *Clean Slate Home* (Search-first homepage)
  - *Playlist-Safe Sidebar* (Hides algorithmic suggestions, keeps course playlists)
  - *Block Shorts* (Removes short-form vertical feeds)
  - *Shield Comments* (Collapses comments with 1-click errata button)
- **Comprehension Tools:**
  - *Slide Capture* (<kbd>Alt</kbd> + <kbd>S</kbd>)
  - *A-B Looper* (<kbd>[</kbd>, <kbd>]</kbd>, <kbd>\</kbd>)

All preferences are synced in real-time across all open tabs via `chrome.storage.sync`.

---

## Project Structure

```text
Utubee/
├── manifest.json              # Chrome Extension Manifest V3 configuration
├── content/
│   ├── content.js             # Core DOM engine: thumbnail swapping, study shields, A-B looper, slide capture
│   └── styles.css             # Declarative zero-FOUC shields, HUD toasts, and CSS layout rules
├── popup/
│   ├── popup.html             # Settings popup UI
│   ├── popup.css              # Craft-grade popup styling (336px grid, light & dark theme)
│   └── popup.js               # Reactive settings state machine and chrome.storage sync
├── icons/                     # Extension branding icons (16px, 48px, 128px)
├── tests/                     # Automated test suites for all subsystems
│   ├── test_thumbnail_engine.js
│   ├── test_study_shields.js
│   ├── test_comprehension_tools.js
│   ├── test_modern_youtube.js
│   ├── test_scroll_performance.js
│   ├── test_production_fixes.js
│   └── test_popup.js
├── SPEC.md                    # Detailed engineering specification
└── GLOSSARY.md                # Domain model & ubiquitous language
```

---

## Running Tests

Utubee includes comprehensive standalone unit tests with zero external test runner dependencies. All tests execute on Node.js:

```bash
# Run all test suites
node tests/test_thumbnail_engine.js
node tests/test_study_shields.js
node tests/test_comprehension_tools.js
node tests/test_modern_youtube.js
node tests/test_scroll_performance.js
node tests/test_production_fixes.js
node tests/test_popup.js
```

---

## Privacy & Security

- **100% Client-Side:** Operates strictly inside your browser. No external API servers, proxies, or cloud endpoints.
- **Zero Telemetry:** No analytics, tracking beacons, or telemetry scripts.
- **Trusted Types & CSP Compliant:** Built without unsafe `eval()` or dangerous `innerHTML` assignments to ensure full compliance with YouTube's strict Content Security Policy.
- **Minimal Permissions:** Only requests `storage` (to save your settings) and `clipboardWrite` (to copy slide captures).

---

## License

This project is licensed under the [MIT License](LICENSE).
