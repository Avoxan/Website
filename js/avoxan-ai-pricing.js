/* Avoxan — single source of truth for the AI receptionist monthly price.
   Any element with a data-ai-price attribute is populated on load, so the
   price can be changed in ONE place and never drifts across pages. */

const AI = {
  currency: "$",
  amount: "397",            // Standard plan / month (limited-time founding price)
  period: "/month",
  note: "flat, no contract",
  minutes: "500",           // minutes included on Standard
  overage: "$0.40",         // per-minute rate beyond included minutes
  heavyAmount: "697",       // Growth plan / month
  heavyMinutes: "1,300"     // minutes included on Growth
};

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
