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

  var scriptRequested = false;
  function loadWidgetScript() {
    if (scriptRequested) return;
    scriptRequested = true;
    var s = document.createElement("script");
    s.src = WIDGET_JS;
    s.async = true;
    document.body.appendChild(s);
  }

  Array.prototype.forEach.call(nodes, prime);

  /* ── Load on approach ──────────────────────────────────────────
     rootMargin buys 400px of runway so the widget has started
     fetching by the time it scrolls into view. Browsers without
     IntersectionObserver simply load it immediately.             */
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          loadWidgetScript();
          io.disconnect();
          return;
        }
      }
    }, { rootMargin: "400px" });
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
