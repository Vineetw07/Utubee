/**
 * Utubee Study Focus Shields Unit & Regression Tests
 * Verifies root attribute state machine, CSS selector invariants, errata toggle transitions,
 * and zero regression on core thumbnail replacer functions.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const engine = require('../content/content.js');

let testsPassed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(err);
    process.exit(1);
  }
}

console.log('Running Utubee Study Shields Tests...\n');

// Helper to create a mock DOM element with attribute storage
function createMockElement(tagName = 'div') {
  const attributes = {};
  let parentNode = null;
  const children = [];
  const eventListeners = {};

  const el = {
    tagName: tagName.toUpperCase(),
    attributes,
    children,
    get parentNode() { return parentNode; },
    set parentNode(p) { parentNode = p; },
    get nextSibling() {
      if (!parentNode || !parentNode.children) return null;
      const idx = parentNode.children.indexOf(el);
      return (idx !== -1 && idx < parentNode.children.length - 1) ? parentNode.children[idx + 1] : null;
    },
    setAttribute(k, v) { attributes[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(attributes, k) ? attributes[k] : null; },
    hasAttribute(k) { return Object.prototype.hasOwnProperty.call(attributes, k); },
    removeAttribute(k) { delete attributes[k]; },
    addEventListener(event, fn) {
      if (!eventListeners[event]) eventListeners[event] = [];
      eventListeners[event].push(fn);
    },
    removeEventListener(event, fn) {
      if (!eventListeners[event]) return;
      const idx = eventListeners[event].indexOf(fn);
      if (idx !== -1) eventListeners[event].splice(idx, 1);
    },
    dispatchEvent(event) {
      const fns = eventListeners[event] || [];
      for (const fn of fns) fn();
    },
    appendChild(child) {
      child.parentNode = el;
      children.push(child);
      return child;
    },
    removeChild(child) {
      const idx = children.indexOf(child);
      if (idx !== -1) {
        children.splice(idx, 1);
        child.parentNode = null;
      }
      return child;
    },
    insertBefore(newChild, refChild) {
      if (newChild.parentNode && typeof newChild.parentNode.removeChild === 'function') {
        newChild.parentNode.removeChild(newChild);
      }
      const idx = children.indexOf(refChild);
      newChild.parentNode = el;
      if (idx !== -1) {
        children.splice(idx, 0, newChild);
      } else {
        children.push(newChild);
      }
      return newChild;
    }
  };
  return el;
}

// --------------------------------------------------------------------------
// 1. Root Attribute Application & Lifecycle
// --------------------------------------------------------------------------
test('applyRootAttributes sets all dataset attributes when all shields enabled', () => {
  const root = createMockElement('html');
  const settings = {
    extensionEnabled: true,
    cleanHome: true,
    hideSidebar: true,
    hideShorts: true,
    hideComments: true
  };

  engine.applyRootAttributes(settings, root);

  assert.strictEqual(root.getAttribute('data-utubee-enabled'), 'true');
  assert.strictEqual(root.getAttribute('data-utubee-clean-home'), 'true');
  assert.strictEqual(root.getAttribute('data-utubee-hide-sidebar'), 'true');
  assert.strictEqual(root.getAttribute('data-utubee-hide-shorts'), 'true');
  assert.strictEqual(root.getAttribute('data-utubee-hide-comments'), 'true');
  assert.strictEqual(root.hasAttribute('data-utubee-comments-revealed'), false);
});

test('applyRootAttributes selectively removes disabled shields', () => {
  const root = createMockElement('html');
  const settings = {
    extensionEnabled: true,
    cleanHome: false,
    hideSidebar: true,
    hideShorts: false,
    hideComments: true
  };

  engine.applyRootAttributes(settings, root);

  assert.strictEqual(root.getAttribute('data-utubee-enabled'), 'true');
  assert.strictEqual(root.hasAttribute('data-utubee-clean-home'), false);
  assert.strictEqual(root.getAttribute('data-utubee-hide-sidebar'), 'true');
  assert.strictEqual(root.hasAttribute('data-utubee-hide-shorts'), false);
  assert.strictEqual(root.getAttribute('data-utubee-hide-comments'), 'true');
});

test('applyRootAttributes strips all shield attributes when extensionEnabled is false', () => {
  const root = createMockElement('html');
  // First set them
  engine.applyRootAttributes({
    extensionEnabled: true,
    cleanHome: true,
    hideSidebar: true,
    hideShorts: true,
    hideComments: true
  }, root);

  root.setAttribute('data-utubee-comments-revealed', 'true');

  // Now disable extension
  engine.applyRootAttributes({
    extensionEnabled: false,
    cleanHome: true,
    hideSidebar: true,
    hideShorts: true,
    hideComments: true
  }, root);

  assert.strictEqual(root.hasAttribute('data-utubee-enabled'), false);
  assert.strictEqual(root.hasAttribute('data-utubee-clean-home'), false);
  assert.strictEqual(root.hasAttribute('data-utubee-hide-sidebar'), false);
  assert.strictEqual(root.hasAttribute('data-utubee-hide-shorts'), false);
  assert.strictEqual(root.hasAttribute('data-utubee-hide-comments'), false);
  assert.strictEqual(root.hasAttribute('data-utubee-comments-revealed'), false);
});

test('applyRootAttributes handles null root or invalid settings gracefully', () => {
  assert.doesNotThrow(() => engine.applyRootAttributes(null, null));
  assert.doesNotThrow(() => engine.applyRootAttributes({}, null));
  assert.doesNotThrow(() => engine.applyRootAttributes(null, createMockElement('html')));
});

// --------------------------------------------------------------------------
// 2. Comments Errata Toggle State Transitions & Navigation Reset
// --------------------------------------------------------------------------
test('toggleCommentsVisibility toggles revealed state and updates attribute', () => {
  const root = createMockElement('html');

  // First toggle: reveals comments
  const state1 = engine.toggleCommentsVisibility(root);
  assert.strictEqual(state1, true);
  assert.strictEqual(root.getAttribute('data-utubee-comments-revealed'), 'true');

  // Second toggle: hides comments again
  const state2 = engine.toggleCommentsVisibility(root);
  assert.strictEqual(state2, false);
  assert.strictEqual(root.hasAttribute('data-utubee-comments-revealed'), false);
});

test('resetCommentsRevealedState clears revealed attribute on navigation', () => {
  const root = createMockElement('html');
  root.setAttribute('data-utubee-comments-revealed', 'true');

  engine.resetCommentsRevealedState(root);
  assert.strictEqual(root.hasAttribute('data-utubee-comments-revealed'), false);
});

// --------------------------------------------------------------------------
// 3. Comments Errata Button DOM Injection & Teardown
// --------------------------------------------------------------------------
test('injectCommentsToggleButton inserts button container before #comments', () => {
  const root = createMockElement('html');
  const parent = createMockElement('div');
  const commentsEl = createMockElement('ytd-comments');
  commentsEl.id = 'comments';
  parent.appendChild(commentsEl);

  let elementsById = {
    'comments': commentsEl
  };

  const mockDoc = {
    documentElement: root,
    querySelector: (sel) => {
      if (sel.includes('comments')) return commentsEl;
      return null;
    },
    getElementById: (id) => elementsById[id] || null,
    createElement: (tag) => {
      const el = createMockElement(tag);
      return el;
    }
  };

  engine._setCurrentSettings({ extensionEnabled: true, hideComments: true });

  const container = engine.injectCommentsToggleButton(mockDoc);
  assert.ok(container, 'Container should be created');
  assert.strictEqual(container.id, 'utubee-errata-container');

  // Verify container is inserted before commentsEl
  assert.strictEqual(parent.children[0], container);
  assert.strictEqual(parent.children[1], commentsEl);

  // Add container to elementsById map to simulate DOM tree
  elementsById['utubee-errata-container'] = container;

  // Second injection should be idempotent and not create duplicate
  const secondCall = engine.injectCommentsToggleButton(mockDoc);
  assert.strictEqual(secondCall, container);
  assert.strictEqual(parent.children.length, 2);

  // Teardown should remove container cleanly
  engine.teardownCommentsToggleButton(mockDoc);
  assert.strictEqual(parent.children.length, 1);
  assert.strictEqual(parent.children[0], commentsEl);
});

// --------------------------------------------------------------------------
// 4. CSS Invariant & Selector Verification (content/styles.css)
// --------------------------------------------------------------------------
test('styles.css enforces Zero FOUC root attribute selectors', () => {
  const cssPath = path.join(__dirname, '../content/styles.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.ok(css.includes('html[data-utubee-clean-home="true"]'), 'Clean home root selector missing');
  assert.ok(css.includes('html[data-utubee-hide-sidebar="true"]'), 'Hide sidebar root selector missing');
  assert.ok(css.includes('html[data-utubee-hide-shorts="true"]'), 'Hide shorts root selector missing');
  assert.ok(css.includes('html[data-utubee-hide-comments="true"]'), 'Hide comments root selector missing');
  assert.ok(css.includes(':not([data-utubee-comments-revealed="true"])'), 'Comments reveal exception selector missing');
});

test('styles.css strictly preserves course lecture playlists (ytd-playlist-panel-renderer)', () => {
  const cssPath = path.join(__dirname, '../content/styles.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  // Invariant 1: #secondary alone must NOT have display: none
  const secondaryAloneHiding = /html\[data-utubee-hide-sidebar="true"\]\s+#secondary\s*\{[^}]*display:\s*none/i;
  assert.strictEqual(
    secondaryAloneHiding.test(css),
    false,
    'VIOLATION: #secondary alone cannot be hidden because it destroys playlists'
  );

  // Invariant 2: #secondary #related MUST be hidden
  assert.ok(
    css.includes('#secondary #related'),
    'Sidebar recommendations (#secondary #related) must be targeted'
  );

  // Invariant 3: ytd-playlist-panel-renderer MUST have explicit display preservation
  assert.ok(
    css.includes('ytd-playlist-panel-renderer'),
    'Playlist panel renderer must have explicit preservation rule'
  );
  assert.ok(
    css.includes('display: flex !important') || css.includes('visibility: visible !important'),
    'Playlist panel renderer must force display: flex !important'
  );
});

test('styles.css hides homepage recommendations and Shorts comprehensively', () => {
  const cssPath = path.join(__dirname, '../content/styles.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  // Clean Slate Home
  assert.ok(
    css.includes('ytd-browse[page-subtype="home"] #contents'),
    'Homepage #contents must be hidden'
  );

  // Shorts Eradication
  assert.ok(css.includes('a[title="Shorts"]'), 'Shorts nav buttons must be hidden');
  assert.ok(css.includes('ytd-reel-shelf-renderer'), 'Shorts shelf renderer must be hidden');
  assert.ok(css.includes('[is-shorts]'), 'Shorts shelf attribute must be hidden');
  assert.ok(css.includes(':has(a[href*="/shorts/"])'), 'Shorts video links must be hidden via :has');
});

test('styles.css includes craft-grade errata button styling and dark mode support', () => {
  const cssPath = path.join(__dirname, '../content/styles.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.ok(css.includes('#utubee-comments-toggle-btn'), 'Button ID styling missing');
  assert.ok(css.includes('#utubee-errata-container'), 'Container ID styling missing');
  assert.ok(css.includes('#utubee-comments-toggle-btn:hover'), 'Hover state missing');
  assert.ok(css.includes('#utubee-comments-toggle-btn:active'), 'Active state missing');
  assert.ok(css.includes('#utubee-comments-toggle-btn:focus-visible'), 'Focus state missing');
  assert.ok(css.includes('html[dark] #utubee-comments-toggle-btn'), 'Dark mode styling missing');
  assert.ok(css.includes('prefers-reduced-motion'), 'prefers-reduced-motion compliance missing');
});

// --------------------------------------------------------------------------
// 5. Zero Regression on Core Thumbnail Swapper Engine
// --------------------------------------------------------------------------
test('Zero Regression: getThumbnailUrl and extractVideoId continue functioning properly', () => {
  assert.strictEqual(
    engine.getThumbnailUrl('dQw4w9WgXcQ', 'hq2'),
    'https://i.ytimg.com/vi/dQw4w9WgXcQ/hq2.jpg'
  );
  assert.strictEqual(
    engine.extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ', null),
    'dQw4w9WgXcQ'
  );
  assert.strictEqual(
    engine.extractVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ', null),
    null
  );
  assert.strictEqual(engine.isShortsUrl('https://www.youtube.com/shorts/abc12345'), true);
  assert.strictEqual(engine.isShortsUrl('https://www.youtube.com/watch?v=abc12345'), false);
});

console.log(`\nAll ${testsPassed} study shields assertions passed successfully!`);
