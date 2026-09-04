/* ──────────────────────────────────────────────────────────────────
   AVOXAN — shaped nav backdrop ("the shade")
   ──────────────────────────────────────────────────────────────────
   Draws a full-width panel behind the nav whose bottom edge is a soft
   organic wave rather than a straight line, pours it down on load, and
   straightens it into an ordinary bar as the visitor scrolls.

   WHY IT EXISTS
   The light-mode hero is a photograph lit from the upper left, which
   leaves the top-right corner in shadow — exactly where the nav links
   sit in near-black. This guarantees the nav always has its own ground
   to sit on, whatever the photo behind it is doing, and turns a
   legibility fix into part of the design rather than a compromise.

   HOW THE MORPH WORKS
   No morph library. The bottom edge is a fixed set of anchor points,
   and the path is rebuilt from scratch each frame from two scalars:

     drop  0 → 1   entrance: the colour pours down from the top edge
     flat  0 → 1   scroll:   the wave straightens into a rectangle

   Because every state is generated from the same anchors, the command
   structure never changes and there is nothing to interpolate badly.

   SCOPE
   Homepage only. It hooks itself to .hero, which no other page uses,
   because the photo hero is the only place the problem exists.
   ────────────────────────────────────────────────────────────── */

(function () {
  "use strict";

  var nav = document.querySelector(".nv");
  var hero = document.querySelector(".hero");
  if (!nav || !hero) return;

  // Horizontal anchors across a 1000-unit viewBox. The SVG stretches to
  // any width (preserveAspectRatio="none"), so these are proportions,
  // not pixels — the wave widens with the viewport instead of tiling.
  var X = [0, 160, 340, 520, 700, 860, 1000];

  // Resting depth of the edge at each anchor, in viewBox units. Kept
  // deliberately irregular so it reads as drawn rather than as a sine
  // wave. Every value stays below the nav's own content (~75px) so no
  // link is ever left hanging off the bottom of the shade.
  var WAVE = [118, 88, 104, 90, 110, 96, 82];

  // Where the edge sits once fully straightened.
  var FLAT = 76;

  var VIEW_H = 160;
  var SCROLL_RANGE = 140; // px of scroll to go from full wave to flat

  /* ── Build the SVG ─────────────────────────────────────────────
     Injected rather than written into the HTML so that every page
     keeps one shared nav markup, and so a visitor without JS simply
     gets the nav exactly as it is today.                          */
  var NS = "http://www.w3.org/2000/svg";
  var svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "nv-shade");
  svg.setAttribute("viewBox", "0 0 1000 " + VIEW_H);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  var path = document.createElementNS(NS, "path");
  svg.appendChild(path);
  nav.insertBefore(svg, nav.firstChild);
  nav.classList.add("has-shade");

  /* ── Geometry ──────────────────────────────────────────────────
     A smooth cubic through each pair of anchors: control points sit a
     third of the way along horizontally and level with their own
     anchor vertically, which gives an even, hand-drawn-looking curve
     with no cusps at the joins.                                    */
  function buildPath(ys) {
    var last = ys.length - 1;
    var d = "M0 0 H1000 V" + ys[last].toFixed(2);
    for (var i = last - 1; i >= 0; i--) {
      var x1 = X[i + 1], y1 = ys[i + 1];
      var x0 = X[i], y0 = ys[i];
      var dx = (x1 - x0) / 3;
      d += " C" + (x1 - dx).toFixed(2) + " " + y1.toFixed(2) +
           " " + (x0 + dx).toFixed(2) + " " + y0.toFixed(2) +
           " " + x0.toFixed(2) + " " + y0.toFixed(2);
    }
    return d + " Z";
  }

  // On narrow screens the wave is shallower — at phone widths a deep
  // curve eats real estate above the fold for no benefit.
  function amplitude() {
    return window.innerWidth <= 640 ? 0.5 : 1;
  }

  var drop = 0; // entrance progress
  var flat = 0; // scroll-flatten progress

  function render() {
    var amp = amplitude();
    var ys = [];
    for (var i = 0; i < WAVE.length; i++) {
      var rest = FLAT + (WAVE[i] - FLAT) * amp; // shallower on mobile
      var y = rest + (FLAT - rest) * flat;      // straighten on scroll
      ys.push(y * drop);                        // pour down on load
    }
    path.setAttribute("d", buildPath(ys));
  }

  /* ── Scroll: wave → rectangle ──────────────────────────────────
     Own listener rather than piggybacking the nav's, so this file
     stays self-contained; it is passive and rAF-throttled, so it
     costs a single style write per frame at most.                 */
  var queued = false;
  function onScroll() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () {
      queued = false;
      var next = Math.min(1, Math.max(0, window.scrollY / SCROLL_RANGE));
      if (next === flat) return;
      flat = next;
      render();
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", function () { render(); }, { passive: true });

  /* ── Entrance ──────────────────────────────────────────────────
     Skipped entirely when the visitor prefers reduced motion, or when
     the page is restored part-scrolled (a refresh, or the back
     button) — pouring the colour down under a nav that is already
     supposed to be a plain bar would look like a glitch.           */
  var reduced = window.matchMedia &&
                window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  flat = Math.min(1, Math.max(0, window.scrollY / SCROLL_RANGE));

  if (reduced || window.scrollY > 4) {
    drop = 1;
    render();
    return;
  }

  var DURATION = 900;
  var started = null;
  render(); // paint the zero-height state before the first frame

  requestAnimationFrame(function step(now) {
    if (started === null) started = now;
    var p = Math.min(1, (now - started) / DURATION);
    // easeOutCubic — quick to arrive, settles gently
    drop = 1 - Math.pow(1 - p, 3);
    render();
    if (p < 1) requestAnimationFrame(step);
  });
})();
