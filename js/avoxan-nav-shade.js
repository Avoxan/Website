/* ──────────────────────────────────────────────────────────────────
   AVOXAN — notch nav backdrop ("the shade")
   ──────────────────────────────────────────────────────────────────
   Draws an iPhone-style notch hanging from the top of the page behind
   the centred nav links, pours it down on load, and widens it into an
   ordinary full-width header bar as the visitor scrolls.

   WHY IT EXISTS
   The light-mode hero is a photograph lit from the upper left, which
   leaves the top-right corner in shadow — exactly where the nav sits in
   near-black. The notch gives the links their own ground whatever the
   photo is doing, and turns a legibility fix into a piece of design.

   HOW THE MORPH WORKS
   No morph library. The whole shape is generated from four numbers, so
   the notch and the finished bar are the same path with different
   inputs and there is nothing to interpolate badly:

     half    half-width of the shape   notch width → full width
     depth   how far it hangs          notch depth → bar height
     rO      concave shoulder radius   → 0
     rI      bottom corner radius      → 0

   Two scalars drive those:
     drop  0 → 1   entrance: the shape grows down from the top edge
     flat  0 → 1   scroll:   the notch widens into the bar

   At flat = 1 the shoulders vanish, half reaches the full half-width
   and the path is an exact rectangle.

   PIXEL UNITS, NOT PROPORTIONS
   The viewBox is set to the nav's real pixel width and re-measured on
   resize. A stretched proportional viewBox would skew the corner radii
   into ellipses at wide viewports, which on a shape this recognisable
   reads immediately as wrong.

   SCOPE
   Homepage only — it binds to .hero, which no other page uses. Below
   1080px the links collapse into the burger menu, so there is nothing
   to wrap: it renders the plain bar instead.
   ────────────────────────────────────────────────────────────── */

(function () {
  "use strict";

  var nav = document.querySelector(".nv");
  var hero = document.querySelector(".hero");
  if (!nav || !hero) return;

  var inner = nav.querySelector(".nv-inner");
  var links = nav.querySelector(".nv-links");
  if (!inner || !links) return;

  var NOTCH_DEPTH = 62;   // how far the notch hangs at rest
  var BAR_HEIGHT  = 74;   // height of the finished header bar
  var SHOULDER    = 20;   // concave radius where the notch meets the top
  var CORNER      = 22;   // bottom corner radius of the notch
  var SIDE_PAD    = 30;   // breathing room each side of the link row
  var VIEW_H      = 96;   // tall enough for either state
  var SCROLL_RANGE = 140; // px of scroll from notch to bar
  var COLLAPSE_AT = 1080; // below this the links are in the burger menu

  var K = 0.5523; // circle-to-cubic constant

  var NS = "http://www.w3.org/2000/svg";
  var svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "nv-shade");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  var path = document.createElementNS(NS, "path");
  svg.appendChild(path);
  nav.insertBefore(svg, nav.firstChild);
  nav.classList.add("has-shade", "has-notch");

  var W = 0;          // nav width in px
  var notchHalf = 0;  // half-width of the notch at rest

  function measure() {
    W = nav.clientWidth || window.innerWidth;
    // The CTA and theme toggle are positioned out of flow in notch mode,
    // so this is the width of the link row alone — exactly what the
    // notch should wrap.
    var linkRow = links.getBoundingClientRect().width;
    notchHalf = Math.min(linkRow / 2 + SIDE_PAD, W / 2);
    svg.setAttribute("viewBox", "0 0 " + W + " " + VIEW_H);
  }

  /* ── Geometry ──────────────────────────────────────────────────
     Traced left to right: along the top edge, a concave shoulder down
     into the notch, down the side, round the bottom, up the far side,
     a mirrored shoulder back out, and along the top edge to the end.
     The top edge is a zero-height line, so only the notch is painted. */
  function buildPath(half, depth, rO, rI) {
    var cx = W / 2;
    var L = cx - half;
    var R = cx + half;

    // Never let a radius exceed the space available for it, or the
    // curves cross over themselves as the shape widens.
    rO = Math.min(rO, L, depth / 2);
    rI = Math.min(rI, half, depth / 2);

    var f = function (n) { return n.toFixed(2); };
    var d = "M0 0";
    d += " L" + f(L - rO) + " 0";
    d += " C" + f(L - rO + K * rO) + " 0 " + f(L) + " " + f(rO - K * rO) + " " + f(L) + " " + f(rO);
    d += " L" + f(L) + " " + f(depth - rI);
    d += " C" + f(L) + " " + f(depth - rI + K * rI) + " " + f(L + rI - K * rI) + " " + f(depth) + " " + f(L + rI) + " " + f(depth);
    d += " L" + f(R - rI) + " " + f(depth);
    d += " C" + f(R - rI + K * rI) + " " + f(depth) + " " + f(R) + " " + f(depth - rI + K * rI) + " " + f(R) + " " + f(depth - rI);
    d += " L" + f(R) + " " + f(rO);
    d += " C" + f(R) + " " + f(rO - K * rO) + " " + f(R + rO - K * rO) + " 0 " + f(R + rO) + " 0";
    d += " L" + f(W) + " 0 Z";
    return d;
  }

  var drop = 0;
  var flat = 0;

  function render() {
    // Collapsed nav: no link row to wrap, so it is always the plain bar.
    var collapsed = window.innerWidth <= COLLAPSE_AT;
    var t = collapsed ? 1 : flat;

    var half  = notchHalf + (W / 2 - notchHalf) * t;
    var depth = (NOTCH_DEPTH + (BAR_HEIGHT - NOTCH_DEPTH) * t) * drop;
    var rO    = SHOULDER * (1 - t);
    var rI    = CORNER * (1 - t);

    path.setAttribute("d", buildPath(half, depth, rO, rI));
    nav.classList.toggle("is-notched", !collapsed && t < 0.5);
  }

  /* ── Scroll: notch → bar ───────────────────────────────────────
     Passive and rAF-throttled, and bails when the value has not
     actually changed, so it costs at most one style write per frame. */
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

  function onResize() { measure(); render(); }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });

  // Web fonts change the link row's width when they swap in, which
  // would leave the notch cut to the wrong size.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(onResize).catch(function () {});
  }

  /* ── Entrance ──────────────────────────────────────────────────
     Skipped under prefers-reduced-motion, and when the page loads
     already scrolled — growing a notch under a nav that is meant to be
     a plain bar reads as a glitch on a refresh or a back button.    */
  var reduced = window.matchMedia &&
                window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  measure();
  flat = Math.min(1, Math.max(0, window.scrollY / SCROLL_RANGE));

  if (reduced || window.scrollY > 4) {
    drop = 1;
    render();
    return;
  }

  var DURATION = 850;
  var started = null;
  render(); // paint the zero-height state before the first frame

  requestAnimationFrame(function step(now) {
    if (started === null) started = now;
    var p = Math.min(1, (now - started) / DURATION);
    drop = 1 - Math.pow(1 - p, 3); // easeOutCubic
    render();
    if (p < 1) requestAnimationFrame(step);
  });
})();
