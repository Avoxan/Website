/* Avoxan — single source of truth for the AI receptionist monthly price.
   Any element with a data-ai-price attribute is populated on load, so the
   price can be changed in ONE place and never drifts across pages.

   IMPORTANT — this file is NOT the whole story for search and AI crawlers.
   GPTBot, PerplexityBot, ClaudeBot and friends do not execute JavaScript, so
   they only ever see the hardcoded fallback inside each data-ai-price span.
   When you change `amount` or `minutes` below you MUST also update:
     1. the fallback text inside every [data-ai-price] span
        (pricing.html, ai-receptionist.html, services.html, houston-med-spas.html)
     2. the JSON-LD Offer in pricing.html <head>
     3. the meta/og description on pricing.html
     4. /llms.txt                      — what ChatGPT / Perplexity / Claude read
     5. functions/api/chat.js          — the site chatbot's system prompt
     6. js/avoxan-chat.js              — the widget's suggested-question chips
   Otherwise an AI assistant will quote a price you no longer charge. */

const AI = {
  currency: "$",
  amount: "397",            // Front Desk plan / month (the full plan the AI pages describe)
  period: "/month",
  note: "flat, no lock-in",
  minutes: "1,000",         // minutes included on Front Desk, a guide not a cap
  overage: "none",          // there is no per-minute overage billing on any plan
  heavyAmount: "197",       // kept for old markup: Answer plan / month
  heavyMinutes: "400",      // minutes included on Answer
  fromAmount: "97"          // Catch plan / month, the entry price ("from $97")
};
/* Plans (Oct 2026): Catch $97 (text-back), Answer $197 (400 min),
   Front Desk $397 (1,000 min). Yearly = 10x monthly. See /pricing#ai. */

(function () {
  function render() {
    var nodes = document.querySelectorAll("[data-ai-price]");
    nodes.forEach(function (el) {
      var mode = el.getAttribute("data-ai-price") || "full";
      switch (mode) {
        case "amount":
          el.textContent = AI.amount;
          break;
        case "currency":
          el.textContent = AI.currency;
          break;
        case "period":
          el.textContent = AI.period;
          break;
        case "note":
          el.textContent = AI.note;
          break;
        case "minutes":
          el.textContent = AI.minutes;
          break;
        case "overage":
          el.textContent = AI.overage;
          break;
        case "heavy-amount":
          el.textContent = AI.heavyAmount;
          break;
        case "heavy-minutes":
          el.textContent = AI.heavyMinutes;
          break;
        case "full":
        case "":
        default:
          el.textContent = AI.currency + AI.amount + AI.period;
      }
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();
