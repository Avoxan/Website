/* ==================================================================
   AVOXAN STUDIO — homepage behaviour
   No libraries. Everything here is enhancement: with this file blocked
   the page renders complete (the head script drops back to .no-js after
   3s if __avxReady never gets set).
   ================================================================== */
(function () {
  "use strict";
  window.__avxReady = true;

  var root = document.documentElement;
  var reduce = !root.classList.contains("motion");
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------- header: solid after the hero, hides on scroll down ---------- */
  var hdr = $("#hdr"), lastY = 0;
  function onScrollHeader() {
    var y = window.scrollY;
    hdr.classList.toggle("is-solid", y > 40);
    // The chat launcher waits until the visitor starts scrolling, so it never
    // sits on top of a hero. Once shown it stays.
    if (y > 280) root.classList.add("chat-on");
    hdr.classList.toggle("is-hidden", y > 600 && y > lastY && !root.classList.contains("menu-open"));
    lastY = y;
  }

  /* ---------- mobile menu ---------- */
  var menuBtn = $("#menuBtn"), sheet = $("#sheet");
  function setMenu(open) {
    root.classList.toggle("menu-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    sheet.setAttribute("aria-hidden", String(!open));
    document.body.style.overflow = open ? "hidden" : "";
  }
  menuBtn.addEventListener("click", function () { setMenu(!root.classList.contains("menu-open")); });
  $$("a", sheet).forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { setMenu(false); closePlayer(); } });

  /* ---------- reveals ---------- */
  var revealIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add("in"); revealIO.unobserve(e.target); }
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  $$("[data-reveal], #weeks").forEach(function (el) { revealIO.observe(el); });

  /* ---------- palette: the page takes on each client's colours ---------- */
  var paletteIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var p = e.target.getAttribute("data-palette");
      if (p === "studio") root.removeAttribute("data-palette");
      else root.setAttribute("data-palette", p);
      var meta = $('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", getComputedStyle(root).getPropertyValue("--bg").trim() || "#0D0B09");
    });
  }, { rootMargin: "-48% 0px -48% 0px" });
  $$("[data-palette]").forEach(function (el) { paletteIO.observe(el); });
  // anything that is not a case study returns to the studio palette
  $$(".hero, .reel, .intro, .work-head, .make, .method, .book, .ftr").forEach(function (el) {
    el.setAttribute("data-palette", el.getAttribute("data-palette") || "studio");
    paletteIO.observe(el);
  });

  /* ---------- manifesto: words light up as you read ---------- */
  var words = $("[data-words]"), wordEls = [];
  if (words) {
    (function split(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (t) {
            if (!t) return;
            if (/^\s+$/.test(t)) { frag.appendChild(document.createTextNode(t)); return; }
            var s = document.createElement("span"); s.className = "w"; s.textContent = t;
            frag.appendChild(s); wordEls.push(s);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1) split(n);
      });
    })(words);
  }
  function onScrollWords() {
    if (!words) return;
    var r = words.getBoundingClientRect(), vh = window.innerHeight;
    var p = (vh * 0.85 - r.top) / (r.height + vh * 0.35);
    p = Math.max(0, Math.min(1, p));
    var lit = Math.round(p * wordEls.length);
    for (var i = 0; i < wordEls.length; i++) wordEls[i].classList.toggle("on", i < lit);
  }
  if (reduce) wordEls.forEach(function (w) { w.classList.add("on"); });

  /* ---------- parallax: the phone drifts against the browser ---------- */
  var floaters = $$("[data-speed]");
  function onScrollParallax() {
    var vh = window.innerHeight;
    floaters.forEach(function (el) {
      var r = el.parentElement.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      var d = (r.top + r.height / 2 - vh / 2);
      el.style.transform = "translate3d(0," + (d * parseFloat(el.getAttribute("data-speed"))).toFixed(1) + "px,0)";
    });
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      onScrollHeader();
      if (!reduce) { onScrollWords(); onScrollParallax(); }
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();

  /* ---------- films: only play when visible, never under reduced motion / save-data ---------- */
  var saveData = navigator.connection && (navigator.connection.saveData || /2g/.test(navigator.connection.effectiveType || ""));
  $$("video[autoplay]").forEach(function (v) {
    if (reduce || saveData) { v.removeAttribute("autoplay"); v.pause(); $$("source", v).forEach(function (s) { s.remove(); }); v.load(); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { if (v.preload === "none") v.preload = "auto"; var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        else v.pause();
      });
    }, { threshold: 0.05 });
    io.observe(v);
  });

  /* ---------- booking engine walkthrough ---------- */
  var tabs = $$(".steps [role=tab]"), panes = $$(".device .pane"), prog = $$(".device__prog i");
  var step = 0, timer = null, userTook = false;
  function show(i) {
    step = i;
    tabs.forEach(function (t, k) { t.setAttribute("aria-selected", String(k === i)); t.tabIndex = k === i ? 0 : -1; });
    panes.forEach(function (p, k) { p.classList.toggle("on", k === i); });
    prog.forEach(function (p, k) { p.classList.toggle("on", k <= i); });
  }
  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { userTook = true; stop(); show(i); });
    t.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); userTook = true; stop(); show((i + 1) % tabs.length); tabs[step].focus(); }
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); userTook = true; stop(); show((i + tabs.length - 1) % tabs.length); tabs[step].focus(); }
    });
  });
  function start() { if (reduce || userTook || timer) return; timer = setInterval(function () { show((step + 1) % tabs.length); }, 3600); }
  function stop() { clearInterval(timer); timer = null; }
  var engine = $("#engine");
  if (engine) new IntersectionObserver(function (es) { es[0].isIntersecting ? start() : stop(); }, { threshold: 0.35 }).observe(engine);

  /* ---------- the call room ---------- */
  var clock = $("#callTime"), secs = 42 * 60 + 13;
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  var room = $(".room"), roomOn = false;
  if (room) new IntersectionObserver(function (es) { roomOn = es[0].isIntersecting; }).observe(room);
  setInterval(function () {
    if (!roomOn) return;
    secs++;
    if (clock) clock.textContent = pad(Math.floor(secs / 3600)) + ":" + pad(Math.floor(secs / 60) % 60) + ":" + pad(secs % 60);
  }, 1000);

  var speakers = $$("#tiles .tile"), spk = 0;
  if (!reduce) setInterval(function () {
    if (!roomOn) return;
    speakers[spk].classList.remove("speaking");
    spk = (spk + 1) % speakers.length;
    speakers[spk].classList.add("speaking");
  }, 2800);

  // clips: a tile with a data-clip plays it; without one it stays a camera-off tile
  var player = $("#player"), pv = $("#playerV"), lastTile = null;
  $$("#tiles [data-clip]").forEach(function (t) {
    var src = t.getAttribute("data-clip"), poster = t.getAttribute("data-poster");
    if (!src) { t.setAttribute("aria-disabled", "true"); t.style.cursor = "default"; return; }
    if (poster) { var im = new Image(); im.src = poster; im.alt = ""; t.insertBefore(im, t.firstChild); }
    var label = $(".tile__play", t);
    if (label) label.innerHTML = '<svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M2 1l9 5-9 5z"/></svg>Play clip';
    t.setAttribute("aria-label", t.getAttribute("aria-label").replace(", clip pending", ", play clip"));
    t.addEventListener("click", function () {
      lastTile = t;
      pv.src = src;
      if (poster) pv.poster = poster;
      player.hidden = false;
      document.body.style.overflow = "hidden";
      var p = pv.play(); if (p && p.catch) p.catch(function () {});
      $("#playerX").focus();
    });
  });
  function closePlayer() {
    if (!player || player.hidden) return;
    pv.pause(); pv.removeAttribute("src"); pv.load();
    player.hidden = true;
    document.body.style.overflow = "";
    if (lastTile) lastTile.focus();
  }
  if (player) {
    $("#playerX").addEventListener("click", closePlayer);
    player.addEventListener("click", function (e) { if (e.target === player) closePlayer(); });
  }

  /* ---------- service rows: a preview follows the cursor ---------- */
  var peek = $("#peek"), peekImg = peek && $("img", peek);
  if (peek && matchMedia("(hover: hover) and (pointer: fine)").matches && !reduce) {
    var px = 0, py = 0, tx = 0, ty = 0, raf = null;
    function loop() {
      px += (tx - px) * 0.16; py += (ty - py) * 0.16;
      peek.style.left = px + "px"; peek.style.top = py + "px";
      raf = Math.abs(tx - px) + Math.abs(ty - py) > 0.5 ? requestAnimationFrame(loop) : null;
    }
    $$("[data-peek]").forEach(function (o) {
      o.addEventListener("mouseenter", function (e) {
        peekImg.src = o.getAttribute("data-peek");
        px = tx = e.clientX + 200; py = ty = e.clientY;
        peek.classList.add("on");
      });
      o.addEventListener("mousemove", function (e) { tx = e.clientX + 200; ty = e.clientY; if (!raf) raf = requestAnimationFrame(loop); });
      o.addEventListener("mouseleave", function () { peek.classList.remove("on"); });
    });
  }
})();

