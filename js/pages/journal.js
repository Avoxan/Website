/* Journal: reading progress, active table-of-contents entry, and the
   topic filter on the index. */
(function () {
  "use strict";
  var bar = document.querySelector("[data-progress]");
  var body = document.querySelector(".post-body");
  var links = Array.prototype.slice.call(document.querySelectorAll(".toc a[href^='#']"));
  var heads = links.map(function (a) { return document.getElementById(a.getAttribute("href").slice(1)); }).filter(Boolean);

  if (bar && body) {
    var tick = false;
    var update = function () {
      tick = false;
      var r = body.getBoundingClientRect();
      var total = r.height - window.innerHeight * 0.6;
      var p = Math.min(1, Math.max(0, -r.top / Math.max(1, total)));
      bar.parentNode.style.setProperty("--p", p.toFixed(4));
      bar.style.setProperty("--p", p.toFixed(4));
      var cur = -1;
      for (var i = 0; i < heads.length; i++) if (heads[i].getBoundingClientRect().top < 140) cur = i;
      links.forEach(function (a, j) { a.classList.toggle("on", j === cur); });
    };
    window.addEventListener("scroll", function () { if (!tick) { tick = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  // index filter
  var btns = Array.prototype.slice.call(document.querySelectorAll("[data-desk]"));
  var rows = Array.prototype.slice.call(document.querySelectorAll(".jx-list li[data-desk-of]"));
  btns.forEach(function (b) {
    b.addEventListener("click", function () {
      var d = b.getAttribute("data-desk");
      btns.forEach(function (x) { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      rows.forEach(function (r) { r.hidden = d !== "all" && r.getAttribute("data-desk-of") !== d; });
    });
  });
})();
