/**
 * Utubee-Thumbnail Engine Unit & Smoke Tests
 * Verifies URL extraction, milestone formatting, shorts exclusion, live detection, and restoration.
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
    console.error(err);
    process.exit(1);
  }
}

console.log('Running Utubee Thumbnail Engine Tests...\n');

// 1. Milestone URL Generation
test('getThumbnailUrl formats correct milestone URLs', () => {
  const id = 'dQw4w9WgXcQ';
  assert.strictEqual(engine.getThumbnailUrl(id, 'hq1'), 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hq1.jpg');
  assert.strictEqual(engine.getThumbnailUrl(id, 'hq2'), 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hq2.jpg');
  assert.strictEqual(engine.getThumbnailUrl(id, 'hq3'), 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hq3.jpg');
  // Fallback to hq2 on invalid or unknown milestone
  assert.strictEqual(engine.getThumbnailUrl(id, 'invalid'), 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hq2.jpg');
  assert.strictEqual(engine.getThumbnailUrl(id, null), 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hq2.jpg');
});

// 2. Shorts URL Detection
test('isShortsUrl identifies Shorts vs standard videos', () => {
  assert.strictEqual(engine.isShortsUrl('/shorts/abcdefghijk'), true);
  assert.strictEqual(engine.isShortsUrl('https://www.youtube.com/shorts/abcdefghijk'), true);
  assert.strictEqual(engine.isShortsUrl('/watch?v=abcdefghijk'), false);
  assert.strictEqual(engine.isShortsUrl(null), false);
  assert.strictEqual(engine.isShortsUrl(''), false);
});

// 3. Video ID Extraction
test('extractVideoId handles standard watch URLs and query parameter variations', () => {
  assert.strictEqual(engine.extractVideoId('/watch?v=dQw4w9WgXcQ', null), 'dQw4w9WgXcQ');
  assert.strictEqual(
    engine.extractVideoId('https://www.youtube.com/watch?feature=shared&v=jNQXAC9IVRw&t=30', null),
    'jNQXAC9IVRw'
  );
  assert.strictEqual(engine.extractVideoId('/watch?v=_a-12345678', null), '_a-12345678');
});

test('extractVideoId falls back to image src when anchor is absent or incomplete', () => {
  assert.strictEqual(
    engine.extractVideoId(null, 'https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg'),
    'aqz-KE-bpKQ'
  );
  assert.strictEqual(
    engine.extractVideoId(null, 'https://i.ytimg.com/vi_webp/aqz-KE-bpKQ/maxresdefault.webp'),
    'aqz-KE-bpKQ'
  );
});

test('extractVideoId excludes Shorts and returns null', () => {
  assert.strictEqual(engine.extractVideoId('/shorts/12345678901', null), null);
  assert.strictEqual(engine.extractVideoId(null, 'https://i.ytimg.com/shorts/12345678901'), null);
});

test('extractVideoId handles empty or null inputs gracefully', () => {
  assert.strictEqual(engine.extractVideoId(null, null), null);
  assert.strictEqual(engine.extractVideoId('', ''), null);
  assert.strictEqual(engine.extractVideoId('/feed/subscriptions', null), null);
});

// 4. Live Stream & Premiere Detection
test('isLiveOrUpcoming detects live and premiere badges accurately', () => {
  // Mock element query selector helpers
  function createMockCard({ overlayStyle, badgeClass, badgeText, ariaLabel }) {
    return {
      querySelector: (selector) => {
        if (overlayStyle && selector.includes(`overlay-style="${overlayStyle}"`)) {
          return {};
        }
        if (badgeClass && selector.includes(badgeClass)) {
          return {};
        }
        return null;
      },
      querySelectorAll: () => {
        if (badgeText || ariaLabel) {
          return [
            {
              textContent: badgeText || '',
              getAttribute: (attr) => (attr === 'aria-label' ? ariaLabel : null)
            }
          ];
        }
        return [];
      }
    };
  }

  // Live overlay badge
  const liveOverlayCard = createMockCard({ overlayStyle: 'LIVE' });
  assert.strictEqual(engine.isLiveOrUpcoming(liveOverlayCard), true);

  // Upcoming overlay badge
  const upcomingOverlayCard = createMockCard({ overlayStyle: 'UPCOMING' });
  assert.strictEqual(engine.isLiveOrUpcoming(upcomingOverlayCard), true);

  // Class marker live
  const liveClassCard = createMockCard({ badgeClass: '.badge-style-type-live-now' });
  assert.strictEqual(engine.isLiveOrUpcoming(liveClassCard), true);

  // Text marker PREMIERE
  const premiereTextCard = createMockCard({ badgeText: 'PREMIERE' });
  assert.strictEqual(engine.isLiveOrUpcoming(premiereTextCard), true);

  // Text marker Premieres in 2 hours
  const premieresTextCard = createMockCard({ badgeText: 'Premieres in 2 hours' });
  assert.strictEqual(engine.isLiveOrUpcoming(premieresTextCard), true);

  // Standard video card with normal timestamp (e.g. 15:42)
  const regularCard = createMockCard({ badgeText: '15:42' });
  assert.strictEqual(engine.isLiveOrUpcoming(regularCard), false);

  // Null/empty card or missing querySelectorAll
  assert.strictEqual(engine.isLiveOrUpcoming(null), false);
  assert.strictEqual(engine.isLiveOrUpcoming({ querySelector: () => null }), false);
});

// 5. Image Swapping and 404 Recovery Fallback
test('swapThumbnailImage updates src, clears srcset, preserves originals, and handles onerror', () => {
  // Mock Image Element
  const mockImg = {
    src: 'https://i.ytimg.com/vi/testId12345/hqdefault.jpg',
    srcset: 'https://i.ytimg.com/vi/testId12345/hqdefault.jpg 1x',
    attributes: {},
    setAttribute(k, v) { this.attributes[k] = String(v); },
    getAttribute(k) { return this.attributes[k] || null; },
    hasAttribute(k) { return k in this.attributes; },
    removeAttribute(k) { delete this.attributes[k]; }
  };

  // Perform swap to hq2
  engine.swapThumbnailImage(mockImg, 'testId12345', 'hq2');

  assert.strictEqual(mockImg.src, 'https://i.ytimg.com/vi/testId12345/hq2.jpg');
  assert.strictEqual(mockImg.srcset, '');
  assert.strictEqual(mockImg.getAttribute('data-utubee-swapped'), 'true');
  assert.strictEqual(mockImg.getAttribute('data-utubee-milestone'), 'hq2');
  assert.strictEqual(mockImg.getAttribute('data-utubee-orig-src'), 'https://i.ytimg.com/vi/testId12345/hqdefault.jpg');
  assert.strictEqual(mockImg.getAttribute('data-utubee-orig-srcset'), 'https://i.ytimg.com/vi/testId12345/hqdefault.jpg 1x');
  assert.strictEqual(typeof mockImg.onerror, 'function');

  // Trigger error fallback (e.g. 404 ungenerated milestone frame)
  mockImg.onerror();

  assert.strictEqual(mockImg.src, 'https://i.ytimg.com/vi/testId12345/hqdefault.jpg');
  assert.strictEqual(mockImg.srcset, 'https://i.ytimg.com/vi/testId12345/hqdefault.jpg 1x');
  assert.strictEqual(mockImg.getAttribute('data-utubee-swapped'), null);
  assert.strictEqual(mockImg.getAttribute('data-utubee-failed'), 'true');
});

// 6. Milestone Fallback in origSrc
test('swapThumbnailImage falls back to hqdefault when existing src is already a milestone or empty', () => {
  const mockImg = {
    src: 'https://i.ytimg.com/vi/testId12345/hq2.jpg',
    attributes: {},
    setAttribute(k, v) { this.attributes[k] = String(v); },
    getAttribute(k) { return this.attributes[k] || null; },
    hasAttribute(k) { return k in this.attributes; },
    removeAttribute(k) { delete this.attributes[k]; }
  };

  engine.swapThumbnailImage(mockImg, 'testId12345', 'hq3');
  assert.strictEqual(
    mockImg.getAttribute('data-utubee-orig-src'),
    'https://i.ytimg.com/vi/testId12345/hqdefault.jpg'
  );
});

// 7. CARD_SELECTORS and processCard checks
test('CARD_SELECTORS excludes ytd-rich-grid-media to prevent double scanning', () => {
  assert.strictEqual(engine.CARD_SELECTORS.includes('ytd-rich-grid-media'), false);
  assert.strictEqual(engine.CARD_SELECTORS.includes('ytd-rich-item-renderer'), true);
});

test('processCard early-exits when card is already at target milestone and skips avatars', () => {
  let queriedSelector = '';
  const cardAttributes = {
    'data-utubee-milestone': 'hq2'
  };

  const mockCard = {
    getAttribute: (k) => cardAttributes[k] || null,
    setAttribute: (k, v) => { cardAttributes[k] = String(v); },
    querySelector: (sel) => {
      queriedSelector = sel;
      return null;
    },
    querySelectorAll: () => []
  };

  // Calling processCard with 'hq2' should early-exit without querying image
  engine.processCard(mockCard, 'hq2');
  assert.strictEqual(queriedSelector, '');

  // Calling with 'hq3' should execute selector query restricted to thumbnail containers
  engine.processCard(mockCard, 'hq3');
  assert.strictEqual(queriedSelector, 'ytd-thumbnail img, yt-image img, #thumbnail img');
});

console.log(`\nAll ${testsPassed} unit assertions passed successfully!`);
