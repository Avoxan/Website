/* ──────────────────────────────────────────────────────────────────
   AVOXAN — conversion events for GA4
   ──────────────────────────────────────────────────────────────────
   WHERE THE GOOGLE TAG ITSELF LIVES  (it is NOT in this repo)

   The Google tag is installed through Cloudflare's Google Tag Gateway,
   not through this codebase:

     Cloudflare dashboard → avoxan.com → Web tag management
                          → Google Tag Gateway
     Measurement ID: G-2P11WWJD5L

   Cloudflare injects <script async src="/jy26/"> into the HTML at the
   edge, after these files leave the server, and serves the Google tag
   first-party from avoxan.com rather than googletagmanager.com. That
   is why you will not find a tag anywhere in this repository, and why
   `curl` only shows it when the request sends an Accept: text/html
   header — the edge rewriter skips injection otherwise.

   ── THIS FILE DOES NOT LOAD A TAG ────────────────────────────────
   Loading a second Google tag would double-count every pageview.
   Tag Gateway already handles pageviews. What it does NOT do is
   record actions — a booking, a form submit, a chat opened. GA4 only
   knows what it is explicitly told, so those need this file.

   ── AFTER DEPLOYING, DO THIS ONCE ────────────────────────────────
   Each event below has to be marked as a conversion by hand:

     analytics.google.com → Admin → Data display → Events
     → toggle "Mark as key event" for:
          booking_scheduled   ← the one that matters, a real booking
          calendly_open
          form_submit
          chat_open
          phone_click

   Events appear in that list only after they have fired at least once,
   so give it 24 hours after launch before expecting to see them. Use
   Admin → DebugView to watch them arrive in real time.
   ────────────────────────────────────────────────────────────── */

(function () {
  "use strict";

  /* ── Talking to the tag Cloudflare injected ────────────────────
     Google's tag reads a global queue called dataLayer. Because the
     injected script is async, it may not have run yet when this file
     executes, so we make sure the queue exists and define the standard
     gtag() shim if it is not there. Anything queued before the tag
     arrives is replayed once it does, so no early event is lost.

     If Tag Gateway's script has already defined gtag, we leave it
     alone and use it — both paths write to the same dataLayer.      */
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== "function") {
    window.gtag = function () { window.dataLayer.push(arguments); };
  }

  // Never report the same event twice from one page load. Several of
  // the hooks below can fire repeatedly (a widget re-entering view, a
  // form resubmitted after a validation error) and each duplicate
  // would inflate the conversion count.
  var sent = {};
  function track(name, params) {
    if (sent[name]) return;
    sent[name] = true;
    var payload = params || {};
    payload.page_path = location.pathname;
    window.gtag("event", name, payload);
  }

  // Actions that can legitimately happen more than once per page.
  function trackRepeatable(name, params) {
    var payload = params || {};
    payload.page_path = location.pathname;
    window.gtag("event", name, payload);
  }

  /* ── 1. calendly_open ──────────────────────────────────────────
     The booking widget is an iframe, so we cannot see clicks inside
     it directly. What we can see is when it scrolls into view, which
     is the honest definition of "was offered the calendar".        */
  var embeds = document.querySelectorAll("[data-calendly-embed]");
  if (embeds.length && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          track("calendly_open");
          io.disconnect();
          return;
        }
      }
    }, { threshold: 0.3 });
    Array.prototype.forEach.call(embeds, function (el) { io.observe(el); });
  }

  /* ── 2. booking_scheduled — the actual conversion ──────────────
     Calendly posts messages out of its iframe as the visitor moves
     through it. event_scheduled means a call was really booked; it is
     the single most valuable signal on the site. The origin check
     matters: any page can postMessage, so without it a third party
     could fake bookings into your reports.                          */
  window.addEventListener("message", function (e) {
    if (typeof e.origin !== "string" || e.origin.indexOf("calendly.com") === -1) return;
    if (!e.data || typeof e.data.event !== "string") return;

    if (e.data.event === "calendly.event_scheduled") {
      track("booking_scheduled", { method: "calendly" });
    } else if (e.data.event === "calendly.date_and_time_selected") {
      track("calendly_time_selected");
    }
  });

  /* ── 3. form_submit ────────────────────────────────────────────
     Scoped to form[data-form], which covers the contact form and the
     AI-receptionist demo form. Deliberately excludes the chat widget's
     own form.avx-form — sending a chat message is not a lead.

     Bound in the capture phase so it still fires when the AJAX
     handler in avoxan-v2.js calls preventDefault().                */
  document.addEventListener("submit", function (e) {
    var form = e.target;
    if (!form || !form.matches || !form.matches("form[data-form]")) return;

    var kind = form.querySelector('input[name="form_type"]');
    trackRepeatable("form_submit", {
      form_name: form.getAttribute("data-form") || "unknown",
      form_type: kind ? kind.value : "unknown"
    });
  }, true);

  /* ── 4. chat_open ──────────────────────────────────────────────
     The widget mounts itself after this script runs, so we listen on
     the document rather than binding to a button that does not exist
     yet. Matches the launcher's [data-action="open"].              */
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('.avx-root [data-action="open"]')) track("chat_open");
  }, true);

  /* ── 5. phone_click ────────────────────────────────────────────
     No tel: links exist on the site today. This is here so that the
     moment one is added, it is measured without anyone remembering
     to come back to this file.                                     */
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var link = t.closest('a[href^="tel:"]');
    if (link) trackRepeatable("phone_click", { number: link.getAttribute("href").slice(4) });
  }, true);
})();
