/**
 * Utubee Scroll Performance & Zero-Flicker Reproduction & Verification Tests
 * Verifies:
 * 1. swapThumbnailImage sets data-utubee-loading and locks srcset descriptor
 * 2. processCard O(1) fast-path on already-swapped cards
 * 3. MutationObserver attributes filter handling
 * 4. CSS zero-flicker rules for loading and unswapped thumbnails
 * 5. restoreAllThumbnails cleans up loading state and unlocks srcset
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
    console.error(err.message);
    throw err;
  }
}

console.log('Running Utubee Scroll Performance & Zero-Flicker Tests...\n');

// --------------------------------------------------------------------------
// 1. swapThumbnailImage: data-utubee-loading and srcset descriptor lock
// --------------------------------------------------------------------------
test('swapThumbnailImage locks srcset and marks data-utubee-loading until loaded', () => {
  let loaded = false;
  const attributes = {};

  const mockImg = {
    src: 'https://i.ytimg.com/vi/oldVideo123/hqdefault.jpg',
    srcset: 'https://i.ytimg.com/vi/oldVideo123/hq720.jpg 1x, https://i.ytimg.com/vi/oldVideo123/maxres.jpg 2x',
    complete: false,
    setAttribute(k, v) { attributes[k] = String(v); },
    getAttribute(k) { return attributes[k] || null; },
    hasAttribute(k) { return k in attributes; },
    removeAttribute(k) { delete attributes[k]; }
  };

  engine.swapThumbnailImage(mockImg, 'newVideo456', 'hq2');

  // Verify loading state is active while complete is false
  assert.strictEqual(
    mockImg.getAttribute('data-utubee-loading'),
    'true',
    'Image must have data-utubee-loading="true" while fetching milestone frame'
  );

  // Verify srcset is cleared and locked against YouTube overrides
  assert.strictEqual(mockImg.srcset, '', 'srcset must be empty string');
  mockImg.srcset = 'https://i.ytimg.com/vi/newVideo456/hq720.jpg 1x';
  assert.strictEqual(
    mockImg.srcset,
    '',
    'srcset setter must be locked to prevent YouTube lazy-loader from resurrecting clickbait'
  );

  // Trigger load event
  if (typeof mockImg.onload === 'function') {
    mockImg.onload();
  }
  assert.strictEqual(
    mockImg.getAttribute('data-utubee-loading'),
    null,
    'data-utubee-loading must be removed once milestone image finishes loading'
  );
});

// --------------------------------------------------------------------------
// 2. processCard O(1) Fast-Path on already-swapped cards
// --------------------------------------------------------------------------
test('processCard uses O(1) fast-path on already swapped cards without running expensive queries', () => {
  let isLiveOrUpcomingQueried = false;
  const cardAttributes = {
    'data-utubee-card-active': 'true',
    'data-utubee-video-id': 'vidFast123',
    'data-utubee-milestone': 'hq2'
  };

  const mockImg = {
    src: 'https://i.ytimg.com/vi/vidFast123/hq2.jpg',
    attributes: { 'data-utubee-swapped': 'true' },
    getAttribute(k) { return this.attributes[k] || null; },
    setAttribute(k, v) { this.attributes[k] = String(v); },
    hasAttribute(k) { return k in this.attributes; },
    removeAttribute(k) { delete this.attributes[k]; }
  };

  const mockAnchor = {
    getAttribute(k) { return k === 'href' ? '/watch?v=vidFast123' : null; }
  };

  const mockCard = {
    getAttribute(k) { return cardAttributes[k] || null; },
    setAttribute(k, v) { cardAttributes[k] = String(v); },
    querySelector(sel) {
      if (sel.includes('overlay-style') || sel.includes('badge-style')) {
        isLiveOrUpcomingQueried = true;
      }
      if (sel.includes('img')) return mockImg;
      if (sel.includes('a.ytLockupViewModelContentImage') || sel.includes('a#thumbnail') || sel.includes('/watch')) return mockAnchor;
      return null;
    },
    querySelectorAll(sel) {
      if (sel.includes('badge')) {
        isLiveOrUpcomingQueried = true;
      }
      return [];
    }
  };

  engine.processCard(mockCard, 'hq2');

  assert.strictEqual(
    isLiveOrUpcomingQueried,
    false,
    'processCard must fast-path exit without running live badge queries on already swapped cards'
  );
});

// --------------------------------------------------------------------------
// 3. handleMutationRecords attributeFilter & scan gating
// --------------------------------------------------------------------------
test('handleMutationRecords triggers scan on href/src mutations but filters redundant self-mutations', () => {
  let scanScheduled = false;
  const mockScheduleScan = () => { scanScheduled = true; };

  // 1. href attribute mutation on anchor should trigger scan
  scanScheduled = false;
  engine.handleMutationRecords([
    {
      type: 'attributes',
      attributeName: 'href',
      target: { getAttribute: () => '/watch?v=newVid999' }
    }
  ], mockScheduleScan);
  assert.strictEqual(scanScheduled, true, 'href mutation must trigger scan');

  // 2. src attribute mutation on unswapped image should trigger scan
  scanScheduled = false;
  engine.handleMutationRecords([
    {
      type: 'attributes',
      attributeName: 'src',
      target: {
        src: 'https://i.ytimg.com/vi/abc/hq720.jpg',
        getAttribute: (k) => (k === 'data-utubee-swapped' ? null : null)
      }
    }
  ], mockScheduleScan);
  assert.strictEqual(scanScheduled, true, 'src mutation on unswapped image must trigger scan');

  // 3. src attribute mutation on already swapped image should NOT trigger redundant scan
  scanScheduled = false;
  engine.handleMutationRecords([
    {
      type: 'attributes',
      attributeName: 'src',
      target: {
        src: 'https://i.ytimg.com/vi/abc/hq2.jpg',
        getAttribute: (k) => (k === 'data-utubee-swapped' ? 'true' : null)
      }
    }
  ], mockScheduleScan);
  assert.strictEqual(scanScheduled, false, 'Self-induced src swap must not re-trigger scheduleScan loop');
});

// --------------------------------------------------------------------------
// 4. CSS Zero-Flicker Shield Rules
// --------------------------------------------------------------------------
test('styles.css contains declarative zero-flicker shield rules for loading and unswapped thumbnails', () => {
  const cssPath = path.join(__dirname, '../content/styles.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  // Verify loading state hides image
  assert.ok(
    css.includes('img[data-utubee-loading="true"]'),
    'CSS must style img[data-utubee-loading="true"]'
  );
  assert.ok(
    css.includes('data-utubee-live'),
    'CSS must explicitly preserve live streams and bypass hiding'
  );
  assert.ok(
    css.includes('opacity: 0') || css.includes('opacity:0'),
    'CSS must hide unswapped/loading thumbnails to prevent clickbait flash'
  );
});

// --------------------------------------------------------------------------
// 5. restoreAllThumbnails Lifecycle Cleanup
// --------------------------------------------------------------------------
test('restoreAllThumbnails unlocks srcset, removes loading attributes, and restores originals', () => {
  const imgAttributes = {
    'data-utubee-swapped': 'true',
    'data-utubee-loading': 'true',
    'data-utubee-orig-src': 'https://i.ytimg.com/vi/origId/hqdefault.jpg',
    'data-utubee-orig-srcset': 'https://i.ytimg.com/vi/origId/hq720.jpg 1x'
  };

  const mockImg = {
    src: 'https://i.ytimg.com/vi/origId/hq2.jpg',
    srcset: '',
    attributes: imgAttributes,
    getAttribute(k) { return this.attributes[k] || null; },
    setAttribute(k, v) { this.attributes[k] = String(v); },
    hasAttribute(k) { return k in this.attributes; },
    removeAttribute(k) { delete this.attributes[k]; }
  };

  // Lock srcset descriptor as swapThumbnailImage does
  Object.defineProperty(mockImg, 'srcset', {
    get: () => '',
    set: () => {},
    configurable: true
  });

  const cardAttributes = {
    'data-utubee-card-active': 'true',
    'data-utubee-milestone': 'hq2',
    'data-utubee-video-id': 'origId'
  };

  const mockCard = {
    attributes: cardAttributes,
    getAttribute(k) { return this.attributes[k] || null; },
    setAttribute(k, v) { this.attributes[k] = String(v); },
    removeAttribute(k) { delete this.attributes[k]; }
  };

  // Provide mock document
  global.document = {
    querySelectorAll(sel) {
      if (sel.includes('data-utubee-swapped') || sel.includes('data-utubee-loading')) {
        return [mockImg];
      }
      if (sel.includes('data-utubee-card-active')) {
        return [mockCard];
      }
      return [];
    }
  };

  engine.restoreAllThumbnails();

  assert.strictEqual(mockImg.src, 'https://i.ytimg.com/vi/origId/hqdefault.jpg');
  assert.strictEqual(mockImg.srcset, 'https://i.ytimg.com/vi/origId/hq720.jpg 1x');
  assert.strictEqual(mockImg.getAttribute('data-utubee-swapped'), null);
  assert.strictEqual(mockImg.getAttribute('data-utubee-loading'), null);
  assert.strictEqual(mockCard.getAttribute('data-utubee-card-active'), null);

  // Clean up global document mock
  delete global.document;
});

console.log(`\nAll ${testsPassed} scroll performance assertions passed!`);
