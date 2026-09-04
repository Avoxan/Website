/* ──────────────────────────────────────────────────────────────────
   AVOXAN — shared Calendly inline embed
   ──────────────────────────────────────────────────────────────────
   Renders a theme-matched Calendly booking widget into every element
   carrying [data-calendly-embed], and loads Calendly's widget.js only
   when one of those elements is about to enter the viewport.

   This logic previously lived inline in contact.html. It is shared
   now because /pricing, /services and /ai-receptionist each embed the
   booking widget directly rather than sending people to /contact
   first, and three copies of the same script would drift apart.

   WHY LAZY-LOADED: widget.js is a third-party request and an iframe.
   The booking section sits near the foot of long pages, so loading it
   on page load would slow the first screen for every visitor to buy
   something most of them scroll past. IntersectionObserver defers the
   cost until the widget is genuinely about to be seen.
   ────────────────────────────────────────────────────────────── */

(function () {
  "use strict";

  var BASE = "https://calendly.com/hello-avoxan/30min";
  var WIDGET_JS = "https://assets.calendly.com/assets/external/widget.js";

  var nodes = document.querySelectorAll("[data-calendly-embed]");
  if (!nodes.length) return;

  // Calendly takes its colors as URL parameters, so the widget has to
  // be told the theme up front; it cannot inherit CSS from the page.
  function colors() {
    return document.documentElement.classList.contains("light")
      ? { b: "f4eee1", t: "1c1813", p: "d2521c" }
      : { b: "14110e", t: "f2ebdc", p: "e85d26" };
  }

  function url() {
    var c = colors();
    return BASE + "?hide_event_type_details=1&hide_gdpr_banner=1"
      + "&background_color=" + c.b
      + "&text_color=" + c.t
      + "&primary_color=" + c.p;
  }

  // Set the themed URL BEFORE widget.js loads: its own auto-init reads
  // data-url off each .calendly-inline-widget and renders the correct
  // colors on first paint, with no flash of the wrong theme.
  function prime(el) {
    el.classList.add("calendly-inline-widget");
    el.setAttribute("data-url", url());
  }

  /* ── Hiding Calendly's white loading screen ────────────────────
     Calendly's iframe paints its own white loading state, which is a
     bright slab in the middle of a dark page for the second or two it
     takes to boot. It lives on calendly.com, so we cannot restyle it —
     the browser blocks cross-origin styling.

     What we can do is not show it. The shell renders our own themed
     skeleton, the iframe sits at opacity 0 on top of it, and we only
     fade the iframe in once it fires load. The visitor sees our
     placeholder, then the booking grid, and never the white flash.

     The iframe is created by Calendly's script, not by us, so we watch
     the container for it rather than querying once.               */
  function revealWhenLoaded(el) {
    function attach(frame) {
      if (!frame || frame.__avxBound) return false;
      frame.__avxBound = true;
      // Already complete (cache, bfcache) — no load event is coming.
      if (frame.contentWindow && frame.dataset.loaded !== "1") {
        frame.addEventListener("load", function () {
          frame.dataset.loaded = "1";
          el.setAttribute("data-calendly-state", "ready");
        });
      }
      return true;
    }

    if (attach(el.querySelector("iframe"))) return;

    var mo = new MutationObserver(function () {
      if (attach(el.querySelector("iframe"))) mo.disconnect();
    });
    mo.observe(el, { childList: true, subtree: true });

    // Safety net: if Calendly never fires load (blocked, offline, an
    // extension eating the frame), stop hiding it after 8s so the
    // visitor gets whatever Calendly managed to render, or its own
    // error state, rather than our skeleton forever.
    setTimeout(function () {
      el.setAttribute("data-calendly-state", "ready");
    }, 8000);
  }

  var scriptRequested = false;
  function loadWidgetScript() {
    if (scriptRequested) return;
    scriptRequested = true;
    var s = document.createElement("script");
    s.src = WIDGET_JS;
    s.async = true;
    document.body.appendChild(s);
  }

  Array.prototype.forEach.call(nodes, function (el) {
    prime(el);
    el.setAttribute("data-calendly-state", "loading");
    revealWhenLoaded(el);
  });

  /* ── Load on approach ──────────────────────────────────────────
     rootMargin buys 1200px of runway — roughly a full viewport of
     scrolling — so on a normal scroll the widget has usually finished
     booting before it reaches the screen, and the skeleton above is
     never seen at all. Still far short of loading it on page load,
     which is what we are avoiding: a visitor who never scrolls that
     far still pays nothing for it.

     Browsers without IntersectionObserver simply load it immediately. */
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          loadWidgetScript();
          io.disconnect();
          return;
        }
      }
    }, { rootMargin: "1200px" });
    Array.prototype.forEach.call(nodes, function (el) { io.observe(el); });
  } else {
    loadWidgetScript();
  }

  /* ── Re-theme on a live theme toggle ───────────────────────────
     Only re-inits widgets already rendered by Calendly; one that has
     not loaded yet still has the correct data-url waiting for it.  */
  var lastTheme = colors().b;
  new MutationObserver(function () {
    var now = colors().b;
    if (now === lastTheme) return;
    lastTheme = now;

    if (!window.Calendly || !window.Calendly.initInlineWidget) {
      // Not rendered yet — just refresh the pending data-url.
      Array.prototype.forEach.call(nodes, prime);
      return;
    }
    Array.prototype.forEach.call(nodes, function (el) {
      el.innerHTML = "";
      el.removeAttribute("data-url");
      window.Calendly.initInlineWidget({ url: url(), parentElement: el });
    });
  }).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"]
  });
})();
