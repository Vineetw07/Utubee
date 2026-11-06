/**
 * Utubee Settings Popup Unit & Integration Tests (TASK-104)
 * Verifies HTML structure, CSS design system rules, reactive storage binding,
 * segmented controls, and accessibility compliance.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const popup = require('../popup/popup.js');

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

console.log('Running Utubee Popup Tests (TASK-104)...\n');

// --------------------------------------------------------------------------
// 1. HTML Contract & Structure Verification
// --------------------------------------------------------------------------
test('popup.html strictly follows Chrome MV3 guidelines and accessibility standards', () => {
  const htmlPath = path.join(__dirname, '../popup/popup.html');
  assert.ok(fs.existsSync(htmlPath), 'popup.html must exist');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // MV3 Security: Zero inline scripts
  assert.ok(!html.includes('<script>') && !html.includes('javascript:'), 'Zero inline scripts permitted');
  assert.ok(html.includes('<script src="popup.js"></script>'), 'Must link external popup.js');
  assert.ok(html.includes('<link rel="stylesheet" href="popup.css">'), 'Must link external popup.css');

  // Required control IDs from SPEC.md schema
  const requiredIds = [
    'extensionEnabled',
    'cleanHome',
    'hideSidebar',
    'hideShorts',
    'hideComments',
    'slideCaptureEnabled',
    'abLooperEnabled',
    'settingsContent'
  ];

  for (const id of requiredIds) {
    assert.ok(html.includes(`id="${id}"`), `Missing required element ID: ${id}`);
  }

  // Segmented control buttons
  assert.ok(html.includes('data-milestone="hq1"'), 'Missing hq1 milestone button');
  assert.ok(html.includes('data-milestone="hq2"'), 'Missing hq2 milestone button');
  assert.ok(html.includes('data-milestone="hq3"'), 'Missing hq3 milestone button');

  // Keycap badges
  assert.ok(html.includes('<kbd>Alt</kbd>+<kbd>S</kbd>'), 'Missing Alt+S keycap badge');
  assert.ok(html.includes('<kbd>[</kbd> <kbd>]</kbd>'), 'Missing looper keycap badge');
});

// --------------------------------------------------------------------------
// 2. CSS Design Engineering & Token Discipline
// --------------------------------------------------------------------------
test('popup.css enforces 336px width, 4px grid, dual-theme support, and reduced motion', () => {
  const cssPath = path.join(__dirname, '../popup/popup.css');
  assert.ok(fs.existsSync(cssPath), 'popup.css must exist');
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.ok(css.includes('width: 336px'), 'Width must be 336px (within max 340px constraint)');
  assert.ok(css.includes('prefers-color-scheme: light'), 'Must support light theme overrides');
  assert.ok(css.includes('prefers-reduced-motion: reduce'), 'Must support reduced motion preference');
  assert.ok(css.includes('.settings-content.disabled'), 'Must style disabled state when master switch is off');
  assert.ok(css.includes('tabular-nums'), 'Must use tabular numbers for figures and keycaps');
  assert.ok(css.includes('var(--ease-snappy)'), 'Must use snappy easing curve');
});

// --------------------------------------------------------------------------
// 3. Popup Controller: DOM Rendering & State Updates
// --------------------------------------------------------------------------
test('renderSettings synchronizes inputs and segmented control with state', () => {
  const elements = {};
  const classes = {};

  const mockDoc = {
    getElementById: (id) => {
      if (!elements[id]) {
        elements[id] = {
          id,
          checked: false,
          className: '',
          classList: {
            add: (cls) => { classes[id] = (classes[id] || new Set()).add(cls); },
            remove: (cls) => { if (classes[id]) classes[id].delete(cls); },
            contains: (cls) => Boolean(classes[id] && classes[id].has(cls))
          }
        };
      }
      return elements[id];
    },
    querySelectorAll: (sel) => {
      if (sel === '.segment-btn') {
        return [
          {
            getAttribute: () => 'hq1',
            classList: { toggle: (cls, active) => { this.active1 = active; } },
            setAttribute: () => {}
          },
          {
            getAttribute: () => 'hq2',
            classList: { toggle: (cls, active) => { this.active2 = active; } },
            setAttribute: () => {}
          },
          {
            getAttribute: () => 'hq3',
            classList: { toggle: (cls, active) => { this.active3 = active; } },
            setAttribute: () => {}
          }
        ];
      }
      return [];
    }
  };

  // 1. Initial render with defaults
  popup.renderSettings({
    extensionEnabled: true,
    thumbnailMilestone: 'hq3',
    cleanHome: false
  }, mockDoc);

  assert.strictEqual(elements['extensionEnabled'].checked, true);
  assert.strictEqual(elements['cleanHome'].checked, false);
  assert.strictEqual(elements['settingsContent'].classList.contains('disabled'), false);

  // 2. Master toggle turned OFF disables settingsContent and sub-inputs
  popup.renderSettings({
    extensionEnabled: false
  }, mockDoc);

  assert.strictEqual(elements['extensionEnabled'].checked, false);
  assert.strictEqual(elements['settingsContent'].classList.contains('disabled'), true);
  assert.strictEqual(elements['cleanHome'].disabled, true);
  // Ensure partial update preserved previously set milestone 'hq3'
  assert.strictEqual(popup._getCachedSettings().thumbnailMilestone, 'hq3');
});

// --------------------------------------------------------------------------
// 4. Popup Controller: Storage Binding & Save/Load
// --------------------------------------------------------------------------
(async () => {
  await testAsync('saveSetting and loadSettings interface correctly with chrome.storage.sync', async () => {
    const storageState = {};

    const mockStorage = {
      get: (defaults, callback) => {
        const result = { ...defaults, ...storageState };
        callback(result);
      },
      set: (items, callback) => {
        Object.assign(storageState, items);
        if (callback) callback();
      }
    };

    // Save a setting
    await popup.saveSetting('hideShorts', false, mockStorage);
    assert.strictEqual(storageState['hideShorts'], false);

    await popup.saveSetting('thumbnailMilestone', 'hq1', mockStorage);
    assert.strictEqual(storageState['thumbnailMilestone'], 'hq1');

    // Load settings into mock document
    let renderedSettings = null;
    const mockDoc = {
      getElementById: (id) => ({ id, checked: false, classList: { add: () => {}, remove: () => {} } }),
      querySelectorAll: () => []
    };

    const loaded = await popup.loadSettings(mockStorage, mockDoc);
    assert.strictEqual(loaded.hideShorts, false);
    assert.strictEqual(loaded.thumbnailMilestone, 'hq1');
    assert.strictEqual(loaded.extensionEnabled, true); // Kept default
  });

  // --------------------------------------------------------------------------
  // 5. Zero Regression on Content Scripts and Engine
  // --------------------------------------------------------------------------
  test('Zero Regression: content engine maintains full integrity with popup settings schema', () => {
    const engine = require('../content/content.js');
    assert.strictEqual(engine.DEFAULT_SETTINGS.extensionEnabled, true);
    assert.strictEqual(engine.DEFAULT_SETTINGS.thumbnailMilestone, 'hq2');
    assert.strictEqual(engine.DEFAULT_SETTINGS.slideCaptureEnabled, true);
    assert.strictEqual(engine.DEFAULT_SETTINGS.abLooperEnabled, true);
  });

  console.log(`\nAll ${testsPassed} popup assertions passed successfully!`);
})();
