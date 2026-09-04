/* ──────────────────────────────────────────────────────────────────
   AVOXAN — Google Analytics 4 loader
   ──────────────────────────────────────────────────────────────────
   WHY THIS FILE EXISTS
   Until now the GA4 tag was not in this repository and not in the
   HTML served from it. Whatever was reporting into the GA property
   lived outside version control, which meant a deploy from this repo
   could silently stop all measurement with no visible symptom.
   This file makes the tag part of the codebase: reviewable, diffable,
   and deployed with everything else.

   ── SETUP: THE ONE THING YOU MUST DO ─────────────────────────────
   Paste your GA4 Measurement ID into MEASUREMENT_ID below.

   Where to find it:
     analytics.google.com → Admin (bottom-left gear)
     → Data collection and modification → Data streams
     → click your avoxan.com web stream
     → "MEASUREMENT ID" at the top right, format G-XXXXXXXXXX

   It is NOT the "Stream ID" (a plain number) and NOT the Firebase
   "App ID". It always starts with G- followed by 10 characters.

   The Measurement ID is public by design — it ships in the HTML of
   every site that uses GA4 and is safe to commit. It is an address
   to send data TO, not a credential; it grants nobody access to your
   reports.

   ── IF YOU LEAVE IT BLANK ────────────────────────────────────────
   Nothing loads and nothing breaks. No network request is made, no
   console errors, no layout impact. The site behaves exactly as it
   does today. This is deliberate so the file can be merged safely
   before you have the ID to hand.
   ────────────────────────────────────────────────────────────── */

(function () {
  "use strict";

  /* ▼▼▼ PASTE YOUR MEASUREMENT ID HERE ▼▼▼ */
  var MEASUREMENT_ID = "";
  /* ▲▲▲ e.g. "G-AB12CD34EF" ▲▲▲ */

  // No ID configured yet — do nothing at all.
  if (!MEASUREMENT_ID || MEASUREMENT_ID.indexOf("G-") !== 0) return;

  // Never report from a local preview or a Cloudflare Pages preview
  // deploy. Without this, your own development traffic lands in the
  // same reports as real visitors and quietly inflates every number.
  var host = location.hostname;
  var isProduction = host === "avoxan.com" || host === "www.avoxan.com";
  if (!isProduction) return;

  /* ── The standard Google tag ───────────────────────────────────
     dataLayer is the queue gtag() writes into. It must exist before
     gtag.js finishes loading, which is why it is declared here and
     not inside the script's onload. Anything pushed before the
     library arrives is replayed once it does, so no early event is
     lost to a race.                                              */
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;

  gtag("js", new Date());
  gtag("config", MEASUREMENT_ID, {
    // Cloudflare Pages serves clean, extensionless URLs. Sending the
    // path explicitly keeps GA's page paths matching the URLs people
    // actually visit and the ones listed in sitemap.xml.
    page_path: location.pathname + location.search
  });

  // Load the library itself. async (not defer) is what Google
  // specifies: the tag should start fetching immediately and must
  // not be held behind HTML parsing.
  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(MEASUREMENT_ID);
  document.head.appendChild(s);

  /* ── Adding conversion events later ────────────────────────────
     This file currently restores page-view measurement only, which
     is what was missing. To record a specific action, call:

       window.gtag('event', 'calendly_open', { page: location.pathname });

     Then mark that event name as a key event in GA4 under
     Admin → Data display → Events. Nothing else is required.     */
})();
