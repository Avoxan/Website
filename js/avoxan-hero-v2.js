/* ============================================================
   AVOXAN V2 — WebGL hero
   A slow ember "terrain" of particles, breathing under the type.
   Degrades to a CSS gradient if WebGL/THREE is unavailable.
   ============================================================ */
(function () {
  "use strict";

  var THREE_SRC = "https://cdnjs.cloudflare.com/ajax/libs/three.js/0.158.0/three.min.js";

  var canvas = document.getElementById("hero-canvas");
  var hero = document.querySelector(".hero");
  if (!canvas || !hero) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function fallback() {
    canvas.remove();
    hero.classList.add("no-webgl");
  }

  /* ---------- Loading policy ----------
     This effect is decoration. three.js is ~128 KiB over the wire plus parse,
     compile and a shader build, and it used to be a plain <script defer> in the
     document — so it competed with the hero's own text for the main thread
     before first paint. Two changes: don't load it at all where it can't pay
     for itself, and everywhere else fetch it only once the page has loaded.
     The .no-webgl gradient is the designed fallback for exactly this. */
  var conn = navigator.connection || {};
  var skip =
    reduceMotion ||
    window.innerWidth < 768 ||                      /* phones: gradient instead */
    conn.saveData === true ||
    /(^|-)2g$/.test(conn.effectiveType || "") ||
    (navigator.hardwareConcurrency || 8) <= 4;      /* low-end CPUs */

  if (skip) { fallback(); return; }

  if (window.THREE) {
    boot();
  } else if (document.readyState === "complete") {
    loadThree();
  } else {
    window.addEventListener("load", loadThree, { once: true });
  }

  function loadThree() {
    /* one more beat after load so any remaining layout/paint work goes first */
    var idle = window.requestIdleCallback || function (fn) { return setTimeout(fn, 200); };
    idle(function () {
      var s = document.createElement("script");
      s.src = THREE_SRC;
      s.async = true;
      s.onload = function () { if (window.THREE) boot(); else fallback(); };
      s.onerror = fallback;
      document.head.appendChild(s);
    }, { timeout: 2000 });
  }

  function boot() {

  var THREE = window.THREE;
  var renderer, scene, camera, points, material;
  var mouseX = 0, mouseY = 0, targetX = 0, targetY = 0;
  var startTime = performance.now();
  var running = true;

  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    camera.position.set(0, 2.2, 8.5);
    camera.lookAt(0, 0, 0);

    /* Particle grid */
    var isSmall = window.innerWidth < 720;
    var COLS = isSmall ? 90 : 160;
    var ROWS = isSmall ? 55 : 90;
    var W = 26, D = 14;
    var count = COLS * ROWS;
    var positions = new Float32Array(count * 3);
    var seeds = new Float32Array(count);

    var k = 0;
    for (var iz = 0; iz < ROWS; iz++) {
      for (var ix = 0; ix < COLS; ix++) {
        positions[k * 3] = (ix / (COLS - 1) - 0.5) * W;
        positions[k * 3 + 1] = 0;
        positions[k * 3 + 2] = (iz / (ROWS - 1) - 0.5) * D;
        seeds[k] = Math.random();
        k++;
      }
    }

    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));

    material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 1.8) },
        uEmber: { value: new THREE.Color(0xE85D26) },
        uCream: { value: new THREE.Color(0xF2EBDC) },
        uDeep: { value: new THREE.Color(0x9C3A14) }
      },
      vertexShader: [
        "uniform float uTime;",
        "uniform float uPixelRatio;",
        "attribute float aSeed;",
        "varying float vH;",
        "varying float vSeed;",
        "varying float vDepth;",
        "void main(){",
        "  vec3 p = position;",
        "  float t = uTime * 0.45;",
        "  float h = 0.0;",
        "  h += sin(p.x * 0.55 + t) * 0.55;",
        "  h += sin(p.z * 0.85 + t * 1.35) * 0.4;",
        "  h += sin((p.x + p.z) * 0.3 - t * 0.8) * 0.55;",
        "  h += sin(p.x * 1.7 + p.z * 1.3 + t * 1.9) * 0.12;",
        "  p.y = h;",
        "  vH = h;",
        "  vSeed = aSeed;",
        "  vec4 mv = modelViewMatrix * vec4(p, 1.0);",
        "  vDepth = -mv.z;",
        "  gl_Position = projectionMatrix * mv;",
        "  float size = (1.4 + aSeed * 1.6) * uPixelRatio;",
        "  gl_PointSize = size * (9.0 / vDepth);",
        "}"
      ].join("\n"),
      fragmentShader: [
        "uniform vec3 uEmber;",
        "uniform vec3 uCream;",
        "uniform vec3 uDeep;",
        "varying float vH;",
        "varying float vSeed;",
        "varying float vDepth;",
        "void main(){",
        "  vec2 uv = gl_PointCoord - 0.5;",
        "  float d = length(uv);",
        "  if(d > 0.5) discard;",
        "  float soft = smoothstep(0.5, 0.05, d);",
        "  float crest = smoothstep(0.2, 1.2, vH);",
        "  vec3 col = mix(uDeep, uEmber, smoothstep(-1.2, 0.9, vH));",
        "  col = mix(col, uCream, crest * 0.55 * step(0.82, vSeed));",
        "  float fog = smoothstep(18.0, 6.0, vDepth);",
        "  float alpha = soft * fog * (0.25 + 0.75 * smoothstep(-1.4, 1.1, vH));",
        "  gl_FragColor = vec4(col, alpha * 0.85);",
        "}"
      ].join("\n")
    });

    points = new THREE.Points(geo, material);
    points.rotation.x = 0.12;
    scene.add(points);
  } catch (e) { fallback(); return; }

  function resize() {
    var w = hero.clientWidth, h = hero.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  window.addEventListener("mousemove", function (e) {
    targetX = (e.clientX / window.innerWidth - 0.5);
    targetY = (e.clientY / window.innerHeight - 0.5);
  }, { passive: true });

  /* Pause when hero off-screen or tab hidden */
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      running = entries[0].isIntersecting;
    }, { threshold: 0 }).observe(hero);
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) running = false;
    else if (!("IntersectionObserver" in window)) running = true;
  });

  (function tick() {
    requestAnimationFrame(tick);
    if (!running || document.hidden) return;
    var t = (performance.now() - startTime) / 1000;
    material.uniforms.uTime.value = t;
    mouseX += (targetX - mouseX) * 0.04;
    mouseY += (targetY - mouseY) * 0.04;
    camera.position.x = mouseX * 1.6;
    camera.position.y = 2.2 - mouseY * 0.9;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  })();

  }   /* boot */
})();
