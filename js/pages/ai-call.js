/* The demo-call deck: waveform from precomputed peaks, play/pause/seek,
   a transcript that follows the audio, and a lead card that fills in as
   the AI collects each detail. Without JS the transcript and the full
   lead card are simply shown, which is also what search engines read. */
(function () {
  "use strict";
  var root = document.querySelector("[data-call]");
  if (!root) return;
  var audio = root.querySelector("[data-audio]");
  var btn = root.querySelector("[data-play]");
  var wave = root.querySelector("[data-wave]");
  var cur = root.querySelector("[data-cur]");
  var live = root.querySelector("[data-live]");
  var lines = Array.prototype.slice.call(root.querySelectorAll(".script li[data-t]"));
  var facts = Array.prototype.slice.call(root.querySelectorAll(".lead [data-at]"));
  var DUR = 78.8;

  var peaks = (wave.getAttribute("data-peaks") || "").split(",").map(Number);
  var frag = document.createDocumentFragment();
  peaks.forEach(function (p) {
    var i = document.createElement("i");
    i.style.height = Math.max(6, p) + "%";
    frag.appendChild(i);
  });
  wave.appendChild(frag);
  var bars = Array.prototype.slice.call(wave.children);

  function fmt(t) { t = Math.max(0, Math.floor(t)); return Math.floor(t / 60) + ":" + ("0" + (t % 60)).slice(-2); }

  var lastIdx = -2;
  function render(t) {
    var d = audio.duration && isFinite(audio.duration) ? audio.duration : DUR;
    var p = t / d;
    var on = Math.round(p * bars.length);
    for (var b = 0; b < bars.length; b++) bars[b].classList.toggle("on", b < on);
    cur.textContent = fmt(t);
    wave.setAttribute("aria-valuenow", Math.round(t));

    var idx = -1;
    for (var i = 0; i < lines.length; i++) if (t >= parseFloat(lines[i].dataset.t)) idx = i;
    if (idx !== lastIdx) {
      lines.forEach(function (l, j) {
        l.classList.toggle("now", j === idx);
        l.classList.toggle("past", j < idx);
      });
      lastIdx = idx;
    }
    facts.forEach(function (f) { f.classList.toggle("got", t >= parseFloat(f.dataset.at)); });
  }

  function start() {
    root.classList.add("started");
    audio.play().catch(function () {});
  }

  btn.addEventListener("click", function () {
    if (audio.paused) start(); else audio.pause();
  });
  audio.addEventListener("play", function () { root.classList.add("playing"); btn.setAttribute("aria-label", "Pause the sample call"); if (live) live.textContent = "Listening"; });
  audio.addEventListener("pause", function () { root.classList.remove("playing"); btn.setAttribute("aria-label", "Play the sample call"); });
  audio.addEventListener("ended", function () { root.classList.remove("playing"); if (live) live.textContent = "Sent"; render(audio.duration || DUR); });

  var raf;
  function loop() { render(audio.currentTime); if (!audio.paused) raf = requestAnimationFrame(loop); }
  audio.addEventListener("play", function () { cancelAnimationFrame(raf); loop(); });
  audio.addEventListener("seeked", function () { render(audio.currentTime); });

  function seekTo(frac) {
    frac = Math.min(1, Math.max(0, frac));
    root.classList.add("started");
    var go = function () { audio.currentTime = frac * (audio.duration || DUR); render(audio.currentTime); };
    if (audio.readyState >= 1) go(); else { audio.addEventListener("loadedmetadata", go, { once: true }); audio.load(); }
  }
  wave.addEventListener("click", function (e) {
    var r = wave.getBoundingClientRect();
    seekTo((e.clientX - r.left) / r.width);
    if (audio.paused) start();
  });
  wave.addEventListener("keydown", function (e) {
    var t = audio.currentTime || 0;
    if (e.key === "ArrowRight") { seekTo((t + 5) / (audio.duration || DUR)); e.preventDefault(); }
    else if (e.key === "ArrowLeft") { seekTo((t - 5) / (audio.duration || DUR)); e.preventDefault(); }
    else if (e.key === " " || e.key === "Enter") { btn.click(); e.preventDefault(); }
  });

  // Clicking a transcript line jumps the audio there.
  lines.forEach(function (l) {
    l.style.cursor = "pointer";
    l.addEventListener("click", function () {
      seekTo(parseFloat(l.dataset.t) / (audio.duration || DUR));
      if (audio.paused) start();
    });
  });
})();
