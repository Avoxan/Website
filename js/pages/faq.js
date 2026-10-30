/* /faq — live search with highlighting, topic filter, "/" to focus search,
   and deep links (#question-id) that open the answer they point to. */
(function () {
  "use strict";
  var input = document.querySelector("[data-seek]");
  var items = Array.prototype.slice.call(document.querySelectorAll(".fq details[data-cat]"));
  var groups = Array.prototype.slice.call(document.querySelectorAll("[data-group]"));
  var btns = Array.prototype.slice.call(document.querySelectorAll("[data-cat-btn]"));
  var meta = document.querySelector("[data-meta]");
  var empty = document.querySelector("[data-empty]");
  var emptyQ = document.querySelector("[data-empty-q]");
  var emptyMail = document.querySelector("[data-empty-mail]");
  if (!input || !items.length) return;

  var cat = "all";

  // Keep each question's original markup so highlights can be redone cleanly.
  items.forEach(function (d) {
    d.__q = d.querySelector("summary").innerHTML;
    d.__a = d.querySelector("p").innerHTML;
    d.__text = d.textContent.toLowerCase();
  });

  // Counts per topic
  var counts = { all: items.length };
  items.forEach(function (d) { counts[d.dataset.cat] = (counts[d.dataset.cat] || 0) + 1; });
  Array.prototype.forEach.call(document.querySelectorAll("[data-count]"), function (s) {
    s.textContent = counts[s.dataset.count] || 0;
  });

  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  // Highlight text nodes only, never inside tags or links' attributes.
  function mark(htmlStr, words) {
    if (!words.length) return htmlStr;
    var re = new RegExp("(" + words.map(escRe).join("|") + ")", "gi");
    return htmlStr.replace(/(<[^>]+>)|([^<]+)/g, function (m, tag, text) {
      return tag ? tag : text.replace(re, "<mark>$1</mark>");
    });
  }

  function apply() {
    var q = input.value.trim().toLowerCase();
    var words = q.split(/\s+/).filter(function (w) { return w.length > 1; });
    var shown = 0;
    items.forEach(function (d) {
      var inCat = cat === "all" || d.dataset.cat === cat;
      var hit = !words.length || words.every(function (w) { return d.__text.indexOf(w) !== -1; });
      var show = inCat && hit;
      if (show) d.removeAttribute("data-hide"); else d.setAttribute("data-hide", "");
      d.querySelector("summary").innerHTML = mark(d.__q, words);
      d.querySelector("p").innerHTML = mark(d.__a, words);
      if (show) shown++;
      if (words.length && show && !d.__wasOpen) d.open = true;
      if (!words.length && d.__autoOpened) d.open = false;
      d.__autoOpened = !!(words.length && show);
    });
    groups.forEach(function (g) {
      var any = g.querySelector("details:not([data-hide])");
      if (any) g.removeAttribute("data-hide"); else g.setAttribute("data-hide", "");
    });
    if (empty) {
      empty.hidden = shown > 0;
      if (!shown) {
        emptyQ.textContent = input.value.trim();
        emptyMail.href = "mailto:hello@avoxan.com?subject=" + encodeURIComponent("FAQ question: " + input.value.trim());
      }
    }
    if (meta) {
      meta.textContent = words.length
        ? shown + (shown === 1 ? " answer" : " answers") + " for “" + input.value.trim() + "”"
        : "";
    }
  }

  var t;
  input.addEventListener("input", function () { clearTimeout(t); t = setTimeout(apply, 90); });

  btns.forEach(function (b) {
    b.addEventListener("click", function () {
      cat = b.dataset.catBtn;
      btns.forEach(function (x) { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      apply();
      var top = document.getElementById("faq").getBoundingClientRect().top + window.scrollY - 90;
      if (window.scrollY > top) window.scrollTo({ top: top, behavior: "smooth" });
    });
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && document.activeElement !== input && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
      e.preventDefault();
      input.focus();
    }
  });

  // Track manual opens so search doesn't close what someone opened themselves.
  items.forEach(function (d) {
    d.addEventListener("toggle", function () { if (!d.__autoOpened) d.__wasOpen = d.open; });
  });

  function openHash() {
    var id = decodeURIComponent(location.hash.slice(1));
    var d = id && document.getElementById(id);
    if (d && d.tagName === "DETAILS") { d.open = true; d.scrollIntoView({ block: "start" }); }
  }
  window.addEventListener("hashchange", openHash);
  openHash();
})();
