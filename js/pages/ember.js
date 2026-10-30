/* ==================================================================
   Homepage hero: the liquid-metal film, with a liquid-glass surface.

   The film (a ribbon of copper and black chrome, flowing like silk) is the
   hero. On devices with a real GPU it is drawn through a WebGL shader
   that turns the pointer (or a finger) into ripples on a liquid
   surface: the image refracts outward from where you move, with a
   faint chromatic fringe where the ripple bends the light.

   Loading:
   - a poster image paints first (sized for phone or desktop)
   - the film starts only after the page has loaded, picks the phone
     or desktop cut, and plays only while the hero is on screen
   - reduced motion and Data Saver keep the poster; no GPU keeps the
     plain film without the ripples
   ================================================================== */
(function () {
  "use strict";
  var root = document.documentElement;
  var film = document.querySelector("[data-film]");
  if (!film) return;
  var video = film.querySelector("video");
  if (!video || !root.classList.contains("motion")) return;
  var conn = navigator.connection;
  if (conn && (conn.saveData || /2g/.test(conn.effectiveType || ""))) return;

  var mobileQ = window.matchMedia("(max-width: 860px)");

  function sources() {
    var m = mobileQ.matches, d = video.dataset;
    var list = [[m ? d.srcMWebm : d.srcWebm, "video/webm"], [m ? d.srcMMp4 : d.srcMp4, "video/mp4"]];
    video.innerHTML = "";
    list.forEach(function (s) {
      if (!s[0]) return;
      var el = document.createElement("source"); el.src = s[0]; el.type = s[1]; video.appendChild(el);
    });
    video.load();
  }

  // ---------- liquid glass (WebGL) ----------
  var FRAG = [
    "precision highp float;",
    "uniform sampler2D uVid; uniform vec2 uRes; uniform vec2 uVidRes; uniform float uPosX; uniform float uTime;",
    "uniform vec4 uPts[16];",
    "vec2 cover(vec2 uv){",
    // object-fit: cover, with a horizontal focus point (like object-position)
    " float ra=uRes.x/uRes.y, rv=uVidRes.x/uVidRes.y; vec2 s=vec2(1.);",
    " if(ra>rv) s.y=rv/ra; else s.x=ra/rv;",
    " vec2 o=vec2((1.-s.x)*uPosX,(1.-s.y)*.5);",
    " return o+uv*s;}",
    "void main(){",
    " vec2 uv=gl_FragCoord.xy/uRes; uv.y=1.-uv.y;",
    " float asp=uRes.x/uRes.y;",
    " vec2 disp=vec2(0.); float crest=0.;",
    " for(int i=0;i<16;i++){",
    "  vec4 p=uPts[i]; if(p.w<=0.) continue;",
    "  vec2 d=uv-p.xy; d.x*=asp; float r=length(d);",
    "  float age=p.z;",
    // a ring that travels outward and fades, like a touch on liquid metal
    "  float front=age*.32;",
    "  float ring=exp(-pow((r-front)*14.,2.));",
    "  float fade=exp(-age*1.15)*p.w;",
    "  float wave=sin((r-front)*58.)*ring*fade;",
    // plus a soft lens right under the pointer, while it is fresh
    "  float lens=exp(-r*r*55.)*exp(-age*4.)*p.w;",
    "  vec2 dir=r>1e-4?d/r:vec2(0.);",
    "  disp+=dir*(wave*.018-lens*.035);",
    "  crest+=max(wave,0.)*.6+lens*.25;",
    " }",
    " disp.x/=asp;",
    " vec2 base=cover(uv+disp);",
    // chromatic fringe only where the surface is disturbed
    " float ca=length(disp)*.35;",
    " vec2 dv=normalize(disp+1e-5)*ca;",
    " vec3 col;",
    " col.r=texture2D(uVid,cover(uv+disp+dv)).r;",
    " col.g=texture2D(uVid,base).g;",
    " col.b=texture2D(uVid,cover(uv+disp-dv)).b;",
    // a warm glint on the ripple crests
    " col+=vec3(1.,.72,.5)*crest*.10*(.4+.6*col.r);",
    " gl_FragColor=vec4(col,1.);",
    "}"
  ].join("\n");
  var VERT = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";

  function glass() {
    var canvas = document.createElement("canvas");
    var gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, premultipliedAlpha: false, powerPreference: "high-performance" });
    if (!gl) return false;
    var dbg = gl.getExtension("WEBGL_debug_renderer_info");
    var renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : "";
    if (/swiftshader|llvmpipe|software|basic render/i.test(renderer)) return false;

    function sh(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    }
    var vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return false;
    var prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    gl.useProgram(prog);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "a"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var U = {};
    ["uVid", "uRes", "uVidRes", "uPosX", "uTime", "uPts"].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(U.uVid, 0);

    canvas.className = "glass";
    canvas.setAttribute("aria-hidden", "true");
    film.appendChild(canvas);

    var W = 0, H = 0;
    function resize() {
      var r = film.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, mobileQ.matches ? 1.5 : 1.25);
      W = Math.max(2, Math.round(r.width * dpr)); H = Math.max(2, Math.round(r.height * dpr));
      canvas.width = W; canvas.height = H; gl.viewport(0, 0, W, H);
      gl.uniform2f(U.uRes, W, H);
      gl.uniform1f(U.uPosX, mobileQ.matches ? 0.5 : 0.68);
    }
    resize();
    window.addEventListener("resize", resize);

    // ripple sources: the last 16 points the pointer passed through
    var pts = [], lastX = -1, lastY = -1, t0 = performance.now();
    function add(e, strength) {
      var r = film.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      var dx = (x - lastX) * r.width, dy = (y - lastY) * r.height;
      if (strength < 1 && dx * dx + dy * dy < 22 * 22) return;
      lastX = x; lastY = y;
      pts.push({ x: x, y: y, t: (performance.now() - t0) / 1000, s: strength });
      if (pts.length > 16) pts.shift();
    }
    var hero = film.parentNode;
    hero.addEventListener("pointermove", function (e) { add(e, 0.55); }, { passive: true });
    hero.addEventListener("pointerdown", function (e) { if (!e.target.closest("a,button")) add(e, 1.0); }, { passive: true });

    var arr = new Float32Array(64), visible = true, running = false, ready = false;
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; kick(); }).observe(film);
    document.addEventListener("visibilitychange", kick);
    video.addEventListener("playing", function () { ready = true; kick(); });

    function frame(now) {
      if (!visible || document.hidden || !ready) { running = false; return; }
      if (video.readyState >= 2) {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video); } catch (x) { return fail(); }
        gl.uniform2f(U.uVidRes, video.videoWidth || 1920, video.videoHeight || 1080);
        var t = (now - t0) / 1000;
        for (var i = 0; i < 16; i++) {
          var p = pts[i], o = i * 4;
          if (p && t - p.t < 4) { arr[o] = p.x; arr[o + 1] = p.y; arr[o + 2] = t - p.t; arr[o + 3] = p.s; }
          else { arr[o + 3] = 0; }
        }
        gl.uniform4fv(U.uPts, arr);
        gl.uniform1f(U.uTime, t);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        if (!canvas.classList.contains("on")) { canvas.classList.add("on"); film.classList.add("is-glass"); }
      }
      requestAnimationFrame(frame);
    }
    function kick() {
      if (running || !visible || document.hidden || !ready) return;
      running = true; requestAnimationFrame(frame);
    }
    function fail() { canvas.remove(); film.classList.remove("is-glass"); running = false; }
    return true;
  }

  // ---------- start ----------
  function start() {
    sources();
    glass();
    video.addEventListener("playing", function () { film.classList.add("is-playing"); });
    var io = new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { var p = video.play(); if (p && p.catch) p.catch(function () {}); }
      else video.pause();
    }, { threshold: 0.05 });
    io.observe(video);
  }
  function later() {
    var go = function () { setTimeout(start, 300); };
    if ("requestIdleCallback" in window) requestIdleCallback(go, { timeout: 1200 }); else go();
  }
  if (document.readyState === "complete") later(); else window.addEventListener("load", later);
})();
