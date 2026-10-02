/* ==================================================================
   AVOXAN — /pricing behaviour
   Billing toggle, missed-call calculator, and the text-back demo.
   All enhancement: without this file the page shows monthly prices,
   the calculator's default result and the full demo conversation.

   PRICES: the monthly figures are the source of truth and are written
   into the HTML (crawlers do not run JS). Yearly = 10 x monthly, i.e.
   two months free. If a price changes, change it in the HTML, here,
   llms.txt, functions/api/chat.js and the JSON-LD on this page.
   ================================================================== */
(function () {
  "use strict";
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduce = !document.documentElement.classList.contains("motion");
  var fmt = function (n) { return "$" + Math.round(n).toLocaleString("en-US"); };

  /* ---------- monthly / yearly ---------- */
  var btns = $$(".toggle button");
  function setBilling(mode) {
    btns.forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-bill") === mode)); });
    $$(".plan .price").forEach(function (p) {
      var m = +p.getAttribute("data-monthly");
      var amt = $("b", p), per = $("div span", p), note = $("small", p);
      if (mode === "yearly") {
        amt.textContent = fmt(m * 10 / 12);
        per.textContent = "/month";
        note.textContent = fmt(m * 10) + " billed yearly · 2 months free";
      } else {
        amt.textContent = fmt(m);
        per.textContent = "/month";
        note.textContent = p.getAttribute("data-note") || "";
      }
    });
  }
  btns.forEach(function (b) { b.addEventListener("click", function () { setBilling(b.getAttribute("data-bill")); }); });

  /* ---------- missed-call calculator ---------- */
  var calc = $("#calc");
  if (calc) {
    var calls = $("#mc-calls"), value = $("#mc-value"), rate = $("#mc-rate");
    var oCalls = $("#mc-calls-o"), oValue = $("#mc-value-o"), oRate = $("#mc-rate-o");
    var big = $("#mc-big"), jobs = $("#mc-jobs"), year = $("#mc-year"), pay = $("#mc-pay"), rec = $("#mc-rec"), recBtn = $("#mc-rec-btn");
    function fill(el) { var p = (el.value - el.min) / (el.max - el.min) * 100; el.style.setProperty("--p", p + "%"); }
    function run() {
      [calls, value, rate].forEach(fill);
      var c = +calls.value, v = +value.value, r = +rate.value / 100;
      oCalls.textContent = c + " a week";
      oValue.textContent = fmt(v);
      oRate.textContent = Math.round(r * 100) + "%";
      var booked = c * 52 / 12 * r;
      var month = booked * v;
      big.textContent = fmt(month);
      jobs.textContent = booked < 1 ? "less than one job" : Math.round(booked) + (Math.round(booked) === 1 ? " job" : " jobs");
      year.textContent = fmt(month * 12);
      var plan, price;
      if (month >= 2000 || c >= 15) { plan = "Front Desk"; price = 397; }
      else if (month >= 500) { plan = "Answer"; price = 197; }
      else { plan = "Catch"; price = 97; }
      var need = Math.max(1, Math.ceil(price / v));
      pay.textContent = need === 1 ? "one booked job" : need + " booked jobs";
      rec.textContent = plan;
      recBtn.setAttribute("href", "#plan-" + plan.toLowerCase().replace(/\s+/g, "-"));
    }
    [calls, value, rate].forEach(function (el) { el.addEventListener("input", run); });
    run();
  }

  /* ---------- text-back demo plays when it scrolls into view ---------- */
  var thread = $(".thread");
  if (thread && !reduce && "IntersectionObserver" in window) {
    var items = $$(":scope > *", thread), played = false;
    var io = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting || played) return;
      played = true; io.disconnect();
      items.forEach(function (el, i) {
        var d = +(el.getAttribute("data-at") || i * 900);
        setTimeout(function () { el.classList.add("show"); }, d);
      });
    }, { threshold: 0.35 });
    io.observe(thread);
  } else if (thread) {
    $$(":scope > *", thread).forEach(function (el) { el.classList.add("show"); });
  }
})();
