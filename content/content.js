/**
 * Utubee-Thumbnail: Core Thumbnail Replacer & Study Focus Companion Engine
 * Swaps deceptive creator thumbnails with authentic video milestone frames (hq2.jpg)
 * and orchestrates declarative distraction shields (Clean Home, Sidebar Hider, Shorts Block, Comments Errata).
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

  const VALID_MILESTONES = ['hq1', 'hq2', 'hq3'];

  const CARD_SELECTORS = [
    'ytd-rich-item-renderer',
    'yt-lockup-view-model',
    'ytd-video-renderer',
    'ytd-compact-video-renderer',
    'ytd-grid-video-renderer',
    'ytd-playlist-video-renderer',
    'ytd-playlist-panel-video-renderer'
  ].join(', ');

  let currentSettings = { ...DEFAULT_SETTINGS };
  let isScanningScheduled = false;
  let mutationObserver = null;

  /**
   * Synchronously applies or removes declarative root attributes on <html> to control Study Shields.
   * Eliminates Flash of Unstyled Content (FOUC).
   * @param {typeof DEFAULT_SETTINGS} settings
   * @param {HTMLElement|null} root
   */
  function applyRootAttributes(settings, root = (typeof document !== 'undefined' ? document.documentElement : null)) {
    if (!root || typeof root.setAttribute !== 'function') return;

    const isEnabled = Boolean(settings && settings.extensionEnabled);

    if (isEnabled) {
      root.setAttribute('data-utubee-enabled', 'true');

      if (settings.cleanHome) {
        root.setAttribute('data-utubee-clean-home', 'true');
      } else {
        root.removeAttribute('data-utubee-clean-home');
      }

      if (settings.hideSidebar) {
        root.setAttribute('data-utubee-hide-sidebar', 'true');
      } else {
        root.removeAttribute('data-utubee-hide-sidebar');
      }

      if (settings.hideShorts) {
        root.setAttribute('data-utubee-hide-shorts', 'true');
      } else {
        root.removeAttribute('data-utubee-hide-shorts');
      }

      if (settings.hideComments) {
        root.setAttribute('data-utubee-hide-comments', 'true');
      } else {
        root.removeAttribute('data-utubee-hide-comments');
        root.removeAttribute('data-utubee-comments-revealed');
      }
    } else {
      root.removeAttribute('data-utubee-enabled');
      root.removeAttribute('data-utubee-clean-home');
      root.removeAttribute('data-utubee-hide-sidebar');
      root.removeAttribute('data-utubee-hide-shorts');
      root.removeAttribute('data-utubee-hide-comments');
      root.removeAttribute('data-utubee-comments-revealed');
    }
  }

  // Synchronous root attribute bootstrap to guarantee Zero FOUC at document_start
  if (typeof document !== 'undefined' && document.documentElement) {
    applyRootAttributes(DEFAULT_SETTINGS, document.documentElement);
  }

  /**
   * Generates authentic thumbnail URL from video ID and milestone.
   * @param {string} videoId 11-character YouTube video ID
   * @param {string} milestone 'hq1' | 'hq2' | 'hq3'
   * @returns {string} Fully qualified thumbnail image URL
   */
  function getThumbnailUrl(videoId, milestone) {
    const selectedMilestone = VALID_MILESTONES.includes(milestone) ? milestone : 'hq2';
    return `https://i.ytimg.com/vi/${videoId}/${selectedMilestone}.jpg`;
  }

  /**
   * Checks whether a URL points to a YouTube Short.
   * @param {string} url
   * @returns {boolean}
   */
  function isShortsUrl(url) {
    if (!url) return false;
    return url.includes('/shorts/');
  }

  /**
   * Extracts the 11-character video ID from an anchor URL or existing thumbnail src.
   * Excludes Shorts URLs.
   * @param {string|null} anchorHref
   * @param {string|null} imgSrc
   * @returns {string|null}
   */
  function extractVideoId(anchorHref, imgSrc) {
    if (anchorHref) {
      if (isShortsUrl(anchorHref)) {
        return null;
      }
      const match = anchorHref.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
      if (match && match[1]) {
        return match[1];
      }
    }

    if (imgSrc) {
      if (isShortsUrl(imgSrc)) {
        return null;
      }
      const imgMatch = imgSrc.match(/\/vi(?:_webp)?\/([a-zA-Z0-9_-]{11})\//);
      if (imgMatch && imgMatch[1]) {
        return imgMatch[1];
      }
    }

    return null;
  }

  /**
   * Checks if a video card is an active live stream or upcoming premiere.
   * @param {Element} card
   * @returns {boolean}
   */
  function isLiveOrUpcoming(card) {
    if (!card || typeof card.querySelector !== 'function' || typeof card.querySelectorAll !== 'function') return false;

    // Check overlay-style attributes on overlays
    if (card.querySelector('[overlay-style="LIVE"], [overlay-style="UPCOMING"]')) {
      return true;
    }

    // Check YouTube badge class markers
    if (card.querySelector('.badge-style-type-live-now, .badge-style-type-upcoming')) {
      return true;
    }

    // Inspect badge element text and aria-labels
    const badges = card.querySelectorAll('ytd-badge-supported-renderer, ytd-thumbnail-overlay-time-status-renderer, .badge, [class*="badge"]');
    for (let i = 0; i < badges.length; i++) {
      const text = (badges[i].textContent || badges[i].getAttribute('aria-label') || '').toUpperCase().trim();
      if (text === 'LIVE' || text === 'PREMIERE' || text.startsWith('PREMIERES') || text.includes('LIVE NOW')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Replaces an <img> element's src with the authentic milestone frame.
   * Preserves originals and installs fallback on 404 error.
   * @param {HTMLImageElement} img
   * @param {string} videoId
   * @param {string} milestone
   */
  function swapThumbnailImage(img, videoId, milestone) {
    if (!img || !videoId) return;

    const targetMilestone = VALID_MILESTONES.includes(milestone) ? milestone : 'hq2';
    const targetUrl = getThumbnailUrl(videoId, targetMilestone);

    // If already swapped to this target milestone and URL matches, do nothing
    if (
      img.getAttribute('data-utubee-swapped') === 'true' &&
      img.getAttribute('data-utubee-milestone') === targetMilestone &&
      img.src === targetUrl
    ) {
      return;
    }

    // Preserve original src before first replacement
    if (!img.hasAttribute('data-utubee-orig-src')) {
      const origSrc = img.currentSrc || img.getAttribute('src') || img.src || '';
      const isMilestone = VALID_MILESTONES.some((m) => origSrc.includes(`/${m}.jpg`));
      img.setAttribute('data-utubee-orig-src', (!isMilestone && origSrc) ? origSrc : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`);
    }

    // Preserve original srcset before first replacement
    if (!img.hasAttribute('data-utubee-orig-srcset')) {
      const origSrcset = img.getAttribute('srcset') || img.srcset || '';
      if (origSrcset) {
        img.setAttribute('data-utubee-orig-srcset', origSrcset);
      }
    }

    // Clear srcset and lock property against YouTube lazy-load overrides
    img.removeAttribute('srcset');
    img.srcset = '';
    try {
      Object.defineProperty(img, 'srcset', {
        get: () => '',
        set: () => {},
        configurable: true
      });
    } catch (_) {
      // Graceful fallback for non-configurable mock or sealed objects
    }

    // Set loading state if not already loaded in browser memory cache
    const isAlreadyLoaded = Boolean(img.complete && (img.naturalWidth === undefined || img.naturalWidth > 0));
    if (!isAlreadyLoaded) {
      img.setAttribute('data-utubee-loading', 'true');
    } else {
      img.removeAttribute('data-utubee-loading');
    }

    img.onload = () => {
      img.removeAttribute('data-utubee-loading');
    };

    // Graceful error fallback: restore original thumbnail if milestone frame returns 404
    img.onerror = () => {
      img.onerror = null;
      img.onload = null;
      img.removeAttribute('data-utubee-loading');
      try {
        delete img.srcset;
      } catch (_) {}
      const originalSrc = img.getAttribute('data-utubee-orig-src');
      const originalSrcset = img.getAttribute('data-utubee-orig-srcset');
      if (originalSrc) {
        img.src = originalSrc;
      }
      if (originalSrcset) {
        img.srcset = originalSrcset;
      }
      img.removeAttribute('data-utubee-swapped');
      img.removeAttribute('data-utubee-milestone');
      img.setAttribute('data-utubee-failed', 'true');
    };

    // Apply swapped attributes and authentic frame source
    img.setAttribute('data-utubee-swapped', 'true');
    img.setAttribute('data-utubee-milestone', targetMilestone);
    img.src = targetUrl;
  }

  /**
   * Processes a single YouTube card element.
   * @param {Element} card
   * @param {string} milestone
   */
  function processCard(card, milestone) {
    if (!card || typeof card.querySelector !== 'function') return;

    // Skip active live streams and upcoming premieres
    if (isLiveOrUpcoming(card)) {
      return;
    }

    // Locate video card thumbnail image (supports legacy ytd-thumbnail and modern yt-thumbnail-view-model)
    const img = card.querySelector(
      'yt-thumbnail-view-model img:not(.ytSpecAvatarShapeImage), ytd-thumbnail img, yt-image img, #thumbnail img, a[href*="/watch"] img:not(.ytSpecAvatarShapeImage)'
    );
    if (!img) return;

    // If this image already failed to load (404), do not retry in infinite loop
    if (img.getAttribute && img.getAttribute('data-utubee-failed') === 'true') {
      return;
    }

    // Locate primary anchor (supports legacy anchor IDs and modern ytLockupViewModelContentImage)
    const anchor = card.querySelector(
      'a.ytLockupViewModelContentImage[href], a#thumbnail[href], a#video-title-link[href], a#video-title[href], a[href*="/watch?v="]'
    );
    const anchorHref = anchor ? anchor.getAttribute('href') : null;
    const currentSrc = img.currentSrc || img.getAttribute('src') || img.src || '';

    const videoId = extractVideoId(anchorHref, currentSrc);
    if (!videoId) return;

    const targetUrl = getThumbnailUrl(videoId, milestone);
    const existingVideoId = card.getAttribute ? card.getAttribute('data-utubee-video-id') : null;
    const existingMilestone = card.getAttribute ? card.getAttribute('data-utubee-milestone') : null;

    // Early exit only if both card and image are already confirmed swapped to the target video & milestone
    if (
      existingVideoId === videoId &&
      existingMilestone === milestone &&
      img.getAttribute && img.getAttribute('data-utubee-swapped') === 'true' &&
      img.src === targetUrl
    ) {
      return;
    }

    swapThumbnailImage(img, videoId, milestone);
    if (typeof card.setAttribute === 'function') {
      card.setAttribute('data-utubee-video-id', videoId);
      card.setAttribute('data-utubee-milestone', milestone);
      card.setAttribute('data-utubee-card-active', 'true');
    }
  }

  /**
   * Scans all standard YouTube video cards on the page and swaps thumbnails.
   */
  function scanAndSwapThumbnails() {
    if (!currentSettings.extensionEnabled) return;

    const cards = document.querySelectorAll(CARD_SELECTORS);
    for (let i = 0; i < cards.length; i++) {
      processCard(cards[i], currentSettings.thumbnailMilestone);
    }
  }

  /**
   * Restores all swapped thumbnails back to original creator images.
   */
  function restoreAllThumbnails() {
    const swappedImages = document.querySelectorAll('img[data-utubee-swapped="true"], img[data-utubee-loading="true"]');
    for (let i = 0; i < swappedImages.length; i++) {
      const img = swappedImages[i];
      img.onerror = null;
      img.onload = null;
      img.removeAttribute('data-utubee-loading');
      try {
        delete img.srcset;
      } catch (_) {}
      const origSrc = img.getAttribute('data-utubee-orig-src');
      const origSrcset = img.getAttribute('data-utubee-orig-srcset');

      if (origSrc) {
        img.src = origSrc;
      }
      if (origSrcset) {
        img.srcset = origSrcset;
      }
      img.removeAttribute('data-utubee-swapped');
      img.removeAttribute('data-utubee-milestone');
    }

    const activeCards = document.querySelectorAll('[data-utubee-card-active="true"]');
    for (let i = 0; i < activeCards.length; i++) {
      activeCards[i].removeAttribute('data-utubee-card-active');
      activeCards[i].removeAttribute('data-utubee-milestone');
      activeCards[i].removeAttribute('data-utubee-video-id');
    }
  }

  /**
   * Schedules a debounced thumbnail scan on the next animation frame.
   */
  function scheduleScan() {
    if (!currentSettings.extensionEnabled) return;
    if (isScanningScheduled) return;

    isScanningScheduled = true;
    requestAnimationFrame(() => {
      isScanningScheduled = false;
      scanAndSwapThumbnails();
    });
  }

  /**
   * Updates the button text, aria-attributes, and icon based on revealed state.
   * @param {boolean} isRevealed
   * @param {HTMLElement|null} btn
   */
  function updateCommentsToggleButton(isRevealed, btn = (typeof document !== 'undefined' ? document.getElementById('utubee-comments-toggle-btn') : null)) {
    if (!btn || typeof btn.setAttribute !== 'function') return;
    btn.setAttribute('aria-expanded', isRevealed ? 'true' : 'false');

    // Trusted Types CSP compliant DOM updates (zero innerHTML)
    if (typeof btn.removeChild === 'function') {
      while (btn.firstChild) {
        btn.removeChild(btn.firstChild);
      }
    }

    if (typeof document !== 'undefined' && typeof document.createElementNS === 'function') {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute(
        'd',
        isRevealed
          ? 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'
          : 'M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z'
      );
      svg.appendChild(path);

      const span = document.createElement('span');
      span.textContent = isRevealed ? 'Hide Comments & Errata' : 'Show Errata & Pinned Comments';

      btn.appendChild(svg);
      btn.appendChild(span);
    }
  }

  /**
   * Toggles the visibility of comments by toggling the data-utubee-comments-revealed attribute.
   * @param {HTMLElement|null} root
   * @returns {boolean} New revealed state
   */
  function toggleCommentsVisibility(root = (typeof document !== 'undefined' ? document.documentElement : null)) {
    if (!root || typeof root.getAttribute !== 'function') return false;
    const isCurrentlyRevealed = root.getAttribute('data-utubee-comments-revealed') === 'true';
    const newRevealedState = !isCurrentlyRevealed;

    if (newRevealedState) {
      root.setAttribute('data-utubee-comments-revealed', 'true');
    } else {
      root.removeAttribute('data-utubee-comments-revealed');
    }

    if (typeof document !== 'undefined') {
      updateCommentsToggleButton(newRevealedState);
    }
    return newRevealedState;
  }

  /**
   * Injects the accessible errata toggle button before #comments on watch pages.
   * @param {Document|null} doc
   * @returns {HTMLElement|null} Container element
   */
  function injectCommentsToggleButton(doc = (typeof document !== 'undefined' ? document : null)) {
    if (!doc || typeof doc.querySelector !== 'function') return null;
    if (!currentSettings.extensionEnabled || !currentSettings.hideComments) {
      teardownCommentsToggleButton(doc);
      return null;
    }

    const commentsEl = doc.querySelector('ytd-comments#comments, #comments');
    if (!commentsEl || !commentsEl.parentNode) return null;

    let container = doc.getElementById('utubee-errata-container');
    if (!container) {
      container = doc.createElement('div');
      container.id = 'utubee-errata-container';

      const btn = doc.createElement('button');
      btn.id = 'utubee-comments-toggle-btn';
      btn.type = 'button';
      btn.setAttribute('aria-controls', 'comments');

      if (typeof btn.addEventListener === 'function') {
        btn.addEventListener('click', () => {
          toggleCommentsVisibility();
        });
      }
      container.appendChild(btn);

      commentsEl.parentNode.insertBefore(container, commentsEl);
    } else if (container.parentNode !== commentsEl.parentNode || container.nextSibling !== commentsEl) {
      // Reposition container if YouTube SPA layout reattached #comments
      commentsEl.parentNode.insertBefore(container, commentsEl);
    }

    const root = doc.documentElement;
    const isRevealed = root && root.getAttribute('data-utubee-comments-revealed') === 'true';
    updateCommentsToggleButton(isRevealed, doc.getElementById('utubee-comments-toggle-btn'));
    return container;
  }

  /**
   * Removes the errata toggle button from the DOM.
   * @param {Document|null} doc
   */
  function teardownCommentsToggleButton(doc = (typeof document !== 'undefined' ? document : null)) {
    if (!doc || typeof doc.getElementById !== 'function') return;
    const container = doc.getElementById('utubee-errata-container');
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }

  /**
   * Injects the Clean Slate Study HUD in place of the hidden recommendation feed.
   * Eliminates the confusing "empty black void" while keeping students distraction-free.
   * @param {Document|null} doc
   * @returns {HTMLElement|null}
   */
  function injectCleanSlateHUD(doc = (typeof document !== 'undefined' ? document : null), win = (typeof window !== 'undefined' ? window : null)) {
    if (!doc || typeof doc.querySelector !== 'function') return null;

    const isHomePage = win && win.location ? (win.location.pathname === '/' || win.location.pathname === '') : true;
    if (!currentSettings.extensionEnabled || !currentSettings.cleanHome || !isHomePage) {
      teardownCleanSlateHUD(doc);
      return null;
    }

    const homeBrowse = doc.querySelector('ytd-browse[page-subtype="home"]') || doc.querySelector('ytd-page-manager') || doc.body;
    if (!homeBrowse) return null;

    let container = doc.getElementById('utubee-clean-slate-container');
    if (!container) {
      container = doc.createElement('div');
      container.id = 'utubee-clean-slate-container';

      const card = doc.createElement('div');
      card.className = 'utubee-clean-slate-card';

      const icon = doc.createElement('div');
      icon.className = 'utubee-clean-slate-icon';
      if (typeof doc.createElementNS === 'function') {
        const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('aria-hidden', 'true');
        const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9v-2h2v2zm0-4H9V7h2v5zm4 4h-2v-6h2v6zm0-8h-2V7h2v1z');
        svg.appendChild(path);
        icon.appendChild(svg);
      }

      const title = doc.createElement('h2');
      title.className = 'utubee-clean-slate-title';
      title.textContent = 'Clean Slate Study Mode Active';

      const subtitle = doc.createElement('p');
      subtitle.className = 'utubee-clean-slate-subtitle';
      subtitle.textContent = 'Algorithmic recommendations hidden to protect your focus. Use the search bar above to study intentionally.';

      card.appendChild(icon);
      card.appendChild(title);
      card.appendChild(subtitle);
      container.appendChild(card);

      if (typeof homeBrowse.insertBefore === 'function') {
        homeBrowse.insertBefore(container, homeBrowse.firstChild);
      } else if (typeof homeBrowse.appendChild === 'function') {
        homeBrowse.appendChild(container);
      }
    }
    return container;
  }

  /**
   * Removes the Clean Slate Study HUD from the DOM.
   * @param {Document|null} doc
   */
  function teardownCleanSlateHUD(doc = (typeof document !== 'undefined' ? document : null)) {
    if (!doc || typeof doc.getElementById !== 'function') return;
    const container = doc.getElementById('utubee-clean-slate-container');
    if (container && container.parentNode && typeof container.parentNode.removeChild === 'function') {
      container.parentNode.removeChild(container);
    }
  }

  /**
   * Resets the comments revealed state on client-side SPA navigation.
   * @param {HTMLElement|null} root
   */
  function resetCommentsRevealedState(root = (typeof document !== 'undefined' ? document.documentElement : null)) {
    if (root && typeof root.removeAttribute === 'function') {
      root.removeAttribute('data-utubee-comments-revealed');
    }
    if (typeof document !== 'undefined') {
      updateCommentsToggleButton(false);
    }
  }

  /**
   * Handles YouTube client-side SPA navigation lifecycle.
   */
  function handleNavigation() {
    clearLoop(false);
    resetCommentsRevealedState();
    injectCommentsToggleButton();
    injectCleanSlateHUD();
    scheduleScan();
  }

  /**
   * Initializes storage listeners and loads active configuration.
   */
  function initSettings() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          return;
        }
        currentSettings = { ...DEFAULT_SETTINGS, ...items };
        applyRootAttributes(currentSettings);
        if (currentSettings.extensionEnabled) {
          injectCommentsToggleButton();
          injectCleanSlateHUD();
          scheduleScan();
        } else {
          teardownCommentsToggleButton();
          teardownCleanSlateHUD();
        }
      });

      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'sync') return;

        let shouldReScan = false;

        for (const key of Object.keys(changes)) {
          if (key in currentSettings) {
            currentSettings[key] = changes[key].newValue !== undefined ? changes[key].newValue : DEFAULT_SETTINGS[key];
          }
        }

        applyRootAttributes(currentSettings);

        if (changes.extensionEnabled) {
          if (!currentSettings.extensionEnabled) {
            restoreAllThumbnails();
            teardownCommentsToggleButton();
            teardownCleanSlateHUD();
            clearLoop(false);
          } else {
            injectCommentsToggleButton();
            injectCleanSlateHUD();
            shouldReScan = true;
          }
        }

        if (changes.cleanHome) {
          if (currentSettings.cleanHome && currentSettings.extensionEnabled) {
            injectCleanSlateHUD();
          } else {
            teardownCleanSlateHUD();
          }
        }

        if (changes.abLooperEnabled) {
          if (!currentSettings.abLooperEnabled) {
            clearLoop(false);
          }
        }

        if (changes.thumbnailMilestone) {
          if (currentSettings.extensionEnabled) {
            shouldReScan = true;
          }
        }

        if (changes.hideComments) {
          if (!currentSettings.hideComments) {
            teardownCommentsToggleButton();
          } else if (currentSettings.extensionEnabled) {
            injectCommentsToggleButton();
          }
        }

        if (shouldReScan) {
          scheduleScan();
        }
      });
    }
  }

  /**
   * Initializes DOM mutation observer to dynamically handle infinite scroll.
   */
  function initObserver() {
    if (mutationObserver) return;

    mutationObserver = new MutationObserver(() => {
      if (!currentSettings.extensionEnabled) return;
      scheduleScan();
      const isWatchPage = typeof window !== 'undefined' && window.location && window.location.pathname.startsWith('/watch');
      if (currentSettings.hideComments && isWatchPage && typeof document !== 'undefined' && !document.getElementById('utubee-errata-container')) {
        injectCommentsToggleButton();
      }
      if (currentSettings.cleanHome && typeof document !== 'undefined' && !document.getElementById('utubee-clean-slate-container')) {
        injectCleanSlateHUD();
      }
    });

    const root = document.documentElement || document.body;
    if (root) {
      mutationObserver.observe(root, {
        childList: true,
        subtree: true
      });
    }
  }

  /* ==========================================================================
     Utubee Comprehension Tools: Slide Capture & A-B Concept Looper
     ========================================================================== */

  /**
   * Formats a duration in seconds to mm:ss or hh:mm:ss.
   * @param {number} seconds
   * @returns {string}
   */
  function formatTimestamp(seconds) {
    if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) return '00:00';
    const total = Math.floor(seconds);
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    const pad = (n) => String(n).padStart(2, '0');
    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  }

  /**
   * Finds the active video element within the YouTube player.
   * @param {Document|null} doc
   * @returns {HTMLVideoElement|null}
   */
  function getActiveVideo(doc = (typeof document !== 'undefined' ? document : null)) {
    if (!doc || typeof doc.querySelector !== 'function') return null;
    return doc.querySelector(
      '#movie_player video.html5-main-video, ytd-player video.html5-main-video, .html5-video-player video.html5-main-video, .html5-video-player video, video'
    );
  }

  let toastTimeout = null;

  /**
   * Displays a lightweight self-dismissing HUD toast notification (1.5s).
   * @param {string} message
   * @param {boolean} isError
   * @param {Document|null} doc
   * @returns {HTMLElement|null}
   */
  function showToast(message, isError = false, doc = (typeof document !== 'undefined' ? document : null)) {
    if (!doc || typeof doc.createElement !== 'function') return null;

    let toast = doc.getElementById('utubee-toast');
    const targetParent = doc.fullscreenElement || doc.body || doc.documentElement;
    if (!toast) {
      toast = doc.createElement('div');
      toast.id = 'utubee-toast';
      if (typeof toast.setAttribute === 'function') {
        toast.setAttribute('id', 'utubee-toast');
      }
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      if (targetParent && typeof targetParent.appendChild === 'function') {
        targetParent.appendChild(toast);
      }
    } else if (toast.parentNode !== targetParent && targetParent && typeof targetParent.appendChild === 'function') {
      targetParent.appendChild(toast);
    }

    toast.textContent = message;

    if (toast.classList && typeof toast.classList.add === 'function') {
      if (isError) {
        toast.classList.add('utubee-toast-error');
      } else {
        toast.classList.remove('utubee-toast-error');
      }
      toast.classList.add('utubee-toast-visible');
    } else {
      toast.className = 'utubee-toast utubee-toast-visible' + (isError ? ' utubee-toast-error' : '');
    }

    if (toastTimeout) {
      clearTimeout(toastTimeout);
    }

    toastTimeout = setTimeout(() => {
      if (toast.classList && typeof toast.classList.remove === 'function') {
        toast.classList.remove('utubee-toast-visible');
      } else if (toast.className) {
        toast.className = toast.className.replace('utubee-toast-visible', '').trim();
      }
      toastTimeout = null;
    }, 1500);

    return toast;
  }

  /**
   * Creates or updates the discreet on-player A-B loop status badge.
   * @param {string} text
   * @param {Document|null} doc
   * @returns {HTMLElement|null}
   */
  function updateLoopBadge(text, doc = (typeof document !== 'undefined' ? document : null)) {
    if (!doc || typeof doc.createElement !== 'function') return null;

    let badge = doc.getElementById('utubee-loop-badge');
    if (!badge) {
      badge = doc.createElement('div');
      badge.id = 'utubee-loop-badge';
      if (typeof badge.setAttribute === 'function') {
        badge.setAttribute('id', 'utubee-loop-badge');
      }
      badge.className = 'utubee-loop-badge';
      badge.setAttribute('role', 'status');
      badge.setAttribute('aria-label', 'A-B Loop Active');

      const dot = doc.createElement('span');
      dot.className = 'utubee-loop-badge-dot';
      badge.appendChild(dot);

      const label = doc.createElement('span');
      label.className = 'utubee-loop-badge-text';
      badge.appendChild(label);

      const playerContainer = doc.querySelector ? doc.querySelector('.html5-video-player, #movie_player, ytd-player, #player') : null;
      const target = playerContainer || doc.body || doc.documentElement;
      if (target && typeof target.appendChild === 'function') {
        target.appendChild(badge);
      }
    }

    const labelEl = badge.querySelector ? badge.querySelector('.utubee-loop-badge-text') : null;
    if (labelEl) {
      labelEl.textContent = text;
    } else {
      badge.textContent = text;
    }

    if (badge.style) {
      badge.style.display = 'inline-flex';
    }

    return badge;
  }

  /**
   * Removes the loop status badge from the DOM.
   * @param {Document|null} doc
   */
  function removeLoopBadge(doc = (typeof document !== 'undefined' ? document : null)) {
    if (!doc || typeof doc.getElementById !== 'function') return;
    const badge = doc.getElementById('utubee-loop-badge');
    if (badge && badge.parentNode && typeof badge.parentNode.removeChild === 'function') {
      badge.parentNode.removeChild(badge);
    }
  }

  /**
   * Grabs the current video frame at native resolution onto an offscreen canvas
   * and writes the PNG image blob to the clipboard.
   * @param {HTMLVideoElement|null} video
   * @param {Document|null} doc
   * @param {Clipboard|null} navClipboard
   * @returns {Promise<{ success: boolean, blob?: Blob, error?: any }>}
   */
  async function captureSlideFrame(
    video = getActiveVideo(),
    doc = (typeof document !== 'undefined' ? document : null),
    navClipboard = (typeof navigator !== 'undefined' ? navigator.clipboard : null)
  ) {
    if (!doc) return { success: false, error: 'No document' };

    if (!video || !video.videoWidth || !video.videoHeight) {
      showToast('❌ No active video found', true, doc);
      return { success: false, error: 'No active video found' };
    }

    try {
      const canvas = doc.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext ? canvas.getContext('2d') : null;
      if (!ctx) {
        showToast('❌ Canvas context unavailable', true, doc);
        return { success: false, error: 'Canvas context unavailable' };
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      return new Promise((resolve) => {
        if (typeof canvas.toBlob !== 'function') {
          showToast('❌ Failed to capture frame', true, doc);
          resolve({ success: false, error: 'toBlob not supported' });
          return;
        }

        canvas.toBlob(async (blob) => {
          canvas.width = 0;
          canvas.height = 0;
          if (!blob) {
            showToast('❌ Failed to capture frame', true, doc);
            resolve({ success: false, error: 'Failed to create blob' });
            return;
          }

          try {
            const clip = navClipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
            const ClipboardItemCtor = typeof ClipboardItem !== 'undefined'
              ? ClipboardItem
              : (typeof global !== 'undefined' ? global.ClipboardItem : null);

            if (clip && typeof clip.write === 'function' && ClipboardItemCtor) {
              await clip.write([new ClipboardItemCtor({ 'image/png': blob })]);
              showToast('📸 Slide copied to clipboard', false, doc);
              resolve({ success: true, blob });
            } else {
              showToast('❌ Clipboard API not available', true, doc);
              resolve({ success: false, error: 'Clipboard API not available' });
            }
          } catch (clipErr) {
            showToast('❌ Failed to copy to clipboard', true, doc);
            resolve({ success: false, error: clipErr });
          }
        }, 'image/png');
      });
    } catch (err) {
      showToast('❌ Failed to capture slide', true, doc);
      return { success: false, error: err };
    }
  }

  const looperState = {
    loopPointA: null,
    loopPointB: null,
    isLooping: false,
    activeVideo: null,
    _timeUpdateHandler: null
  };

  /**
   * Continuous boundary check for A-B concept loop.
   * @param {HTMLVideoElement} video
   */
  function handleVideoTimeUpdate(video) {
    if (!looperState.isLooping || looperState.loopPointA === null || looperState.loopPointB === null) return;
    if (!video) return;

    // Safety guard: Suppress loop seeking while YouTube commercial ads are playing
    if (
      (video.closest && video.closest('.ad-showing, .ad-interrupting')) ||
      (typeof document !== 'undefined' && document.querySelector && document.querySelector('.ad-showing, .ad-interrupting'))
    ) {
      return;
    }

    if (video.currentTime >= looperState.loopPointB || video.currentTime < looperState.loopPointA - 0.5) {
      video.currentTime = looperState.loopPointA;
    }
  }

  /**
   * Attaches timeupdate listener to video element.
   * @param {HTMLVideoElement} video
   */
  function attachLooperToVideo(video) {
    if (!video) return;
    if (looperState.activeVideo === video && looperState._timeUpdateHandler) return;

    if (looperState.activeVideo && looperState._timeUpdateHandler && typeof looperState.activeVideo.removeEventListener === 'function') {
      looperState.activeVideo.removeEventListener('timeupdate', looperState._timeUpdateHandler);
    }

    looperState.activeVideo = video;
    looperState._timeUpdateHandler = () => handleVideoTimeUpdate(video);

    if (typeof video.addEventListener === 'function') {
      video.addEventListener('timeupdate', looperState._timeUpdateHandler);
    }
  }

  /**
   * Sets Loop Point A to the current playback time.
   * @param {HTMLVideoElement|null} video
   * @param {Document|null} doc
   * @returns {number|null}
   */
  function setLoopPointA(video = getActiveVideo(), doc = (typeof document !== 'undefined' ? document : null)) {
    if (!video) return null;
    const time = Math.max(0, video.currentTime || 0);
    looperState.loopPointA = time;

    if (looperState.loopPointB !== null) {
      if (looperState.loopPointB <= looperState.loopPointA) {
        looperState.loopPointB = null;
        looperState.isLooping = false;
      } else {
        looperState.isLooping = true;
      }
    }

    attachLooperToVideo(video);

    const formattedA = formatTimestamp(looperState.loopPointA);
    showToast(`🔁 Loop Point A: ${formattedA}`, false, doc);

    const badgeText = looperState.loopPointB !== null
      ? `[${formattedA} ⇄ ${formatTimestamp(looperState.loopPointB)}]`
      : `[${formattedA} ⇄ --:--]`;
    updateLoopBadge(badgeText, doc);

    return looperState.loopPointA;
  }

  /**
   * Sets Loop Point B to the current playback time and activates looping.
   * @param {HTMLVideoElement|null} video
   * @param {Document|null} doc
   * @returns {number|null}
   */
  function setLoopPointB(video = getActiveVideo(), doc = (typeof document !== 'undefined' ? document : null)) {
    if (!video) return null;

    if (looperState.loopPointA === null) {
      looperState.loopPointA = 0;
    }

    let time = Math.max(0, video.currentTime || 0);
    if (time < looperState.loopPointA) {
      looperState.loopPointB = looperState.loopPointA;
      looperState.loopPointA = time;
    } else if (time === looperState.loopPointA) {
      looperState.loopPointB = looperState.loopPointA + 1;
    } else {
      looperState.loopPointB = time;
    }

    looperState.isLooping = true;
    attachLooperToVideo(video);

    const formattedA = formatTimestamp(looperState.loopPointA);
    const formattedB = formatTimestamp(looperState.loopPointB);
    showToast(`🔁 Looping: [${formattedA} ⇄ ${formattedB}]`, false, doc);
    updateLoopBadge(`[${formattedA} ⇄ ${formattedB}]`, doc);

    return looperState.loopPointB;
  }

  /**
   * Clears the active concept loop and removes the player badge.
   * @param {boolean} showNotification
   * @param {Document|null} doc
   */
  function clearLoop(showNotification = true, doc = (typeof document !== 'undefined' ? document : null)) {
    const hadActiveLoop = looperState.isLooping || looperState.loopPointA !== null || looperState.loopPointB !== null;
    looperState.loopPointA = null;
    looperState.loopPointB = null;
    looperState.isLooping = false;

    if (looperState.activeVideo && looperState._timeUpdateHandler && typeof looperState.activeVideo.removeEventListener === 'function') {
      looperState.activeVideo.removeEventListener('timeupdate', looperState._timeUpdateHandler);
    }
    looperState.activeVideo = null;
    looperState._timeUpdateHandler = null;

    removeLoopBadge(doc);

    if (showNotification && hadActiveLoop) {
      showToast('Loop cleared', false, doc);
    }
  }

  /**
   * Keyboard shortcut listener for comprehension tools.
   * @param {KeyboardEvent} e
   * @param {Document|null} doc
   */
  function handleKeyDown(e, doc = (typeof document !== 'undefined' ? document : null)) {
    if (!e) return;

    // Resolve true origin element across Shadow DOM boundary (YouTube Polymer / Web Components)
    const target = (e.composedPath && typeof e.composedPath === 'function' && e.composedPath()[0]) || e.target;

    // Critical safety guard: ignore typing in form inputs, textareas, contenteditable, or searchbox
    if (
      target &&
      (target.isContentEditable ||
        (typeof target.matches === 'function' &&
          target.matches('input, textarea, [contenteditable="true"], ytd-searchbox, ytd-searchbox *')) ||
        (typeof target.closest === 'function' &&
          target.closest('input, textarea, [contenteditable="true"], ytd-searchbox, ytd-commentbox, tp-yt-paper-input')))
    ) {
      return;
    }

    // Slide Capture: Alt + S (never 'c', strictly reserved for YouTube native captions)
    if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 's' || e.key === 'S' || e.code === 'KeyS')) {
      if (currentSettings.extensionEnabled && currentSettings.slideCaptureEnabled) {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        captureSlideFrame(getActiveVideo(doc), doc);
      }
      return;
    }

    // Looper controls require extension and abLooper to be active
    if (!currentSettings.extensionEnabled || !currentSettings.abLooperEnabled) {
      return;
    }

    // Set Loop Point A: '['
    if (!e.altKey && !e.ctrlKey && !e.metaKey && (e.key === '[' || e.code === 'BracketLeft')) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      setLoopPointA(getActiveVideo(doc), doc);
      return;
    }

    // Set Loop Point B: ']'
    if (!e.altKey && !e.ctrlKey && !e.metaKey && (e.key === ']' || e.code === 'BracketRight')) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      setLoopPointB(getActiveVideo(doc), doc);
      return;
    }

    // Clear Active Loop: '\' or 'Escape'
    if (!e.altKey && !e.ctrlKey && !e.metaKey && (e.key === '\\' || e.code === 'Backslash' || e.key === 'Escape')) {
      if (looperState.isLooping || looperState.loopPointA !== null || looperState.loopPointB !== null) {
        // Never call preventDefault on Escape to preserve native fullscreen exit
        if (e.key !== 'Escape' && typeof e.preventDefault === 'function') {
          e.preventDefault();
        }
        clearLoop(true, doc);
      }
      return;
    }
  }

  /**
   * Bootstrap extension lifecycle.
   */
  function init() {
    initSettings();
    initObserver();

    // Re-scan, reset errata toggle, and clear loop when YouTube completes client-side SPA navigation
    window.addEventListener('yt-navigate-finish', handleNavigation);

    // Register comprehension tools keyboard shortcuts (Alt+S, [, ], \, Escape)
    window.addEventListener('keydown', (e) => {
      handleKeyDown(e, document);
    });

    // Initial scan, button injection, and clean slate HUD when DOM is interactive
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        injectCommentsToggleButton();
        injectCleanSlateHUD();
        scheduleScan();
      }, { once: true });
    } else {
      injectCommentsToggleButton();
      injectCleanSlateHUD();
      scheduleScan();
    }
  }

  if (typeof window !== 'undefined') {
    init();
  }

  // Export internal helpers for Node.js automated test suites
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      DEFAULT_SETTINGS,
      VALID_MILESTONES,
      CARD_SELECTORS,
      getThumbnailUrl,
      isShortsUrl,
      extractVideoId,
      isLiveOrUpcoming,
      swapThumbnailImage,
      processCard,
      scanAndSwapThumbnails,
      restoreAllThumbnails,
      applyRootAttributes,
      toggleCommentsVisibility,
      injectCommentsToggleButton,
      teardownCommentsToggleButton,
      resetCommentsRevealedState,
      updateCommentsToggleButton,
      injectCleanSlateHUD,
      teardownCleanSlateHUD,
      formatTimestamp,
      getActiveVideo,
      showToast,
      updateLoopBadge,
      removeLoopBadge,
      captureSlideFrame,
      setLoopPointA,
      setLoopPointB,
      clearLoop,
      handleVideoTimeUpdate,
      handleKeyDown,
      _looperState: looperState,
      _getCurrentSettings: () => currentSettings,
      _setCurrentSettings: (s) => { currentSettings = { ...currentSettings, ...s }; }
    };
  }
})();
