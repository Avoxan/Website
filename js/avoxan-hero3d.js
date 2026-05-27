/* ============================================================================
   AVOXAN — Interactive 3D particle hero background
   ----------------------------------------------------------------------------
   A subtle, on-brand field of warm "dust" floating behind the hero headline.
   Particles drift on their own and part around the cursor (GPU repulsion).

   Performance & accessibility guardrails (all enforced before we touch the GPU):
     • prefers-reduced-motion: reduce  -> never initialise (clean static hero)
     • small screens / coarse pointers  -> never initialise (mobile fallback)
     • no WebGL support                 -> never initialise (graceful fallback)
     • requestAnimationFrame loop, paused when the hero is off-screen or the
       tab is hidden, device-pixel-ratio capped, and torn down on resize churn.

   The canvas is purely decorative: aria-hidden + pointer-events:none so it can
   never block the CTA. Loaded only on the homepage, after Three.js (deferred).
   ============================================================================ */
(function () {
  'use strict';

  // ---- 0. Hard guardrails -------------------------------------------------
  if (typeof THREE === 'undefined') return;            // CDN failed — bail quietly
  const host = document.querySelector('.hero');
  if (!host) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isSmall      = window.matchMedia('(max-width: 768px)').matches;
  const coarse       = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  // Mobile fallback: leave the (already handsome) static hero untouched.
  if (reduceMotion || isSmall || coarse) return;

  // WebGL capability probe
  try {
    const test = document.createElement('canvas');
    if (!(test.getContext('webgl') || test.getContext('experimental-webgl'))) return;
  } catch (e) { return; }

  // ---- 1. Mount canvas (behind the hero text) -----------------------------
  const canvas = document.createElement('canvas');
  canvas.className = 'hero-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  host.prepend(canvas);

  // Warm Avoxan palette — kept low-contrast so it reads as texture, not noise.
  const PALETTE = [
    new THREE.Color('#C04A1F'), // sienna
    new THREE.Color('#8E3514'), // sienna-deep
    new THREE.Color('#5E6B4F'), // sage
    new THREE.Color('#2A2520'), // ink-soft
  ];

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0); // transparent — the cream page shows through
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(DPR);

  const scene  = new THREE.Scene();
  const CAM_Z  = 70;
  const camera = new THREE.PerspectiveCamera(60, 1, 1, 400);
  camera.position.z = CAM_Z;

  // Visible half-extents on the z=0 plane (used to map the mouse into world space)
  function planeExtents() {
    const halfH = Math.tan((camera.fov * Math.PI) / 360) * CAM_Z;
    return { halfH, halfW: halfH * camera.aspect };
  }

  // ---- 2. Build the particle field ----------------------------------------
  const COUNT = 1300;
  const positions = new Float32Array(COUNT * 3);
  const colors    = new Float32Array(COUNT * 3);
  const randoms   = new Float32Array(COUNT * 3); // phase, speed, size
  const SPREAD_X = 130, SPREAD_Y = 70, SPREAD_Z = 60;

  for (let i = 0; i < COUNT; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * SPREAD_X;
    positions[i * 3 + 1] = (Math.random() - 0.5) * SPREAD_Y;
    positions[i * 3 + 2] = (Math.random() - 0.5) * SPREAD_Z;

    const c = PALETTE[(Math.random() * PALETTE.length) | 0];
    colors[i * 3]     = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;

    randoms[i * 3]     = Math.random() * Math.PI * 2;   // phase
    randoms[i * 3 + 1] = 0.4 + Math.random() * 0.8;     // drift speed
    randoms[i * 3 + 2] = 0.6 + Math.random() * 1.6;     // size multiplier
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aColor',   new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aRandom',  new THREE.BufferAttribute(randoms, 3));

  const uniforms = {
    uTime:       { value: 0 },
    uMouse:      { value: new THREE.Vector2(9999, 9999) }, // start far away
    uRadius:     { value: 22.0 },   // repulsion reach (world units)
    uStrength:   { value: 14.0 },   // how hard particles are pushed
    uPixelRatio: { value: DPR },
    uOpacity:    { value: 0.0 },    // faded in after first frame
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    // Normal blending (not additive) so dark particles stay subtle on cream.
    vertexShader: `
      uniform float uTime;
      uniform vec2  uMouse;
      uniform float uRadius;
      uniform float uStrength;
      uniform float uPixelRatio;
      attribute vec3 aColor;
      attribute vec3 aRandom;
      varying vec3  vColor;
      varying float vFade;
      void main() {
        vColor = aColor;
        float phase = aRandom.x;
        float spd   = aRandom.y;
        vec3 pos = position;
        // Gentle, looping autonomous drift
        pos.x += sin(uTime * spd + phase) * 2.2;
        pos.y += cos(uTime * spd * 0.9 + phase) * 2.0;
        pos.z += sin(uTime * spd * 0.7 + phase * 1.3) * 2.0;
        // Cursor repulsion in the view plane — particles part around the mouse
        vec2 toMouse = pos.xy - uMouse;
        float d = length(toMouse);
        float force = smoothstep(uRadius, 0.0, d) * uStrength;
        pos.xy += normalize(toMouse + vec2(0.0001)) * force;

        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mv;
        // Perspective-correct point size (calibrated so dots read at ~3–12px)
        gl_PointSize = aRandom.z * uPixelRatio * (240.0 / -mv.z);
        // Fade distant particles for a sense of depth
        vFade = clamp(1.0 - (-mv.z - 40.0) / 90.0, 0.15, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying vec3  vColor;
      varying float vFade;
      void main() {
        // Soft circular sprite
        vec2 uv = gl_PointCoord - 0.5;
        float dist = length(uv);
        if (dist > 0.5) discard;
        float alpha = smoothstep(0.5, 0.12, dist) * 0.55 * vFade * uOpacity;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  // ---- 3. Sizing ----------------------------------------------------------
  function resize() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();

  // ---- 4. Pointer tracking (world-space, smoothed) ------------------------
  const targetMouse = new THREE.Vector2(9999, 9999);
  function onPointerMove(e) {
    const r = host.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right ||
        e.clientY < r.top  || e.clientY > r.bottom) {
      targetMouse.set(9999, 9999); // outside hero — release the field
      return;
    }
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = -(((e.clientY - r.top) / r.height) * 2 - 1);
    const { halfW, halfH } = planeExtents();
    targetMouse.set(nx * halfW, ny * halfH);
  }
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerleave', () => targetMouse.set(9999, 9999), { passive: true });

  // ---- 5. Animation loop (paused when off-screen or tab hidden) -----------
  const clock = new THREE.Clock();
  let rafId = null;
  let visible = true;   // hero in viewport
  let active  = true;   // tab focused

  function render() {
    rafId = requestAnimationFrame(render);
    const t = clock.getElapsedTime();
    uniforms.uTime.value = t;
    // Ease the world-space mouse toward its target (fluid, not jumpy)
    uniforms.uMouse.value.lerp(targetMouse, 0.12);
    // Fade the whole field in on first paint
    if (uniforms.uOpacity.value < 1) {
      uniforms.uOpacity.value = Math.min(1, uniforms.uOpacity.value + 0.02);
    }
    // Whole-cloud drift for life even when the mouse is still
    points.rotation.y = Math.sin(t * 0.05) * 0.08;
    points.rotation.x = Math.cos(t * 0.04) * 0.05;
    renderer.render(scene, camera);
  }

  function start() { if (!rafId && visible && active) { clock.start(); render(); } }
  function stop()  { if (rafId) { cancelAnimationFrame(rafId); rafId = null; clock.stop(); } }

  // Pause rendering when the hero scrolls out of view
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      visible ? start() : stop();
    }, { threshold: 0 }).observe(host);
  }
  // Pause when the tab is backgrounded
  document.addEventListener('visibilitychange', () => {
    active = !document.hidden;
    active ? start() : stop();
  });

  // Debounced resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  }, { passive: true });

  start();
})();
