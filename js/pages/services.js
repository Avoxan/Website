/* /services — light up the blueprint as each deliverable scrolls past */
(function () {
  "use strict";
  var wire = document.querySelector(".wire");
  var items = document.querySelectorAll(".dl__item");
  if (!wire || !items.length || !("IntersectionObserver" in window)) return;
  function on(n) {
    wire.classList.add("has-on");
    Array.prototype.forEach.call(wire.querySelectorAll("[data-n]"), function (el) {
      el.classList.toggle("on", el.getAttribute("data-n") === n);
    });
    Array.prototype.forEach.call(items, function (el) { el.classList.toggle("on", el.getAttribute("data-n") === n); });
  }
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) on(e.target.getAttribute("data-n")); });
  }, { rootMargin: "-45% 0px -45% 0px" });
  Array.prototype.forEach.call(items, function (el) { io.observe(el); });
})();
