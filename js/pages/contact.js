/* /contact — live Houston clock, studio-open status, copy-email button. */
(function () {
  "use strict";
  var clock = document.querySelector("[data-clock]");
  var day = document.querySelector("[data-clock-day]");
  var status = document.querySelector("[data-status]");
  var statusText = document.querySelector("[data-status-text]");

  function parts() {
    var f = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago", weekday: "long", month: "long", day: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true
    });
    var o = {};
    f.formatToParts(new Date()).forEach(function (p) { o[p.type] = p.value; });
    var h24 = parseInt(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", hourCycle: "h23" }).format(new Date()), 10);
    return { o: o, h: h24 };
  }

  function tick() {
    if (!clock) return;
    var p;
    try { p = parts(); } catch (e) { return; }
    var o = p.o;
    clock.innerHTML = o.hour + ":" + o.minute + "<small>" + (o.dayPeriod || "") + "</small>";
    if (day) day.textContent = o.weekday + ", " + o.month + " " + o.day;
    var weekend = o.weekday === "Saturday" || o.weekday === "Sunday";
    var open = !weekend && p.h >= 9 && p.h < 18;
    if (status) status.setAttribute("data-open", open ? "1" : "0");
    if (statusText) {
      if (open) statusText.textContent = "We're in the studio. Expect a reply today.";
      else if (weekend || (o.weekday === "Friday" && p.h >= 18)) statusText.textContent = "It's the weekend here. We'll reply Monday morning.";
      else statusText.textContent = "After hours in Houston. We'll reply tomorrow morning.";
    }
  }
  tick();
  setInterval(tick, 15000);

  document.querySelectorAll("[data-copy]").forEach(function (b) {
    b.addEventListener("click", function () {
      var v = b.getAttribute("data-copy");
      var done = function () {
        b.setAttribute("data-done", "");
        b.textContent = "Copied";
        setTimeout(function () { b.removeAttribute("data-done"); b.textContent = "Copy"; }, 1800);
      };
      if (navigator.clipboard) navigator.clipboard.writeText(v).then(done, function () { location.href = "mailto:" + v; });
      else location.href = "mailto:" + v;
    });
  });
})();
