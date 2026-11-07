/**
 * Utubee Modern YouTube 2026 Component Architecture Tests (TASK-108)
 * Verifies thumbnail replacement inside yt-lockup-view-model & yt-thumbnail-view-model,
 * Trusted Types CSP zero-innerHTML compliance, and Clean Slate Study Mode HUD.
 */

const assert = require('assert');
const engine = require('../content/content.js');

let testsPassed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(err.message);
    throw err;
  }
}

console.log('Running Modern YouTube Component Tests (TASK-108)...\n');

// 1. Modern yt-lockup-view-model & yt-thumbnail-view-model swapping
test('processCard identifies and swaps thumbnails in modern yt-lockup-view-model', () => {
  const cardAttributes = {};

  const mockImg = {
    src: 'https://i.ytimg.com/vi/GAxFMM7l8CM/hq720.jpg',
    className: 'ytCoreImageHost ytCoreImageLoaded',
    attributes: {},
    setAttribute(k, v) { this.attributes[k] = String(v); },
    getAttribute(k) { return this.attributes[k] || null; },
    hasAttribute(k) { return k in this.attributes; },
    removeAttribute(k) { delete this.attributes[k]; }
  };

  const mockAnchor = {
    className: 'ytLockupViewModelContentImage',
    getAttribute(k) { return k === 'href' ? '/watch?v=GAxFMM7l8CM' : null; }
  };

  const mockLockupCard = {
    tagName: 'YT-LOCKUP-VIEW-MODEL',
    getAttribute(k) { return cardAttributes[k] || null; },
    setAttribute(k, v) { cardAttributes[k] = String(v); },
    querySelector(sel) {
      if (sel.includes('yt-thumbnail-view-model img') || sel.includes('img')) {
        return mockImg;
      }
      if (sel.includes('ytLockupViewModelContentImage') || sel.includes('/watch')) {
        return mockAnchor;
      }
      return null;
    },
    querySelectorAll() { return []; }
  };

  engine.processCard(mockLockupCard, 'hq2');

  assert.strictEqual(
    mockImg.src,
    'https://i.ytimg.com/vi/GAxFMM7l8CM/hq2.jpg',
    'Modern YouTube thumbnail image must swap to authentic hq2 milestone'
  );
  assert.strictEqual(
    cardAttributes['data-utubee-video-id'],
    'GAxFMM7l8CM'
  );
});

// 2. CARD_SELECTORS includes yt-lockup-view-model
test('CARD_SELECTORS includes yt-lockup-view-model', () => {
  assert.ok(
    engine.CARD_SELECTORS.includes('yt-lockup-view-model'),
    'CARD_SELECTORS must include modern yt-lockup-view-model'
  );
});

// 3. Trusted Types zero-innerHTML verification
test('updateCommentsToggleButton is Trusted Types compliant (zero innerHTML assignments)', () => {
  let innerHtmlSet = false;
  const mockBtn = {
    attributes: {},
    children: [],
    get firstChild() { return this.children[0] || null; },
    removeChild(c) {
      const idx = this.children.indexOf(c);
      if (idx !== -1) this.children.splice(idx, 1);
    },
    appendChild(c) { this.children.push(c); },
    setAttribute(k, v) { this.attributes[k] = String(v); },
    set innerHTML(val) {
      innerHtmlSet = true;
      throw new Error("This document requires 'TrustedHTML' assignment");
    }
  };

  engine.updateCommentsToggleButton(true, mockBtn);
  assert.strictEqual(innerHtmlSet, false, 'Must not assign to innerHTML');
  assert.strictEqual(mockBtn.attributes['aria-expanded'], 'true');
});

// 4. Clean Slate HUD injection and teardown
test('injectCleanSlateHUD and teardownCleanSlateHUD operate safely without innerHTML', () => {
  let innerHtmlSet = false;
  const elements = {};

  const mockBrowse = {
    children: [],
    insertBefore(el, ref) {
      el.parentNode = this;
      this.children.unshift(el);
    },
    appendChild(el) {
      el.parentNode = this;
      this.children.push(el);
    },
    removeChild(child) {
      const idx = this.children.indexOf(child);
      if (idx !== -1) {
        this.children.splice(idx, 1);
        delete child.parentNode;
      }
    }
  };

  const mockDoc = {
    getElementById(id) { return elements[id] || null; },
    querySelector(sel) {
      if (sel.includes('ytd-browse[page-subtype="home"]') || sel.includes('ytd-page-manager')) {
        return mockBrowse;
      }
      return null;
    },
    createElement(tag) {
      const el = {
        tagName: tag.toUpperCase(),
        className: '',
        children: [],
        appendChild(child) {
          child.parentNode = this;
          this.children.push(child);
        },
        removeChild(child) {
          const idx = this.children.indexOf(child);
          if (idx !== -1) {
            this.children.splice(idx, 1);
            delete child.parentNode;
          }
        },
        set innerHTML(val) {
          innerHtmlSet = true;
          throw new Error("This document requires 'TrustedHTML' assignment");
        }
      };
      return el;
    },
    createElementNS(ns, tag) {
      const el = this.createElement(tag);
      el.namespaceURI = ns;
      el.attributes = {};
      el.setAttribute = function(k, v) { this.attributes[k] = String(v); };
      return el;
    }
  };

  // Enable settings
  engine._setCurrentSettings({ extensionEnabled: true, cleanHome: true });

  const hud = engine.injectCleanSlateHUD(mockDoc);
  assert.ok(hud, 'HUD must be injected when extension and cleanHome are enabled on home page');
  assert.strictEqual(hud.id, 'utubee-clean-slate-container');
  elements['utubee-clean-slate-container'] = hud;
  hud.parentNode = mockBrowse;

  assert.strictEqual(innerHtmlSet, false, 'HUD injection must never use innerHTML');

  // Verify teardown
  engine.teardownCleanSlateHUD(mockDoc);
  assert.strictEqual(mockBrowse.children.length, 0, 'HUD must be cleanly removed on teardown');
});

console.log(`\nAll ${testsPassed} modern YouTube assertions passed!`);
