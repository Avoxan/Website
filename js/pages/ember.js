/* ==================================================================
   Homepage hero: the enchanted film.

   The ember silk film stays the star. On top of it:
   - a warm light that follows the pointer (or finger) and lifts the
     silk wherever it passes
   - embers that drift up off the ribbon, gather toward the light and
     burst outward on a click or tap
   - a little depth: the film shifts against the pointer, and against
     the device's tilt on phones
   The ignition reveal and the sheen on "small." are pure CSS.

   Manners: it starts only after the page has loaded, pauses off
   screen and in background tabs, sheds embers if frames run slow,
   and is skipped entirely under reduced motion or Data Saver.
   ================================================================== */
(function () {
  "use strict";
  var root = document.documentElement;
  var hero = document.querySelector(".hero");
  var film = document.querySelector("[data-ember]");
  if (!hero || !film || !root.classList.contains("motion")) return;
  var conn = navigator.connection;
  if (conn && (conn.saveData || /2g/.test(conn.effectiveType || ""))) return;

  var light = film.querySelector(".hero__light");
  var flare = film.querySelector(".hero__flare");
  var video = film.querySelector("video");
  var coarse = window.matchMedia("(pointer: coarse)").matches;

  function start() {
    var canvas = document.createElement("canvas");
    canvas.className = "embers";
    canvas.setAttribute("aria-hidden", "true");
    var ctx = canvas.getContext("2d");
    if (!ctx) return;
    film.insertBefore(canvas, light ? light.nextSibling : null);

    // one soft glowing ember, drawn once and stamped many times
    var sprite = document.createElement("canvas");
    sprite.width = sprite.height = 64;
    var sc = sprite.getContext("2d");
    var g = sc.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,236,214,1)");
    g.addColorStop(0.16, "rgba(255,170,104,.9)");
    g.addColorStop(0.42, "rgba(228,112,63,.3)");
    g.addColorStop(1, "rgba(228,112,63,0)");
    sc.fillStyle = g; sc.fillRect(0, 0, 64, 64);

    // a four-point glint, for the magic dust behind the cursor
    var star = document.createElement("canvas");
    star.width = star.height = 64;
    var st = star.getContext("2d");
    var sg = st.createRadialGradient(32, 32, 0, 32, 32, 9);
    sg.addColorStop(0, "rgba(255,246,232,1)"); sg.addColorStop(1, "rgba(255,190,130,0)");
    st.fillStyle = sg; st.fillRect(0, 0, 64, 64);
    [[0, 1], [1, 0]].forEach(function (d) {
      var lg = d[0] ? st.createLinearGradient(0, 32, 64, 32) : st.createLinearGradient(32, 0, 32, 64);
      lg.addColorStop(0, "rgba(255,200,150,0)"); lg.addColorStop(0.5, "rgba(255,240,222,.95)"); lg.addColorStop(1, "rgba(255,200,150,0)");
      st.fillStyle = lg;
      if (d[0]) st.fillRect(0, 31, 64, 2); else st.fillRect(31, 0, 2, 64);
    });

    var W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2), mobile = false;
    function resize() {
      var r = film.getBoundingClientRect();
      W = r.width; H = r.height;
      mobile = W < 860;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    // where the silk sits on screen, so embers rise off the ribbon itself
    function spawnPoint() {
      var u = Math.random(), j = Math.random() - 0.5;
      if (mobile) return { x: W * (0.1 + 0.9 * u), y: H * (0.42 - 0.36 * u) + j * H * 0.16 };
      return { x: W * (0.4 + 0.6 * u), y: H * (0.8 - 0.64 * u) + j * H * 0.24 };
    }
    var MAX = mobile ? 90 : 170;
    var P = [];
    function make(x, y, burst) {
      var p = spawnPoint();
      var a = Math.random() * Math.PI * 2, sp = burst ? 1.2 + Math.random() * 3.4 : 0;
      return {
        x: x != null ? x : p.x, y: y != null ? y : p.y,
        vx: burst ? Math.cos(a) * sp : (Math.random() - 0.5) * 0.25,
        vy: burst ? Math.sin(a) * sp : -(0.25 + Math.random() * 0.6),
        life: 0, max: burst ? 60 + Math.random() * 50 : 200 + Math.random() * 260,
        size: burst ? 5 + Math.random() * 10 : 4 + Math.random() * 11,
        seed: Math.random() * 100
      };
    }
    // dust: short-lived glints shed by the cursor and by the comet
    var D = [];
    function dust(x, y, spread, kind) {
      if (D.length > 260) return;
      var a = Math.random() * Math.PI * 2, sp = Math.random() * spread;
      D.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.25, life: 0,
        max: 34 + Math.random() * 40, size: 3 + Math.random() * 7, star: kind === "star" || Math.random() < 0.28, seed: Math.random() * 100 });
    }

    // the comet: a point of light that glides along the silk every few seconds
    function path(u) {
      // a cubic curve laid over the ribbon in the film
      var P = mobile
        ? [[-0.08, 0.42], [0.28, 0.06], [0.62, 0.42], [1.08, 0.04]]
        : [[0.44, 1.04], [0.52, 0.40], [0.74, 0.22], [1.04, 0.06]];
      var v = 1 - u, b0 = v * v * v, b1 = 3 * v * v * u, b2 = 3 * v * u * u, b3 = u * u * u;
      return [W * (b0 * P[0][0] + b1 * P[1][0] + b2 * P[2][0] + b3 * P[3][0]), H * (b0 * P[0][1] + b1 * P[1][1] + b2 * P[2][1] + b3 * P[3][1])];
    }
    var comet = null, nextComet = 2.4;
    for (var i = 0; i < MAX; i++) { var q = make(); q.life = Math.random() * q.max; P.push(q); }

    // pointer / finger, eased; the light drifts by itself when nobody steers it
    var mx = W * 0.68, my = H * 0.4, tx = mx, ty = my, active = 0, activeT = 0, lastMove = -1e9;
    function local(e) { var r = film.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    hero.addEventListener("pointermove", function (e) {
      var l = local(e);
      var dx = l[0] - tx, dy = l[1] - ty, n = Math.min(4, Math.floor(Math.sqrt(dx * dx + dy * dy) / 9));
      for (var j = 0; j < n; j++) dust(l[0] - dx * j / Math.max(1, n), l[1] - dy * j / Math.max(1, n), 0.9);
      tx = l[0]; ty = l[1]; activeT = 1; lastMove = performance.now();
    }, { passive: true });
    hero.addEventListener("pointerleave", function () { activeT = 0; lastMove = performance.now() - 2500; });
    hero.addEventListener("pointerdown", function (e) {
      if (e.target.closest("a,button")) return;
      var l = local(e);
      tx = l[0]; ty = l[1]; mx = tx; my = ty; activeT = 1; active = 1; lastMove = performance.now();
      for (var k = 0; k < (mobile ? 36 : 42); k++) { var b = make(l[0], l[1], true); if (mobile) b.size *= 1.35; P.push(b); }
      if (flare) {
        flare.style.setProperty("--fx", l[0] + "px"); flare.style.setProperty("--fy", l[1] + "px");
        flare.classList.remove("go"); void flare.offsetWidth; flare.classList.add("go");
      }
    }, { passive: true });

    // phones: depth from tilt (Android; iOS would need a permission prompt, so it simply drifts there)
    var tiltX = 0, tiltY = 0, ttx = 0, tty = 0;
    if (coarse && "DeviceOrientationEvent" in window && typeof DeviceOrientationEvent.requestPermission !== "function") {
      window.addEventListener("deviceorientation", function (e) {
        if (e.gamma == null) return;
        ttx = Math.max(-1, Math.min(1, e.gamma / 30));
        tty = Math.max(-1, Math.min(1, ((e.beta || 45) - 45) / 30));
      }, { passive: true });
    }

    var visible = true, running = false, t0 = performance.now(), last = t0, slow = 0;
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; kick(); }).observe(film);
    document.addEventListener("visibilitychange", kick);

    function frame(now) {
      if (!visible || document.hidden) { running = false; return; }
      var dt = Math.min(48, now - last); last = now;
      if (dt > 30 && ++slow > 50 && MAX > 30) { MAX = Math.round(MAX * 0.7); slow = 0; }
      var t = (now - t0) / 1000, k = dt / 16.7;

      if (now - lastMove > 3500) {
        tx = W * (mobile ? 0.6 : 0.7) + W * (mobile ? 0.25 : 0.16) * Math.sin(t * 0.23);
        ty = H * (mobile ? 0.2 : 0.42) + H * (mobile ? 0.08 : 0.12) * Math.sin(t * 0.17 + 1.3);
        activeT = 0.65;
      }
      mx += (tx - mx) * 0.08 * k; my += (ty - my) * 0.08 * k; active += (activeT - active) * 0.05 * k;
      tiltX += (ttx - tiltX) * 0.05 * k; tiltY += (tty - tiltY) * 0.05 * k;

      // light and depth: transforms and opacity only, so nothing repaints
      var px = mx / W - 0.5, py = my / H - 0.5;
      if (light) {
        light.style.transform = "translate3d(" + mx.toFixed(1) + "px," + my.toFixed(1) + "px,0)";
        light.style.opacity = (active * Math.min(1, t / 1.5)).toFixed(3);
      }
      if (video) video.style.transform = "translate3d(" + ((coarse ? tiltX : px) * -16).toFixed(2) + "px," + ((coarse ? tiltY : py) * -11).toFixed(2) + "px,0) scale(1.06)";

      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";
      var intro = Math.min(1, t / 1.8);
      for (var i = P.length - 1; i >= 0; i--) {
        var p = P[i];
        p.life += k;
        if (p.life > p.max) { if (P.length > MAX) { P.splice(i, 1); continue; } P[i] = make(); continue; }
        // a gentle curl, so embers wander instead of rising in straight lines
        var curl = Math.sin(p.y * 0.012 + t * 0.6 + p.seed) * 0.12 + Math.cos(p.x * 0.01 - t * 0.4 + p.seed) * 0.06;
        p.vx += curl * 0.05 * k + (coarse ? tiltX * 0.012 : 0);
        // drawn toward the light, and brighter near it
        var dx = mx - p.x, dy = my - p.y, d2 = dx * dx + dy * dy, near = Math.exp(-d2 / (mobile ? 9000 : 16000));
        p.vx += dx * 0.0002 * near * active * k; p.vy += dy * 0.0002 * near * active * k;
        p.vx *= 0.985; p.vy = p.vy * 0.985 - 0.004 * k;
        p.x += p.vx * k; p.y += p.vy * k;
        var f = p.life / p.max, fade = Math.min(1, f * 6) * (1 - f) * (1 - f);
        var tw = 0.65 + 0.35 * Math.sin(t * 3 + p.seed * 7);
        var a = fade * tw * (0.5 + 1.3 * near * active) * intro;
        if (a < 0.01) continue;
        var s = p.size * (0.7 + 0.6 * near * active);
        ctx.globalAlpha = Math.min(1, a);
        ctx.drawImage(sprite, p.x - s, p.y - s, s * 2, s * 2);
      }
      // the comet
      if (!comet && t > nextComet) comet = { u: 0, dur: mobile ? 2.6 : 2.3 };
      if (comet) {
        comet.u += dt / 1000 / comet.dur;
        if (comet.u >= 1) { comet = null; nextComet = t + 6 + Math.random() * 3; }
        else {
          var e = comet.u < 0.5 ? 2 * comet.u * comet.u : 1 - Math.pow(-2 * comet.u + 2, 2) / 2;
          var c = path(e), glow = Math.sin(Math.PI * comet.u);
          for (var m = 0; m < 3; m++) dust(c[0] + (Math.random() - 0.5) * 6, c[1] + (Math.random() - 0.5) * 6, 0.7);
          ctx.globalAlpha = 0.95 * glow;
          var hs = 34 + 20 * glow;
          ctx.drawImage(sprite, c[0] - hs, c[1] - hs, hs * 2, hs * 2);
          ctx.globalAlpha = glow;
          ctx.drawImage(star, c[0] - 22, c[1] - 22, 44, 44);
        }
      }
      // dust
      for (var d = D.length - 1; d >= 0; d--) {
        var q = D[d];
        q.life += k;
        if (q.life > q.max) { D.splice(d, 1); continue; }
        q.vx *= 0.96; q.vy = q.vy * 0.96 - 0.01 * k;
        q.x += q.vx * k; q.y += q.vy * k;
        var qf = q.life / q.max, qa = (1 - qf) * (0.7 + 0.3 * Math.sin(t * 9 + q.seed)) * intro;
        var qs = q.size * (q.star ? 1.6 - qf * 0.6 : 1 - qf * 0.5);
        ctx.globalAlpha = Math.min(1, qa);
        ctx.drawImage(q.star ? star : sprite, q.x - qs, q.y - qs, qs * 2, qs * 2);
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(frame);
    }
    function kick() {
      if (running || !visible || document.hidden) return;
      running = true; last = performance.now(); requestAnimationFrame(frame);
    }
    kick();
    requestAnimationFrame(function () { canvas.classList.add("on"); film.classList.add("is-live"); });
  }

  function later() {
    var go = function () { setTimeout(start, 1800); };
    if ("requestIdleCallback" in window) requestIdleCallback(go, { timeout: 1000 }); else go();
  }
  if (document.readyState === "complete") later(); else window.addEventListener("load", later);
})();
