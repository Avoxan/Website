/* ==================================================================
   Homepage hero: molten ember marble, rendered by the GPU.

   One fragment shader draws slow, domain-warped marble in the studio's
   ember palette. The pointer (or a finger) parts the flow around it.
   It fades in over the silk film, which stays as the poster and as the
   fallback.

   Manners:
   - decides at parse time whether to run; if it will, the film is told
     not to start playing, so nothing downloads twice
   - starts after the page has loaded, so it never delays the first paint
   - renders at reduced resolution (the marble is soft) and lowers it if
     frames run slow; pauses off screen and in background tabs
   - skipped under reduced motion, Data Saver, without WebGL, or on a
     software renderer (no GPU), leaving the film
   ================================================================== */
(function () {
  "use strict";
  var root = document.documentElement;
  var film = document.querySelector("[data-ember]");
  if (!film || !root.classList.contains("motion")) return;
  var conn = navigator.connection;
  if (conn && (conn.saveData || /2g/.test(conn.effectiveType || ""))) return;

  // Probe once: real GPU or not?
  var probe = document.createElement("canvas");
  var gl = probe.getContext("webgl", { alpha: false, antialias: false, depth: false, powerPreference: "high-performance" });
  if (!gl) return;
  var dbg = gl.getExtension("WEBGL_debug_renderer_info");
  var renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : "";
  if (/swiftshader|llvmpipe|software|basic render/i.test(renderer)) return;

  // We will run: keep the film as a still poster instead of a playing video.
  var video = film.querySelector("video");
  if (video) video.removeAttribute("data-autoplay");

  var FRAG = [
    "precision highp float;",
    "uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse; uniform float uHover; uniform float uIntro; uniform vec2 uShift; uniform float uMobile;",
    "float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}",
    "float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);",
    " return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}",
    "float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<5;i++){v+=a*noise(p);p=m*p;a*=.5;}return v;}",
    // ink -> deep ember -> ember -> warm cream; never grey, never pure white
    "vec3 ramp(float x){",
    " vec3 c0=vec3(.051,.043,.035),c1=vec3(.22,.06,.02),c2=vec3(.62,.21,.07),c3=vec3(.89,.44,.22),c4=vec3(.99,.80,.62);",
    " x=clamp(x,0.,1.);",
    " if(x<.3)return mix(c0,c1,smoothstep(0.,.3,x));",
    " if(x<.6)return mix(c1,c2,smoothstep(.3,.6,x));",
    " if(x<.84)return mix(c2,c3,smoothstep(.6,.84,x));",
    " return mix(c3,c4,smoothstep(.84,1.,x));}",
    "void main(){",
    " vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y-uShift;",
    " float t=uTime*.55;",
    // the pointer parts the marble
    " vec2 dm=uv-uMouse; float md=dot(dm,dm);",
    " vec2 p=uv*1.25; p+=.32*uHover*dm*exp(-md*4.);",
    // a broad diagonal sash, so the marble lives on the right (or the top on phones)
    " float s=uv.y-mix(.42,.28,uMobile)*uv.x+.06-.12*sin(t*.23+uv.x*1.6);",
    " float band=exp(-s*s*mix(2.1,3.4,uMobile));",
    // domain-warped marble
    " vec2 q=vec2(fbm(p+vec2(0.,t*.05)),fbm(p+vec2(5.2,1.3)-t*.04));",
    " vec2 r=vec2(fbm(p+3.4*q+vec2(1.7,9.2)+t*.07),fbm(p+3.4*q+vec2(8.3,2.8)-t*.06));",
    " float f=fbm(p+3.4*r);",
    " float veins=pow(1.-abs(sin(f*9.+r.x*4.+t*.18)),6.);",
    " float sheen=pow(1.-abs(sin(f*4.+q.y*3.-t*.15)),3.);",
    " float v=band*(.26+.68*f)+band*(.46*veins+.2*sheen);",
    " v=min(v,.97);",
    " v+=uHover*.06*exp(-md*6.)*band;",
    // ignition: the marble spreads out from the right on arrival
    " float spread=uIntro*2.8-length(uv-vec2(.55,.12));",
    " v*=smoothstep(0.,.9,spread);",
    " vec3 col=ramp(v);",
    // a whisper of depth: darker toward the edges
    " col*=1.-.32*dot(uv*.6,uv*.6);",
    " gl_FragColor=vec4(col,1.);",
    "}"
  ].join("\n");
  var VERT = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";

  function start() {
    function sh(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    }
    var vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    var prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "a"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var U = {};
    ["uRes", "uTime", "uMouse", "uHover", "uIntro", "uShift", "uMobile"].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

    var canvas = probe;
    canvas.className = "marble";
    canvas.setAttribute("aria-hidden", "true");
    film.appendChild(canvas);

    var mobile = false, scale = 0.5, sx = 0, sy = 0, W = 0, H = 0;
    function resize() {
      var r = film.getBoundingClientRect();
      mobile = r.width < 860;
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = Math.max(2, Math.round(r.width * scale * (mobile ? dpr : 1)));
      H = Math.max(2, Math.round(r.height * scale * (mobile ? dpr : 1)));
      canvas.width = W; canvas.height = H;
      gl.viewport(0, 0, W, H);
      gl.uniform2f(U.uRes, W, H);
      // desktop: the marble sits right of the headline; phones: across the top
      sx = mobile ? 0.0 : Math.min(0.34, (r.width / r.height - 1) * 0.28);
      sy = mobile ? 0.24 : 0.02;
      gl.uniform2f(U.uShift, sx, sy);
      gl.uniform1f(U.uMobile, mobile ? 1 : 0);
    }
    resize();
    window.addEventListener("resize", resize);

    // pointer / finger, eased; when nobody steers, a slow invisible current moves through it
    var mx = 0.3, my = 0.05, tx = mx, ty = my, hover = 0, hoverT = 0, lastMove = -1e9;
    var hero = film.parentNode;
    function track(e) {
      var r = film.getBoundingClientRect();
      tx = (e.clientX - r.left - r.width / 2) / r.height - sx;
      ty = -(e.clientY - r.top - r.height / 2) / r.height - sy;
      hoverT = 1; lastMove = performance.now();
    }
    hero.addEventListener("pointermove", track, { passive: true });
    hero.addEventListener("pointerdown", track, { passive: true });
    hero.addEventListener("pointerleave", function () { hoverT = 0; });

    var visible = true, running = false, t0 = performance.now(), last = t0, slow = 0;
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; kick(); }).observe(film);
    document.addEventListener("visibilitychange", kick);

    function frame(now) {
      if (!visible || document.hidden) { running = false; return; }
      var dt = now - last; last = now;
      // adaptive quality: if frames keep running slow, render fewer pixels
      if (dt > 30) { if (++slow > 45 && scale > 0.28) { scale *= 0.82; slow = 0; resize(); } } else if (slow > 0) slow--;
      var t = (now - t0) / 1000;
      if (now - lastMove > 3500) {
        tx = 0.25 + 0.25 * Math.sin(t * 0.19); ty = 0.05 + 0.15 * Math.sin(t * 0.15 + 1.3);
        hoverT = 0.45;
      }
      mx += (tx - mx) * 0.05; my += (ty - my) * 0.05; hover += (hoverT - hover) * 0.04;
      var intro = Math.min(1, t / 3); intro = 0.4 + 0.6 * (1 - Math.pow(1 - intro, 3));
      gl.uniform1f(U.uTime, t + 7.0);
      gl.uniform2f(U.uMouse, mx, my);
      gl.uniform1f(U.uHover, hover);
      gl.uniform1f(U.uIntro, intro);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!canvas.classList.contains("on")) canvas.classList.add("on");
      requestAnimationFrame(frame);
    }
    function kick() {
      if (running || !visible || document.hidden) return;
      running = true; last = performance.now(); requestAnimationFrame(frame);
    }
    kick();
  }

  function later() {
    var go = function () { setTimeout(start, 600); };
    if ("requestIdleCallback" in window) requestIdleCallback(go, { timeout: 1000 }); else go();
  }
  if (document.readyState === "complete") later(); else window.addEventListener("load", later);
})();
