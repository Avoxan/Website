# Avoxan — scroll-linked hero (v3)

## Why v3

v1 broke on your live site because `css/hero-scroll.css` didn't load (giant unstyled `<h1>`, stacked panels, missing video). v3 fixes that with:

1. **Different class names** for the hero typography (`.hero-scroll-title`, `.hero-scroll-lede`) so they can't conflict with the giant global `.hero-title` rule even if the new CSS file fails to load.
2. **Fallback color values** baked into every CSS rule (e.g. `var(--cream, #F2EBDC)`) so the hero still looks like the brand even without your design tokens.
3. **Cache-busted URLs** (`?v=3`) so browsers can't serve a stale empty 404.
4. **Better architecture** — the video now fills the whole stage and the text floats over the cream negative space inside the video itself, which is what the image was generated for.

## What to deploy

```
index.html                  ← overwrite
css/hero-scroll.css         ← new
js/hero-scroll.js           ← new
assets/hero.mp4             ← new (3.9 MB)
assets/hero-mobile.mp4      ← new (1.7 MB)
assets/hero-poster.jpg      ← new (108 KB)
```

## Deploy checklist (don't skip — this is why v1 broke)

1. After committing, open `https://yoursite.com/css/hero-scroll.css` directly in the browser. You should see the CSS, **not** a 404. If 404 → the file didn't deploy. Common causes:
   - You committed `index.html` but forgot the new files.
   - Your build tool excluded files in `css/` it didn't already know about.
   - You're on a static host with a build step that didn't run.
2. Same check for `js/hero-scroll.js` and `assets/hero.mp4`.
3. Hard-refresh the homepage (Cmd+Shift+R / Ctrl+Shift+R) — the cache-bust query should handle this but doesn't hurt.

## Tuning

- Scroll length → `.hero-scroll { height: 280vh; }` in `hero-scroll.css`. Smaller = faster scrub.
- Panel boundaries → `< 0.34` and `< 0.67` in `hero-scroll.js`.
- Character framing → `.hero-video { object-position: 30% center; }`. Lower % pulls the character further left.

## How to debug if it still breaks

Open DevTools → Network tab → hard-refresh. Look for any 404s. If `hero-scroll.css` is 404, the file didn't reach your server. If it's 200 but the page still looks wrong, paste the URL and I'll dig in.
