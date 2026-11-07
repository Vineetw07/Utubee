/**
 * Utubee Comprehension Tools Unit Tests: Slide Capture & A-B Concept Looper
 * Verifies timestamp formatting, looper state machine, keyboard shortcut routing,
 * input safety guards, canvas slide capture to clipboard, and DOM toast/badge lifecycle.
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

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// Minimal DOM mock element generator with classList, attributes, and tree hierarchy
function createMockElement(tagName = 'div') {
  const attributes = {};
  let parentNode = null;
  const children = [];
  const classNames = new Set();
  const eventListeners = {};
  let textContent = '';
  const style = {};

  const el = {
    tagName: tagName.toUpperCase(),
    attributes,
    children,
    style,
    get parentNode() { return parentNode; },
    set parentNode(p) { parentNode = p; },
    get id() { return attributes['id'] || ''; },
    set id(val) { attributes['id'] = String(val); },
    get textContent() {
      if (children.length === 0) return textContent;
      return children.map((c) => c.textContent).join('') || textContent;
    },
    set textContent(t) { textContent = String(t); },
    get className() { return Array.from(classNames).join(' '); },
    set className(val) {
      classNames.clear();
      if (val) {
        val.split(/\s+/).filter(Boolean).forEach((c) => classNames.add(c));
      }
    },
    classList: {
      add: (...tokens) => tokens.forEach((t) => classNames.add(t)),
      remove: (...tokens) => tokens.forEach((t) => classNames.delete(t)),
      contains: (token) => classNames.has(token),
      toggle: (token, force) => {
        if (force === undefined) {
          if (classNames.has(token)) {
            classNames.delete(token);
            return false;
          }
          classNames.add(token);
          return true;
        }
        if (force) {
          classNames.add(token);
        } else {
          classNames.delete(token);
        }
        return force;
      }
    },
    setAttribute(k, v) {
      attributes[k] = String(v);
      if (k === 'class') {
        classNames.clear();
        String(v).split(/\s+/).filter(Boolean).forEach((c) => classNames.add(c));
      }
      if (k === 'id') {
        attributes['id'] = String(v);
      }
    },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(attributes, k) ? attributes[k] : null; },
    hasAttribute(k) { return Object.prototype.hasOwnProperty.call(attributes, k); },
    removeAttribute(k) { delete attributes[k]; },
    matches(selector) {
      if (!selector) return false;
      const parts = selector.split(',').map((s) => s.trim());
      for (const part of parts) {
        if (part === tagName.toLowerCase() || part === tagName.toUpperCase()) return true;
        if (part === '[contenteditable="true"]' && attributes['contenteditable'] === 'true') return true;
        if (part.startsWith('ytd-searchbox') && (tagName.toLowerCase() === 'ytd-searchbox' || (attributes['id'] && attributes['id'].includes('search')))) return true;
        if (part === 'input' && tagName.toLowerCase() === 'input') return true;
        if (part === 'textarea' && tagName.toLowerCase() === 'textarea') return true;
      }
      return false;
    },
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
      if (child.parentNode && typeof child.parentNode.removeChild === 'function') {
        child.parentNode.removeChild(child);
      }
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
    querySelector(selector) {
      if (!selector) return null;
      const parts = selector.split(',').map((s) => s.trim());
      for (const part of parts) {
        const tokens = part.split(/\s+/).filter(Boolean);
        const lastToken = tokens[tokens.length - 1];

        const match = (node) => {
          if (!node) return null;
          for (const child of node.children || []) {
            let isMatch = false;
            if (lastToken.startsWith('.')) {
              isMatch = child.classList && child.classList.contains(lastToken.slice(1));
            } else if (lastToken.startsWith('#')) {
              isMatch = child.id === lastToken.slice(1);
            } else {
              isMatch = child.tagName && child.tagName.toLowerCase() === lastToken.toLowerCase();
            }
            if (isMatch) return child;
            const nested = match(child);
            if (nested) return nested;
          }
          return null;
        };

        const res = match(el);
        if (res) return res;
      }
      return null;
    }
  };
  return el;
}

// Mock document generator
function createMockDocument() {
  const root = createMockElement('html');
  const body = createMockElement('body');
  root.appendChild(body);
  const elementsById = {};

  return {
    documentElement: root,
    body: body,
    createElement: (tag) => {
      const el = createMockElement(tag);
      return el;
    },
    getElementById: (id) => {
      if (elementsById[id]) return elementsById[id];
      const search = (node) => {
        if (!node) return null;
        if (node.id === id || (node.attributes && node.attributes['id'] === id)) return node;
        for (const child of node.children || []) {
          const res = search(child);
          if (res) return res;
        }
        return null;
      };
      return search(root);
    },
    querySelector: (sel) => root.querySelector(sel),
    _registerId: (id, el) => { elementsById[id] = el; }
  };
}

(async function runAllTests() {
  console.log('Running Utubee Comprehension Tools Tests (TASK-103)...\n');

  // --------------------------------------------------------------------------
  // 1. Timestamp Formatting: mm:ss and hh:mm:ss
  // --------------------------------------------------------------------------
  test('formatTimestamp formats standard seconds to mm:ss correctly', () => {
    assert.strictEqual(engine.formatTimestamp(0), '00:00');
    assert.strictEqual(engine.formatTimestamp(5), '00:05');
    assert.strictEqual(engine.formatTimestamp(65), '01:05');
    assert.strictEqual(engine.formatTimestamp(860), '14:20');
    assert.strictEqual(engine.formatTimestamp(885), '14:45');
    assert.strictEqual(engine.formatTimestamp(3599), '59:59');
  });

  test('formatTimestamp formats hours correctly to hh:mm:ss', () => {
    assert.strictEqual(engine.formatTimestamp(3600), '01:00:00');
    assert.strictEqual(engine.formatTimestamp(3665), '01:01:05');
    assert.strictEqual(engine.formatTimestamp(7322), '02:02:02');
    assert.strictEqual(engine.formatTimestamp(36000), '10:00:00');
  });

  test('formatTimestamp gracefully handles negative, null, NaN, or non-numeric input', () => {
    assert.strictEqual(engine.formatTimestamp(-10), '00:00');
    assert.strictEqual(engine.formatTimestamp(NaN), '00:00');
    assert.strictEqual(engine.formatTimestamp(null), '00:00');
    assert.strictEqual(engine.formatTimestamp(undefined), '00:00');
    assert.strictEqual(engine.formatTimestamp('invalid'), '00:00');
  });

  // --------------------------------------------------------------------------
  // 2. Looper State Machine & Continuous Boundary Checks
  // --------------------------------------------------------------------------
  test('Looper state machine: setting point A updates state and badge', () => {
    const mockDoc = createMockDocument();
    engine.clearLoop(false, mockDoc);

    const mockVideo = {
      currentTime: 14.5,
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    engine.setLoopPointA(mockVideo, mockDoc);

    assert.strictEqual(engine._looperState.loopPointA, 14.5);
    assert.strictEqual(engine._looperState.loopPointB, null);
    assert.strictEqual(engine._looperState.isLooping, false);

    const badge = mockDoc.getElementById('utubee-loop-badge');
    assert.ok(badge, 'Badge should be created on setting point A');
    assert.ok(badge.textContent.includes('00:14 ⇄ --:--'));
  });

  test('Looper state machine: setting point B activates looping', () => {
    const mockDoc = createMockDocument();
    engine.clearLoop(false, mockDoc);

    const mockVideo = {
      currentTime: 10,
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    engine.setLoopPointA(mockVideo, mockDoc);
    mockVideo.currentTime = 25;
    engine.setLoopPointB(mockVideo, mockDoc);

    assert.strictEqual(engine._looperState.loopPointA, 10);
    assert.strictEqual(engine._looperState.loopPointB, 25);
    assert.strictEqual(engine._looperState.isLooping, true);

    const badge = mockDoc.getElementById('utubee-loop-badge');
    assert.ok(badge.textContent.includes('00:10 ⇄ 00:25'));
  });

  test('Looper state machine: setting point B when point A was unset defaults A to 0', () => {
    const mockDoc = createMockDocument();
    engine.clearLoop(false, mockDoc);

    const mockVideo = {
      currentTime: 42,
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    engine.setLoopPointB(mockVideo, mockDoc);

    assert.strictEqual(engine._looperState.loopPointA, 0);
    assert.strictEqual(engine._looperState.loopPointB, 42);
    assert.strictEqual(engine._looperState.isLooping, true);
  });

  test('Looper state machine: setting point B <= point A properly adjusts and swaps points', () => {
    const mockDoc = createMockDocument();
    engine.clearLoop(false, mockDoc);

    const mockVideo = {
      currentTime: 50,
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    // Set A at 50s
    engine.setLoopPointA(mockVideo, mockDoc);

    // Set B at 20s (less than A)
    mockVideo.currentTime = 20;
    engine.setLoopPointB(mockVideo, mockDoc);

    // Points should swap so A is 20 and B is 50
    assert.strictEqual(engine._looperState.loopPointA, 20);
    assert.strictEqual(engine._looperState.loopPointB, 50);
    assert.strictEqual(engine._looperState.isLooping, true);
  });

  test('Looper boundary check: resets video.currentTime to loopPointA when boundary reached', () => {
    const mockDoc = createMockDocument();
    engine.clearLoop(false, mockDoc);

    const mockVideo = {
      currentTime: 10,
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    engine.setLoopPointA(mockVideo, mockDoc);
    mockVideo.currentTime = 30;
    engine.setLoopPointB(mockVideo, mockDoc);

    // Within bounds: currentTime should not change
    mockVideo.currentTime = 20;
    engine.handleVideoTimeUpdate(mockVideo);
    assert.strictEqual(mockVideo.currentTime, 20);

    // Reached or exceeded loopPointB: currentTime must reset to loopPointA (10)
    mockVideo.currentTime = 30;
    engine.handleVideoTimeUpdate(mockVideo);
    assert.strictEqual(mockVideo.currentTime, 10);

    // Seeked before loopPointA - 0.5: currentTime must reset to loopPointA (10)
    mockVideo.currentTime = 5;
    engine.handleVideoTimeUpdate(mockVideo);
    assert.strictEqual(mockVideo.currentTime, 10);
  });

  test('Looper boundary check: does not alter currentTime if isLooping is false', () => {
    const mockDoc = createMockDocument();
    engine.clearLoop(false, mockDoc);

    const mockVideo = {
      currentTime: 50,
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    engine.setLoopPointA(mockVideo, mockDoc);
    // Only A set, isLooping is false
    mockVideo.currentTime = 100;
    engine.handleVideoTimeUpdate(mockVideo);
    assert.strictEqual(mockVideo.currentTime, 100);
  });

  test('Looper clearLoop resets state, removes badge, and shows toast notification', () => {
    const mockDoc = createMockDocument();
    let listenerRemoved = false;
    const mockVideo = {
      currentTime: 10,
      addEventListener: () => {},
      removeEventListener: (ev) => { if (ev === 'timeupdate') listenerRemoved = true; }
    };

    engine.setLoopPointA(mockVideo, mockDoc);
    mockVideo.currentTime = 20;
    engine.setLoopPointB(mockVideo, mockDoc);

    assert.ok(mockDoc.getElementById('utubee-loop-badge'));

    engine.clearLoop(true, mockDoc);

    assert.strictEqual(engine._looperState.loopPointA, null);
    assert.strictEqual(engine._looperState.loopPointB, null);
    assert.strictEqual(engine._looperState.isLooping, false);
    assert.strictEqual(listenerRemoved, true);
    assert.strictEqual(mockDoc.getElementById('utubee-loop-badge'), null);

    const toast = mockDoc.getElementById('utubee-toast');
    assert.ok(toast);
    assert.ok(toast.textContent.includes('Loop cleared'));
  });

  test('Looper clearLoop(false) silently clears state without toast on navigation', () => {
    const mockDoc = createMockDocument();
    const mockVideo = {
      currentTime: 10,
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    engine.setLoopPointA(mockVideo, mockDoc);
    // Remove toast created by setLoopPointA
    const priorToast = mockDoc.getElementById('utubee-toast');
    if (priorToast && priorToast.parentNode) priorToast.parentNode.removeChild(priorToast);

    engine.clearLoop(false, mockDoc);

    assert.strictEqual(engine._looperState.loopPointA, null);
    assert.strictEqual(mockDoc.getElementById('utubee-toast'), null, 'No toast should be shown when clearLoop(false)');
  });

  // --------------------------------------------------------------------------
  // 3. Keyboard Listener Input Safety Guard
  // --------------------------------------------------------------------------
  test('Keyboard safety guard ignores events originating inside inputs, textareas, search, or contenteditable', () => {
    const mockDoc = createMockDocument();
    engine.clearLoop(false, mockDoc);

    let preventDefaultCalled = false;
    const createEvent = (targetTag, targetAttrs = {}) => ({
      key: '[',
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      target: {
        tagName: targetTag.toUpperCase(),
        matches: (sel) => {
          if (sel.includes('input') && targetTag === 'input') return true;
          if (sel.includes('textarea') && targetTag === 'textarea') return true;
          if (sel.includes('contenteditable') && targetAttrs['contenteditable'] === 'true') return true;
          if (sel.includes('ytd-searchbox') && targetTag === 'ytd-searchbox') return true;
          return false;
        }
      },
      preventDefault: () => { preventDefaultCalled = true; }
    });

    // 1. Input target
    engine.handleKeyDown(createEvent('input'), mockDoc);
    assert.strictEqual(engine._looperState.loopPointA, null);
    assert.strictEqual(preventDefaultCalled, false);

    // 2. Textarea target
    engine.handleKeyDown(createEvent('textarea'), mockDoc);
    assert.strictEqual(engine._looperState.loopPointA, null);

    // 3. Contenteditable target
    engine.handleKeyDown(createEvent('div', { contenteditable: 'true' }), mockDoc);
    assert.strictEqual(engine._looperState.loopPointA, null);

    // 4. YouTube searchbox target
    engine.handleKeyDown(createEvent('ytd-searchbox'), mockDoc);
    assert.strictEqual(engine._looperState.loopPointA, null);
  });

  // --------------------------------------------------------------------------
  // 4. Keyboard Shortcut Routing
  // --------------------------------------------------------------------------
  test('Keyboard shortcut routing triggers loop point A on [', () => {
    const mockDoc = createMockDocument();
    engine.clearLoop(false, mockDoc);
    engine._setCurrentSettings({ extensionEnabled: true, abLooperEnabled: true });

    const playerContainer = mockDoc.createElement('div');
    playerContainer.setAttribute('class', 'html5-video-player');
    const mockVideo = mockDoc.createElement('video');
    mockVideo.currentTime = 12.3;
    playerContainer.appendChild(mockVideo);
    mockDoc.body.appendChild(playerContainer);

    let prevented = false;
    engine.handleKeyDown({
      key: '[',
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      target: mockDoc.body,
      preventDefault: () => { prevented = true; }
    }, mockDoc);

    assert.strictEqual(prevented, true);
    assert.strictEqual(engine._looperState.loopPointA, 12.3);
  });

  test('Keyboard shortcut routing triggers loop point B on ]', () => {
    const mockDoc = createMockDocument();
    engine.clearLoop(false, mockDoc);
    engine._setCurrentSettings({ extensionEnabled: true, abLooperEnabled: true });

    const playerContainer = mockDoc.createElement('div');
    playerContainer.setAttribute('class', 'html5-video-player');
    const mockVideo = mockDoc.createElement('video');
    mockVideo.currentTime = 45.6;
    playerContainer.appendChild(mockVideo);
    mockDoc.body.appendChild(playerContainer);

    let prevented = false;
    engine.handleKeyDown({
      key: ']',
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      target: mockDoc.body,
      preventDefault: () => { prevented = true; }
    }, mockDoc);

    assert.strictEqual(prevented, true);
    assert.strictEqual(engine._looperState.loopPointB, 45.6);
    assert.strictEqual(engine._looperState.isLooping, true);
  });

  test('Keyboard shortcut routing clears active loop on Backslash or Escape', () => {
    const mockDoc = createMockDocument();
    engine._setCurrentSettings({ extensionEnabled: true, abLooperEnabled: true });

    // Activate a loop first
    engine._looperState.loopPointA = 10;
    engine._looperState.loopPointB = 20;
    engine._looperState.isLooping = true;

    // Test '\'
    let preventedSlash = false;
    engine.handleKeyDown({
      key: '\\',
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      target: mockDoc.body,
      preventDefault: () => { preventedSlash = true; }
    }, mockDoc);

    assert.strictEqual(preventedSlash, true);
    assert.strictEqual(engine._looperState.isLooping, false);

    // Re-activate and test 'Escape' (Must NOT preventDefault, to allow browser to exit fullscreen)
    engine._looperState.loopPointA = 10;
    engine._looperState.loopPointB = 20;
    engine._looperState.isLooping = true;

    let preventedEsc = false;
    engine.handleKeyDown({
      key: 'Escape',
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      target: mockDoc.body,
      preventDefault: () => { preventedEsc = true; }
    }, mockDoc);

    assert.strictEqual(preventedEsc, false, 'Escape key must not call preventDefault so native fullscreen exit works');
    assert.strictEqual(engine._looperState.isLooping, false);
  });

  test('Keyboard listener strictly ignores YouTube captions key c', () => {
    const mockDoc = createMockDocument();
    let prevented = false;

    // Press 'c'
    engine.handleKeyDown({
      key: 'c',
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      target: mockDoc.body,
      preventDefault: () => { prevented = true; }
    }, mockDoc);

    // Press 'C'
    engine.handleKeyDown({
      key: 'C',
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      target: mockDoc.body,
      preventDefault: () => { prevented = true; }
    }, mockDoc);

    assert.strictEqual(prevented, false, 'Key c must NEVER be intercepted or prevented (reserved for captions)');
  });

  test('Keyboard shortcuts ignored when extensionEnabled or feature flag is disabled', () => {
    const mockDoc = createMockDocument();
    engine.clearLoop(false, mockDoc);
    engine._setCurrentSettings({ extensionEnabled: false, abLooperEnabled: true });

    let prevented = false;
    engine.handleKeyDown({
      key: '[',
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      target: mockDoc.body,
      preventDefault: () => { prevented = true; }
    }, mockDoc);

    assert.strictEqual(prevented, false);
    assert.strictEqual(engine._looperState.loopPointA, null);
  });

  // --------------------------------------------------------------------------
  // 5. Slide Capture Logic & Clipboard Interaction
  // --------------------------------------------------------------------------
  await testAsync('Slide capture grabs frame at native video resolution and writes to clipboard', async () => {
    const mockDoc = createMockDocument();
    let drawn = null;
    let writtenItems = null;

    // Mock video with 1920x1080 native resolution
    const mockVideo = {
      videoWidth: 1920,
      videoHeight: 1080
    };

    // Mock canvas context
    const mockCtx = {
      drawImage: (v, x, y, w, h) => {
        drawn = { v, x, y, w, h };
      }
    };

    // Override mockDoc.createElement for canvas
    const origCreateElement = mockDoc.createElement;
    mockDoc.createElement = (tag) => {
      if (tag === 'canvas') {
        const canvas = origCreateElement(tag);
        canvas.getContext = (type) => (type === '2d' ? mockCtx : null);
        canvas.toBlob = (callback, mime) => {
          callback({ size: 12345, type: mime });
        };
        return canvas;
      }
      return origCreateElement(tag);
    };

    // Mock clipboard
    const mockClipboard = {
      write: async (items) => {
        writtenItems = items;
      }
    };

    // Global mock for ClipboardItem
    global.ClipboardItem = class MockClipboardItem {
      constructor(data) {
        this.data = data;
      }
    };

    const result = await engine.captureSlideFrame(mockVideo, mockDoc, mockClipboard);

    assert.strictEqual(result.success, true);
    assert.ok(drawn);
    assert.strictEqual(drawn.w, 1920);
    assert.strictEqual(drawn.h, 1080);
    assert.ok(writtenItems);
    assert.strictEqual(writtenItems.length, 1);
    assert.ok(writtenItems[0].data['image/png']);

    const toast = mockDoc.getElementById('utubee-toast');
    assert.ok(toast);
    assert.ok(toast.textContent.includes('Slide copied to clipboard'));
  });

  await testAsync('Slide capture gracefully displays error toast if video is missing or dimensions are 0', async () => {
    const mockDoc = createMockDocument();
    const result = await engine.captureSlideFrame(null, mockDoc);

    assert.strictEqual(result.success, false);
    const toast = mockDoc.getElementById('utubee-toast');
    assert.ok(toast);
    assert.ok(toast.classList.contains('utubee-toast-error'));
  });

  // --------------------------------------------------------------------------
  // 6. Toast & Loop Badge DOM Lifecycle
  // --------------------------------------------------------------------------
  test('showToast creates self-dismissing HUD element with correct accessibility attributes', () => {
    const mockDoc = createMockDocument();
    const toast = engine.showToast('Test Toast Notification', false, mockDoc);

    assert.ok(toast);
    assert.strictEqual(toast.id, 'utubee-toast');
    assert.strictEqual(toast.getAttribute('role'), 'status');
    assert.strictEqual(toast.getAttribute('aria-live'), 'polite');
    assert.strictEqual(toast.textContent, 'Test Toast Notification');
    assert.ok(toast.classList.contains('utubee-toast-visible'));
    assert.strictEqual(toast.classList.contains('utubee-toast-error'), false);
  });

  test('updateLoopBadge and removeLoopBadge lifecycle', () => {
    const mockDoc = createMockDocument();
    const badge = engine.updateLoopBadge('[01:15 ⇄ 01:45]', mockDoc);

    assert.ok(badge);
    assert.strictEqual(badge.id, 'utubee-loop-badge');
    assert.ok(badge.textContent.includes('[01:15 ⇄ 01:45]'));

    // Update text
    engine.updateLoopBadge('[02:00 ⇄ 02:30]', mockDoc);
    assert.ok(badge.textContent.includes('[02:00 ⇄ 02:30]'));

    // Remove badge
    engine.removeLoopBadge(mockDoc);
    assert.strictEqual(mockDoc.getElementById('utubee-loop-badge'), null);
  });

  // --------------------------------------------------------------------------
  // 7. CSS Invariant Verification for Comprehension Tools
  // --------------------------------------------------------------------------
  test('styles.css contains craft-grade toast and looper badge styles with reduced motion support', () => {
    const cssPath = path.join(__dirname, '../content/styles.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    // Toast checks
    assert.ok(css.includes('#utubee-toast'), 'Toast ID selector missing');
    assert.ok(css.includes('.utubee-toast-visible'), 'Toast visibility class missing');
    assert.ok(css.includes('.utubee-toast-error'), 'Toast error class missing');
    assert.ok(css.includes('z-index: 9999999'), 'Toast high z-index missing');
    assert.ok(css.includes('pointer-events: none'), 'Toast pointer-events: none missing');

    // Badge checks
    assert.ok(css.includes('#utubee-loop-badge'), 'Loop badge selector missing');
    assert.ok(css.includes('tabular-nums'), 'Tabular numerals missing from badge');
    assert.ok(css.includes('.utubee-loop-badge-dot'), 'Loop badge dot indicator missing');
    assert.ok(css.includes('@keyframes utubee-pulse'), 'Pulse animation missing');

    // Motion preference check
    assert.ok(css.includes('prefers-reduced-motion'), 'prefers-reduced-motion block missing');
  });

  console.log(`\nAll ${testsPassed} comprehension tools assertions passed successfully!`);
})();
