/* ═════════════════════════════════════════════════════════════════
   HERO SCROLL — scrubs video.currentTime in sync with scroll progress
   and cross-fades three text panels at 0–33%, 33–66%, 66–100%.

   Design notes:
   - Uses requestAnimationFrame, never touches video during scroll event
     directly (avoids Safari jank).
   - Sets currentTime only when the delta is meaningful (>1 frame).
   - Bails out cleanly if video fails to load or user prefers reduced
     motion — overlay still works as a static hero.
   ═════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var section = document.getElementById('hero-scroll');
  var video   = document.getElementById('hero-video');
  if (!section || !video) return;

  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return; // CSS already handles the static fallback.

  var panels = section.querySelectorAll('.hero-panel');
  var dots   = section.querySelectorAll('.progress-dot');
  var cue    = document.getElementById('hero-scroll-cue');

  var duration       = 0;
  var targetTime     = 0;
  var currentTime    = 0;
  var ticking        = false;
  var activePanel    = 0;
  var cueHidden      = false;
  var videoReady     = false;

  // Once metadata is ready we know the duration.
  function onMetadata() {
    duration = video.duration || 0;
    videoReady = duration > 0;
    // Nudge first frame into the buffer so scrub feels instant.
    try { video.currentTime = 0.001; } catch (e) {}
    update();
  }
  if (video.readyState >= 1) onMetadata();
  else video.addEventListener('loadedmetadata', onMetadata, { once: true });

  // If the video errors, the poster stays — that's an acceptable hero too.
  video.addEventListener('error', function () { videoReady = false; });

  function setActivePanel(idx) {
    if (idx === activePanel) return;
    panels.forEach(function (p, i) {
      var isActive = i === idx;
      p.classList.toggle('is-active', isActive);
      if (isActive) p.removeAttribute('aria-hidden');
      else p.setAttribute('aria-hidden', 'true');
    });
    dots.forEach(function (d, i) {
      d.classList.toggle('is-active', i === idx);
    });
    activePanel = idx;
  }

  function update() {
    var rect = section.getBoundingClientRect();
    var viewportH = window.innerHeight;
    // Scrollable distance inside the sticky stage.
    var scrollable = rect.height - viewportH;
    if (scrollable <= 0) { ticking = false; return; }

    // 0 at section top hitting viewport top, 1 at section bottom.
    var progress = (-rect.top) / scrollable;
    if (progress < 0) progress = 0;
    else if (progress > 1) progress = 1;

    // Hide the scroll cue after the user moves even a little.
    if (!cueHidden && progress > 0.04 && cue) {
      cue.classList.add('is-hidden');
      cueHidden = true;
    }

    // Map progress → video time. Stop a frame short of the end so the
    // final frame doesn't trigger the "ended" state and lose decode.
    if (videoReady) {
      targetTime = progress * (duration - 0.05);
      // Only seek if the delta is at least one frame (1/24s ≈ 0.04s).
      if (Math.abs(targetTime - currentTime) > 0.04) {
        try {
          video.currentTime = targetTime;
          currentTime = targetTime;
        } catch (e) { /* Seek can throw mid-load; ignore. */ }
      }
    }

    // Panel: 0..0.33 → 0, 0.33..0.66 → 1, 0.66..1 → 2.
    var panelIdx = progress < 0.34 ? 0 : (progress < 0.67 ? 1 : 2);
    setActivePanel(panelIdx);

    ticking = false;
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  // Initial sync after first paint.
  requestAnimationFrame(update);
})();
