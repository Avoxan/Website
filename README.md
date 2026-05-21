# Avoxan — scroll-linked video hero (drop-in update)

## What changed

- **index.html** — hero section replaced with a sticky scroll-scrub stage. Adds 3 new `<link>`/`<script>` lines plus the new `<section class="hero-scroll">` block. Everything below the hero (strip, problem, work, etc.) is untouched.
- **css/hero-scroll.css** — new file. Pure additive — no edits to `avoxan.css` or `avoxan-refresh.css`.
- **js/hero-scroll.js** — new file. Scrubs the video with `requestAnimationFrame`, cross-fades the three text panels at the 33% / 66% scroll marks, hides the scroll cue after first interaction.
- **assets/** — three new files: `hero.mp4` (~3.9 MB, desktop), `hero-mobile.mp4` (~1.7 MB, ≤719px), `hero-poster.jpg` (108 KB, shows before video loads).

## How to deploy

1. Drop these files into your repo at the same paths shown (overwriting only `index.html`; the rest are new).
2. Commit & push.
3. The first frame is preloaded, so the hero never flashes blank.

## How it works

The hero section is 280vh tall. Inside it, a `position: sticky` 100vh stage holds the video on the left and the text overlay on the right. As you scroll through the section:

- Video `currentTime` is mapped 1:1 to scroll progress (0% → 100% = 0s → ~5.8s).
- Three text panels cross-fade at the 0%, 33%, 66% marks.
- Three progress dots track the active panel.
- A "Scroll" cue with an animated line fades out after the user scrolls.

The video is re-encoded with every frame as a keyframe (`-g 1`), which is why scrubbing feels smooth — a normal MP4 would stutter on `currentTime` seeks.

## Fallbacks

- **prefers-reduced-motion**: scroll-scrub is disabled in JS; CSS collapses the 280vh to auto and shows only the first panel as a normal hero.
- **Video fails to load**: the `<video>` tag's `poster` keeps the first frame visible; text panels and dots still work.
- **Mobile (<720px)**: layout stacks (video top 48vh, text below); section grows to 320vh for comfortable reading time.

## Tuning

- Change scroll length: `.hero-scroll { height: 280vh; }` in `hero-scroll.css`.
- Change panel boundaries: search `< 0.34` and `< 0.67` in `hero-scroll.js`.
- Replace the video: swap `assets/hero.mp4`, `assets/hero-mobile.mp4`, `assets/hero-poster.jpg` — keep the names.

