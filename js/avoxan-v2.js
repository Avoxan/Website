/* ============================================================
   AVOXAN V2 — interactions
   GSAP + ScrollTrigger if available; graceful fallbacks otherwise.
   ============================================================ */
(function () {
  "use strict";

  var doc = document;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(pointer: fine)").matches;
  var hasGSAP = typeof window.gsap !== "undefined";
  var hasST = hasGSAP && typeof window.ScrollTrigger !== "undefined";

  if (hasST) window.gsap.registerPlugin(window.ScrollTrigger);
  doc.documentElement.classList.remove("no-js");

  /* ---------- Booking month (js-bk) ---------- */
  (function bookingMonths() {
    var MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    var now = new Date();
    var m = now.getMonth(), y = now.getFullYear();
    var nodes = doc.querySelectorAll(".js-bk");
    for (var i = 0; i < nodes.length; i++) {
      var kind = nodes[i].getAttribute("data-bk");
      if (kind === "m") nodes[i].textContent = MONTHS[m];
      else if (kind === "my") nodes[i].textContent = MONTHS[m] + " " + y;
      else if (kind === "range") {
        var m1 = (m + 1) % 12, m3 = (m + 3) % 12;
        nodes[i].textContent = MONTHS[m1] + " through " + MONTHS[m3];
      }
    }
  })();

  /* ---------- Nav: scrolled state + hide on scroll down ---------- */
  var nav = doc.querySelector(".nv");
  if (nav) {
    var lastY = window.scrollY;
    var onScrollNav = function () {
      var yNow = window.scrollY;
      nav.classList.toggle("is-scrolled", yNow > 30);
      if (yNow > 400 && yNow > lastY + 6 && !doc.body.classList.contains("menu-open")) {
        nav.classList.add("is-hidden");
      } else if (yNow < lastY - 4 || yNow < 200) {
        nav.classList.remove("is-hidden");
      }
      lastY = yNow;
    };
    window.addEventListener("scroll", onScrollNav, { passive: true });
    onScrollNav();
  }

  /* ---------- Mobile menu ---------- */
  var burger = doc.querySelector(".nv-burger");
  if (burger) {
    burger.addEventListener("click", function () {
      var open = doc.body.classList.toggle("menu-open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    doc.querySelectorAll(".menu-overlay a").forEach(function (a) {
      a.addEventListener("click", function () { doc.body.classList.remove("menu-open"); });
    });
  }

  /* ---------- Scroll progress bar ---------- */
  var prog = doc.querySelector(".scroll-progress");
  if (prog) {
    var onProg = function () {
      var h = doc.documentElement.scrollHeight - window.innerHeight;
      prog.style.transform = "scaleX(" + (h > 0 ? window.scrollY / h : 0) + ")";
    };
    window.addEventListener("scroll", onProg, { passive: true });
    onProg();
  }

  /* ---------- Custom cursor ---------- */
  if (finePointer && !reduceMotion) {
    var dot = doc.createElement("div"); dot.className = "cursor-dot";
    var ring = doc.createElement("div"); ring.className = "cursor-ring";
    doc.body.appendChild(dot); doc.body.appendChild(ring);
    var cx = -100, cy = -100, rx = -100, ry = -100;
    doc.addEventListener("mousemove", function (e) { cx = e.clientX; cy = e.clientY; });
    (function loopCursor() {
      rx += (cx - rx) * 0.16; ry += (cy - ry) * 0.16;
      dot.style.left = cx + "px"; dot.style.top = cy + "px";
      ring.style.left = rx + "px"; ring.style.top = ry + "px";
      requestAnimationFrame(loopCursor);
    })();
    doc.addEventListener("mouseover", function (e) {
      if (e.target.closest("a, button, summary, .booking-tab")) ring.classList.add("is-hover");
    });
    doc.addEventListener("mouseout", function (e) {
      if (e.target.closest("a, button, summary, .booking-tab")) ring.classList.remove("is-hover");
    });
  }

  /* ---------- Marquee: duplicate track for seamless loop ---------- */
  doc.querySelectorAll(".marquee-track").forEach(function (t) {
    t.innerHTML += t.innerHTML;
  });

  /* ---------- Split headlines into masked words ---------- */
  function splitWords(el) {
    var text = el.textContent;
    var words = text.split(/\s+/).filter(Boolean);
    el.setAttribute("aria-label", text);
    el.textContent = "";
    words.forEach(function (w, i) {
      var mask = doc.createElement("span");
      mask.className = "line-mask";
      mask.style.display = "inline-block";
      mask.setAttribute("aria-hidden", "true");
      var inner = doc.createElement("span");
      inner.className = "line-inner";
      inner.style.display = "inline-block";
      inner.textContent = w;
      mask.appendChild(inner);
      el.appendChild(mask);
      if (i < words.length - 1) el.appendChild(doc.createTextNode(" "));
    });
    return el.querySelectorAll(".line-inner");
  }

  /* ---------- Reveal system ---------- */
  function revealAllInstantly() {
    doc.querySelectorAll("[data-reveal]").forEach(function (el) {
      el.style.opacity = "1"; el.style.transform = "none";
    });
    doc.querySelectorAll(".line-mask .line-inner").forEach(function (el) {
      el.style.transform = "none";
    });
    doc.querySelectorAll(".line-mask").forEach(function (el) { el.style.overflow = "visible"; });
  }

  if (reduceMotion || !hasGSAP) {
    revealAllInstantly();
  } else {
    var gsap = window.gsap;

    /* Hero entrance (elements marked data-hero-stagger). The inner-page hero h1 is
       handled separately by heroHeadline() as a masked slide-up, so exclude it here
       to avoid double-animating (which caused the overlap/flash on load). */
    var heroEls = Array.prototype.filter.call(
      doc.querySelectorAll("[data-hero-stagger]"),
      function (el) { return !el.matches(".page-hero h1"); }
    );
    if (heroEls.length) {
      gsap.fromTo(heroEls,
        { opacity: 0, y: 46 },
        { opacity: 1, y: 0, duration: 1.1, ease: "power3.out", stagger: 0.12, delay: 0.15, clearProps: "transform" }
      );
    }
    /* Hero title: lines are pre-wrapped in .line-mask > .line-inner in the HTML
       (.line-inner starts at translateY(110%) via CSS; animate it home) */
    var heroTitle = doc.querySelector("[data-hero-title]");
    if (heroTitle) {
      gsap.to(heroTitle.querySelectorAll(".line-inner"), {
        y: 0, yPercent: 0,
        duration: 1.3, ease: "power4.out", stagger: 0.09, delay: 0.2,
        onComplete: function () { heroTitle.classList.add("reveal-done"); }
      });
    }

    if (hasST) {
      var ST = window.ScrollTrigger;

      /* Generic reveals */
      doc.querySelectorAll("[data-reveal]").forEach(function (el) {
        gsap.to(el, {
          opacity: 1, y: 0, duration: 1, ease: "power3.out",
          delay: parseFloat(el.getAttribute("data-reveal-delay") || 0),
          scrollTrigger: { trigger: el, start: "top 88%", once: true }
        });
      });

      /* Section headline word reveals */
      doc.querySelectorAll("[data-split]").forEach(function (el) {
        var inners2 = splitWords(el);
        gsap.to(inners2, {
          y: 0, duration: 1, ease: "power4.out", stagger: 0.045,
          scrollTrigger: { trigger: el, start: "top 86%", once: true },
          onComplete: function () { el.classList.add("reveal-done"); }
        });
      });

      /* Counters */
      doc.querySelectorAll("[data-count]").forEach(function (el) {
        var target = parseFloat(el.getAttribute("data-count"));
        var prefix = el.getAttribute("data-prefix") || "";
        var suffix = el.getAttribute("data-suffix") || "";
        var obj = { v: 0 };
        gsap.to(obj, {
          v: target, duration: 1.6, ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 90%", once: true },
          onUpdate: function () {
            el.textContent = prefix + Math.round(obj.v).toLocaleString("en-US") + suffix;
          }
        });
      });

      /* "What's included" is now a static 2-up grid — no scroll/pin animation. */

      /* Footer wordmark drift */
      var fword = doc.querySelector(".footer-word");
      if (fword) {
        gsap.fromTo(fword, { yPercent: 28 }, {
          yPercent: 0, ease: "none",
          scrollTrigger: { trigger: fword, start: "top bottom", end: "bottom bottom", scrub: 1 }
        });
      }

      /* Hero canvas fade-out on scroll */
      var heroSec = doc.querySelector(".hero");
      var heroCanvas = doc.getElementById("hero-canvas");
      if (heroSec && heroCanvas) {
        gsap.to(heroCanvas, {
          opacity: 0.15, ease: "none",
          scrollTrigger: { trigger: heroSec, start: "top top", end: "bottom top", scrub: true }
        });
      }

      /* Recalculate every trigger once async fonts/images settle, so the pinned
         rail never engages at a stale scroll position (the cause of the drift/overlap).
         Fires on load, when web fonts resolve, and once more as a safety net. */
      var stRefresh = function () { ST.refresh(); };
      window.addEventListener("load", stRefresh);
      if (document.fonts && document.fonts.ready) { document.fonts.ready.then(stRefresh).catch(function () {}); }
      setTimeout(stRefresh, 1500);
    } else {
      revealAllInstantly();
    }
  }

  /* ---------- Expandable process steps ---------- */
  doc.querySelectorAll(".step-row.expandable").forEach(function (row) {
    row.addEventListener("click", function (e) {
      if (e.target.closest("a") || e.target.closest(".step-extra")) return;
      row.classList.toggle("open");
    });
  });

  /* ---------- Booking tabs (contact page) ---------- */
  var tabs = doc.querySelectorAll(".booking-tab");
  if (tabs.length) {
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        tabs.forEach(function (t) {
          t.classList.remove("active");
          t.setAttribute("aria-selected", "false");
        });
        tab.classList.add("active");
        tab.setAttribute("aria-selected", "true");
        doc.querySelectorAll(".booking-panel").forEach(function (p) {
          var on = p.id === tab.getAttribute("data-panel");
          p.classList.toggle("active", on);
          p.hidden = !on;
        });
      });
    });
  }

  /* ---------- Form AJAX (any form[data-form]) ---------- */
  doc.querySelectorAll('form[data-form]').forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var status = form.querySelector("[data-form-status]");
      var btn = form.querySelector(".form-submit") || form.querySelector('[type="submit"]');
      var label = form.querySelector(".form-submit-label");
      var hp = form.querySelector('[name="bot-field"]');
      if (hp && hp.value) return;
      if (label) label.textContent = "Sending…";
      if (btn) btn.disabled = true;
      var data = new FormData(form);
      fetch(form.action, { method: "POST", body: data })
        .then(function (r) { return r.ok ? r.json().catch(function(){return {};}) : Promise.reject(r); })
        .then(function () {
          if (status) {
            status.hidden = false;
            status.classList.remove("error");
            status.textContent = "Got it. We'll reply within one business day, usually sooner.";
          }
          form.reset();
          if (label) label.textContent = "Sent ✓";
        })
        .catch(function () {
          if (status) {
            status.hidden = false;
            status.classList.add("error");
            status.textContent = "Hmm, that didn't go through. Email us directly at hello@avoxan.com.";
          }
          if (label) label.textContent = "Send the note";
        })
        .finally(function () { if (btn) btn.disabled = false; });
    });
  });

  /* ============================================================
     AWWWARDS FX LAYER — runs on every page via shared classes
     ============================================================ */
  var GS = window.gsap, STa = window.ScrollTrigger;

  /* 1. Inner-page hero headline reveal — masked slide-up like the homepage, but driven
     by a pure CSS transition (not GSAP) so it can NEVER strand half-way and spill over
     the deck. The whole headline is wrapped in ONE block mask (no per-line measuring →
     no font-load reflow); the mask reserves full height from frame 1, and its overflow
     only opens AFTER the slide finishes (.is-done) so nothing ever overlaps. */
  (function heroHeadline() {
    var h1 = doc.querySelector(".page-hero h1");
    if (!h1 || h1.getAttribute("data-fx") === "done") return;
    h1.setAttribute("data-fx", "done");
    h1.setAttribute("aria-label", h1.textContent);

    var inner = doc.createElement("span");
    inner.className = "hl-inner";
    while (h1.firstChild) inner.appendChild(h1.firstChild);   /* keeps .it/.acc spans intact */
    var mask = doc.createElement("span");
    mask.className = "hl-mask"; mask.setAttribute("aria-hidden", "true");
    mask.appendChild(inner);
    h1.appendChild(mask);

    if (reduceMotion) { h1.classList.add("is-in", "is-done"); return; }

    /* trigger the transition on the next frame so the initial (down) state paints first */
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { h1.classList.add("is-in"); });
    });
    inner.addEventListener("transitionend", function (e) {
      if (e.propertyName === "transform") h1.classList.add("is-done");
    }, { once: true });
    /* safety net in case transitionend never fires */
    setTimeout(function () { h1.classList.add("is-in", "is-done"); }, 2600);
  })();

  /* 2. Ambient ember canvas behind .page-hero (Canvas2D, matches WebGL ember language) */
  (function pageHeroEmbers() {
    if (reduceMotion) return;
    var ph = doc.querySelector(".page-hero");
    if (!ph) return;
    var cv = doc.createElement("canvas");
    cv.className = "ph-canvas"; cv.setAttribute("aria-hidden", "true");
    ph.insertBefore(cv, ph.firstChild);
    var ctx = cv.getContext("2d"); if (!ctx) { cv.remove(); return; }
    var W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2), parts = [], running = true;
    var mx = 0, my = 0, tmx = 0, tmy = 0;
    function mk(seed) {
      return { x: Math.random() * W, y: seed ? Math.random() * H : H + 12,
        r: 0.6 + Math.random() * 2.4, vy: 0.12 + Math.random() * 0.5,
        dx: (Math.random() - 0.5) * 0.3, ph: Math.random() * 6.28,
        fl: 0.55 + Math.random() * 0.45, cream: Math.random() < 0.16 };
    }
    function build() {
      var n = Math.max(22, Math.min(64, Math.round(W / 24)));
      parts = []; for (var i = 0; i < n; i++) parts.push(mk(true));
    }
    function size() {
      W = ph.clientWidth; H = ph.clientHeight;
      cv.width = W * DPR; cv.height = H * DPR; cv.style.width = W + "px"; cv.style.height = H + "px";
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); build();
    }
    function frame(t) {
      requestAnimationFrame(frame);
      if (!running || document.hidden) return;
      ctx.clearRect(0, 0, W, H);
      mx += (tmx - mx) * 0.05; my += (tmy - my) * 0.05;
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.y -= p.vy; p.x += p.dx + Math.sin(t / 1000 + p.ph) * 0.14;
        if (p.y < -12) { parts[i] = mk(false); continue; }
        var px = p.x + mx * 22 * (p.r / 2), py = p.y + my * 14 * (p.r / 2);
        var a = p.fl * (0.5 + 0.5 * Math.sin(t / 620 + p.ph)) * Math.min(1, (H - p.y) / H + 0.15) * 0.5;
        var col = p.cream ? "242,235,220" : "232,93,38";
        var g = ctx.createRadialGradient(px, py, 0, px, py, p.r * 6);
        g.addColorStop(0, "rgba(" + col + "," + a + ")");
        g.addColorStop(1, "rgba(" + col + ",0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, p.r * 6, 0, 6.2832); ctx.fill();
      }
    }
    size();
    window.addEventListener("resize", size);
    if (finePointer) {
      window.addEventListener("mousemove", function (e) {
        tmx = (e.clientX / window.innerWidth - 0.5); tmy = (e.clientY / window.innerHeight - 0.5);
      }, { passive: true });
    }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) { running = en[0].isIntersecting; }, { threshold: 0 }).observe(ph);
    }
    requestAnimationFrame(frame);
  })();

  /* 3. Magnetic buttons */
  if (finePointer && !reduceMotion) {
    doc.querySelectorAll(".btn-ember, .nv-cta").forEach(function (b) {
      b.classList.add("fx-mag");
      b.addEventListener("mousemove", function (e) {
        var r = b.getBoundingClientRect();
        var dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2;
        b.style.transform = "translate(" + (dx * 0.22) + "px," + (dy * 0.3) + "px)";
      });
      b.addEventListener("mouseleave", function () { b.style.transform = "translate(0px, 0px)"; });
    });
  }

  /* 4. Cursor-tracking spotlight on cards */
  if (finePointer) {
    var spotSel = ".why-card,.blog-card,.g-point,.addon-card,.rail-card,.bridge-card,.work-item,.side-card,.price-card,.ai-plan,.demo-player,.copy-snippet,.deliverable,.keynote";
    doc.querySelectorAll(spotSel).forEach(function (c) {
      c.classList.add("fx-spot");
      c.addEventListener("mousemove", function (e) {
        var r = c.getBoundingClientRect();
        c.style.setProperty("--mx", ((e.clientX - r.left) / r.width * 100) + "%");
        c.style.setProperty("--my", ((e.clientY - r.top) / r.height * 100) + "%");
      });
    });
  }

  /* 5. 3D tilt on feature surfaces */
  if (finePointer && !reduceMotion) {
    doc.querySelectorAll(".showcase-frame, .ai-plan, .price-card, .lead-card").forEach(function (c) {
      c.classList.add("fx-tilt");
      c.addEventListener("mousemove", function (e) {
        var r = c.getBoundingClientRect();
        var rx = ((e.clientY - r.top) / r.height - 0.5) * -5;
        var ry = ((e.clientX - r.left) / r.width - 0.5) * 5;
        c.style.transform = "perspective(1000px) rotateX(" + rx + "deg) rotateY(" + ry + "deg)";
      });
      c.addEventListener("mouseleave", function () { c.style.transform = ""; });
    });
  }

  /* 6. Scroll image wipe-reveal */
  if (hasST && !reduceMotion && GS) {
    doc.querySelectorAll(".showcase-frame img, .work-visual img").forEach(function (img) {
      img.classList.add("fx-img");
      GS.fromTo(img, { clipPath: "inset(0 0 100% 0)" }, {
        clipPath: "inset(0 0 0% 0)", duration: 1.2, ease: "power3.out",
        scrollTrigger: { trigger: img, start: "top 85%", once: true }
      });
    });
  }

  /* 7. Staggered article reveals (blog + case studies) */
  if (hasST && !reduceMotion && GS) {
    doc.querySelectorAll(".article").forEach(function (art) {
      var kids = Array.prototype.slice.call(art.children);
      if (!kids.length) return;
      GS.set(kids, { opacity: 0, y: 26 });
      if (STa && STa.batch) {
        STa.batch(kids, {
          start: "top 90%",
          onEnter: function (els) { GS.to(els, { opacity: 1, y: 0, duration: 0.8, ease: "power3.out", stagger: 0.07, overwrite: true }); }
        });
      } else {
        kids.forEach(function (el) {
          GS.to(el, { opacity: 1, y: 0, duration: 0.8, ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 90%", once: true } });
        });
      }
    });
  }

  /* ---------- Theme toggle (light / dark) ---------- */
  (function themeToggle() {
    var navInner = doc.querySelector(".nv-inner");
    if (!navInner) return;
    var burger = navInner.querySelector(".nv-burger");
    var btn = doc.createElement("button");
    btn.className = "theme-toggle";
    btn.type = "button";
    btn.setAttribute("aria-label", "Switch between light and dark mode");
    btn.innerHTML =
      '<svg class="ico-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>' +
      '<svg class="ico-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
    if (burger) navInner.insertBefore(btn, burger);
    else navInner.appendChild(btn);

    var root = doc.documentElement;
    function syncPressed() {
      btn.setAttribute("aria-pressed", root.classList.contains("light") ? "true" : "false");
    }
    syncPressed();

    var animTimer;
    btn.addEventListener("click", function () {
      root.classList.add("theme-anim");
      var light = !root.classList.contains("light");
      root.classList.toggle("light", light);
      try { localStorage.setItem("avoxan-theme", light ? "light" : "dark"); } catch (e) {}
      syncPressed();
      window.clearTimeout(animTimer);
      animTimer = window.setTimeout(function () { root.classList.remove("theme-anim"); }, 520);
    });
  })();

  /* ---------- Current year ---------- */
  doc.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
})();