/* ---------- forms: post to /api/contact without leaving the page ---------- */
(function () {
  "use strict";
  Array.prototype.forEach.call(document.querySelectorAll("form[data-form]"), function (form) {
    var status = form.querySelector("[data-form-status]");
    var btn = form.querySelector("button[type=submit]");
    function say(msg, state) { if (!status) return; status.hidden = false; status.textContent = msg; status.setAttribute("data-state", state); }
    form.addEventListener("submit", function (e) {
      if (!window.fetch || !window.FormData) return; // plain POST fallback
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var label = btn ? btn.innerHTML : "";
      if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }
      fetch(form.action, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } })
        .then(function (r) { return r.json().catch(function () { return { ok: r.ok }; }); })
        .then(function (d) {
          if (d && d.ok) {
            say(form.getAttribute("data-success") || "Got it. We'll get back to you within one business day.", "ok");
            form.reset();
            if (window.gtag) try { window.gtag("event", "form_submit", { form_name: form.getAttribute("data-form") }); } catch (x) {}
          } else {
            say((d && d.error) || "That didn't go through. Try again, or email hello@avoxan.com.", "err");
          }
        })
        .catch(function () { say("That didn't go through. Try again, or email hello@avoxan.com.", "err"); })
        .then(function () { if (btn) { btn.disabled = false; btn.innerHTML = label; } });
    });
  });
})();
