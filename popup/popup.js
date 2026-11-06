/**
 * Utubee-Thumbnail: Minimalist Settings Popup Controller
 * Manages two-way reactive binding between popup UI controls and chrome.storage.sync.
 */

(function () {
  'use strict';

  const DEFAULT_SETTINGS = {
    extensionEnabled: true,
    thumbnailMilestone: 'hq2', // 'hq1' (25%), 'hq2' (50%), 'hq3' (75%)
    cleanHome: true,
    hideSidebar: true,
    hideShorts: true,
    hideComments: true,
    slideCaptureEnabled: true,
    abLooperEnabled: true
  };

  const TOGGLE_KEYS = [
    'extensionEnabled',
    'cleanHome',
    'hideSidebar',
    'hideShorts',
    'hideComments',
    'slideCaptureEnabled',
    'abLooperEnabled'
  ];

  const VALID_MILESTONES = ['hq1', 'hq2', 'hq3'];

  let cachedSettings = { ...DEFAULT_SETTINGS };

  /**
   * Updates the UI elements to reflect the provided settings.
   * @param {typeof DEFAULT_SETTINGS} settings
   * @param {Document} doc
   */
  function renderSettings(settings, doc = (typeof document !== 'undefined' ? document : null)) {
    if (!doc) return;

    cachedSettings = { ...DEFAULT_SETTINGS, ...settings };

    // Update checkbox toggles
    for (const key of TOGGLE_KEYS) {
      const inputEl = doc.getElementById(key);
      if (inputEl && typeof inputEl === 'object') {
        inputEl.checked = Boolean(cachedSettings[key]);
      }
    }

    // Update Master Switch visual lock on sub-controls
    const contentEl = doc.getElementById('settingsContent');
    if (contentEl) {
      if (!cachedSettings.extensionEnabled) {
        if (contentEl.classList && typeof contentEl.classList.add === 'function') {
          contentEl.classList.add('disabled');
        } else if (contentEl.className) {
          contentEl.className = 'settings-content disabled';
        }
      } else {
        if (contentEl.classList && typeof contentEl.classList.remove === 'function') {
          contentEl.classList.remove('disabled');
        } else if (contentEl.className) {
          contentEl.className = 'settings-content';
        }
      }
    }

    // Update Segmented Control for milestone
    const activeMilestone = VALID_MILESTONES.includes(cachedSettings.thumbnailMilestone)
      ? cachedSettings.thumbnailMilestone
      : 'hq2';

    const segmentButtons = doc.querySelectorAll ? doc.querySelectorAll('.segment-btn') : [];
    for (let i = 0; i < segmentButtons.length; i++) {
      const btn = segmentButtons[i];
      const milestone = btn.getAttribute ? btn.getAttribute('data-milestone') : null;
      const isSelected = milestone === activeMilestone;

      if (btn.classList && typeof btn.classList.toggle === 'function') {
        btn.classList.toggle('active', isSelected);
      }
      if (typeof btn.setAttribute === 'function') {
        btn.setAttribute('aria-checked', isSelected ? 'true' : 'false');
      }
    }
  }

  /**
   * Saves a single setting to chrome.storage.sync and updates local cache.
   * @param {string} key
   * @param {any} value
   * @param {any} storageArea
   * @returns {Promise<void>}
   */
  function saveSetting(
    key,
    value,
    storageArea = (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync ? chrome.storage.sync : null)
  ) {
    cachedSettings[key] = value;

    if (!storageArea || typeof storageArea.set !== 'function') {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      storageArea.set({ [key]: value }, () => {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
          console.warn('Utubee storage save error:', chrome.runtime.lastError);
        }
        resolve();
      });
    });
  }

  /**
   * Loads settings from chrome.storage.sync into the popup.
   * @param {any} storageArea
   * @param {Document} doc
   * @returns {Promise<typeof DEFAULT_SETTINGS>}
   */
  function loadSettings(
    storageArea = (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync ? chrome.storage.sync : null),
    doc = (typeof document !== 'undefined' ? document : null)
  ) {
    if (!storageArea || typeof storageArea.get !== 'function') {
      renderSettings(DEFAULT_SETTINGS, doc);
      return Promise.resolve(DEFAULT_SETTINGS);
    }

    return new Promise((resolve) => {
      storageArea.get(DEFAULT_SETTINGS, (items) => {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
          console.warn('Utubee storage read error:', chrome.runtime.lastError);
          renderSettings(DEFAULT_SETTINGS, doc);
          resolve(DEFAULT_SETTINGS);
          return;
        }

        const merged = { ...DEFAULT_SETTINGS, ...items };
        renderSettings(merged, doc);
        resolve(merged);
      });
    });
  }

  /**
   * Binds change and click listeners to DOM elements.
   * @param {Document} doc
   * @param {any} storageArea
   */
  function bindEventListeners(
    doc = (typeof document !== 'undefined' ? document : null),
    storageArea = (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync ? chrome.storage.sync : null)
  ) {
    if (!doc) return;

    // Bind checkbox change listeners
    for (const key of TOGGLE_KEYS) {
      const inputEl = doc.getElementById(key);
      if (inputEl && typeof inputEl.addEventListener === 'function') {
        inputEl.addEventListener('change', (e) => {
          const isChecked = Boolean(e.target.checked);
          saveSetting(key, isChecked, storageArea);

          // If master toggle changed, immediately update dimmed state
          if (key === 'extensionEnabled') {
            renderSettings({ ...cachedSettings, extensionEnabled: isChecked }, doc);
          }
        });
      }
    }

    // Bind segmented milestone button listeners
    const segmentButtons = doc.querySelectorAll ? doc.querySelectorAll('.segment-btn') : [];
    for (let i = 0; i < segmentButtons.length; i++) {
      const btn = segmentButtons[i];
      if (typeof btn.addEventListener === 'function') {
        btn.addEventListener('click', () => {
          const milestone = btn.getAttribute('data-milestone');
          if (VALID_MILESTONES.includes(milestone)) {
            saveSetting('thumbnailMilestone', milestone, storageArea);
            renderSettings({ ...cachedSettings, thumbnailMilestone: milestone }, doc);
          }
        });
      }
    }

    // Bind chrome.storage.onChanged listener for multi-window sync
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'sync') return;
        const updated = { ...cachedSettings };
        for (const k of Object.keys(changes)) {
          if (k in updated) {
            updated[k] = changes[k].newValue;
          }
        }
        renderSettings(updated, doc);
      });
    }
  }

  /**
   * Initialize popup controller on DOM load.
   */
  function init() {
    if (typeof document === 'undefined') return;

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        bindEventListeners(document);
        loadSettings(chrome.storage.sync, document);
      }, { once: true });
    } else {
      bindEventListeners(document);
      loadSettings(chrome.storage.sync, document);
    }
  }

  if (typeof window !== 'undefined') {
    init();
  }

  // Export functions for automated unit testing in Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      DEFAULT_SETTINGS,
      TOGGLE_KEYS,
      VALID_MILESTONES,
      renderSettings,
      saveSetting,
      loadSettings,
      bindEventListeners,
      _getCachedSettings: () => cachedSettings,
      _setCachedSettings: (s) => { cachedSettings = { ...cachedSettings, ...s }; }
    };
  }
})();
