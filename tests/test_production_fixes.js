/**
 * Utubee Production Fixes Reproduction & Verification Suite (TASK-107)
 * Proves bug reproduction (RED) and verifies surgical fixes (GREEN) for:
 * 1. Virtual DOM node recycling & hover preview re-swap
 * 2. Mid-roll ad playback protection (no seek freezing)
 * 3. Escape key unblocked (fullscreen exit preserved)
 * 4. Shadow DOM composedPath input isolation
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

console.log('Running Utubee Production Fixes Tests (TASK-107)...\n');

// --------------------------------------------------------------------------
// 1. Virtual DOM Node Recycling & Hover Preview Test
// --------------------------------------------------------------------------
test('Card node recycling swaps thumbnail when video ID changes on same card', () => {
  const cardAttributes = {
    'data-utubee-milestone': 'hq2',
    'data-utubee-video-id': 'videoAAAAAA'
  };

  const img = {
    src: 'https://i.ytimg.com/vi/videoBBBBBB/hqdefault.jpg',
    attributes: {},
    setAttribute(k, v) { this.attributes[k] = String(v); },
    getAttribute(k) { return this.attributes[k] || null; },
    hasAttribute(k) { return k in this.attributes; },
    removeAttribute(k) { delete this.attributes[k]; }
  };

  const anchor = {
    getAttribute(k) { return k === 'href' ? '/watch?v=videoBBBBBB' : null; }
  };

  const mockCard = {
    getAttribute(k) { return cardAttributes[k] || null; },
    setAttribute(k, v) { cardAttributes[k] = String(v); },
    querySelector(sel) {
      if (sel.includes('img')) return img;
      if (sel.includes('a#thumbnail') || sel.includes('/watch?v=')) return anchor;
      return null;
    },
    querySelectorAll() { return []; }
  };

  // Process card with new video videoBBBBBB
  engine.processCard(mockCard, 'hq2');

  assert.strictEqual(
    cardAttributes['data-utubee-video-id'],
    'videoBBBBBB',
    'Card video ID must update to new recycled video ID'
  );
  assert.strictEqual(
    img.src,
    'https://i.ytimg.com/vi/videoBBBBBB/hq2.jpg',
    'Thumbnail image must swap to new video milestone frame'
  );
});

// --------------------------------------------------------------------------
// 2. Mid-roll Ad Playback Protection Test
// --------------------------------------------------------------------------
test('A-B looper ignores playback and does not seek during mid-roll ads', () => {
  engine._looperState.loopPointA = 300;
  engine._looperState.loopPointB = 360;
  engine._looperState.isLooping = true;

  let currentTime = 10; // Ad started at t=10s, normally loop would seek back to 300!
  const mockVideo = {
    get currentTime() { return currentTime; },
    set currentTime(t) { currentTime = t; },
    closest(sel) {
      if (sel.includes('ad-showing') || sel.includes('ad-interrupting')) {
        return {}; // Ad container active
      }
      return null;
    }
  };

  engine.handleVideoTimeUpdate(mockVideo);

  assert.strictEqual(
    currentTime,
    10,
    'Video currentTime must NOT be altered while advertisement is showing'
  );

  // Clean up
  engine.clearLoop(false);
});

// --------------------------------------------------------------------------
// 3. Escape Key Fullscreen Unblock Test
// --------------------------------------------------------------------------
test('Escape key clears loop WITHOUT calling preventDefault', () => {
  engine._looperState.loopPointA = 60;
  engine._looperState.loopPointB = 120;
  engine._looperState.isLooping = true;

  let preventDefaultCalled = false;
  const mockEvent = {
    key: 'Escape',
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    target: { matches: () => false, closest: () => false },
    preventDefault() { preventDefaultCalled = true; }
  };

  engine.handleKeyDown(mockEvent);

  assert.strictEqual(
    preventDefaultCalled,
    false,
    'preventDefault must NOT be called on Escape key (allows browser to exit fullscreen)'
  );
  assert.strictEqual(
    engine._looperState.isLooping,
    false,
    'Active loop should be cleared on Escape'
  );
});

// --------------------------------------------------------------------------
// 4. Shadow DOM Event Retargeting Test
// --------------------------------------------------------------------------
test('Keyboard handler respects inputs deeply nested inside Shadow DOM (composedPath)', () => {
  engine._looperState.loopPointA = null;
  engine._looperState.loopPointB = null;
  engine._looperState.isLooping = false;

  // e.target is the custom element host <ytd-searchbox>, but actual focused element in shadow DOM is <input>
  const shadowInput = {
    tagName: 'INPUT',
    isContentEditable: false,
    matches: (sel) => sel.includes('input')
  };

  const hostElement = {
    tagName: 'YTD-SEARCHBOX',
    isContentEditable: false,
    matches: () => false,
    closest: () => false
  };

  let preventDefaultCalled = false;
  const mockEvent = {
    key: '[',
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    target: hostElement, // Retargeted by browser
    composedPath: () => [shadowInput, hostElement], // True path through shadow root
    preventDefault() { preventDefaultCalled = true; }
  };

  engine.handleKeyDown(mockEvent);

  assert.strictEqual(
    preventDefaultCalled,
    false,
    'Hotkeys must NOT fire when user is typing in a Shadow DOM input'
  );
  assert.strictEqual(
    engine._looperState.loopPointA,
    null,
    'Loop Point A must not be set while typing in Shadow DOM'
  );
});

console.log(`\nAll ${testsPassed} production fixes assertions passed!`);
