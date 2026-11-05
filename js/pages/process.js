/* /process — fill the calendar day by day as the section scrolls */
(function () {
  "use strict";
  var sec = document.querySelector(".cal-sec");
  if (!sec) return;
  var steps = Array.prototype.slice.call(sec.querySelectorAll("[data-step]"));
  var motion = document.documentElement.classList.contains("motion");
  if (!motion || window.matchMedia("(max-width: 900px)").matches) {
    steps.forEach(function (s) { s.classList.add("lit"); });
    return;
  }
  var ticking = false;
  function run() {
    ticking = false;
    var r = sec.getBoundingClientRect();
    var total = sec.offsetHeight - window.innerHeight;
    var p = Math.max(0, Math.min(1, -r.top / Math.max(1, total * 0.85)));
    var n = Math.round(p * steps.length);
    steps.forEach(function (s, i) {
      s.classList.toggle("lit", i < n);
      s.classList.toggle("today", i === n - 1 && n < steps.length);
    });
  }
  window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(run); } }, { passive: true });
  window.addEventListener("resize", run);
  run();
})();
