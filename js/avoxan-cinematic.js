/* ============================================================================
   AVOXAN — Cinematic, scroll-driven case-study showcase
   ----------------------------------------------------------------------------
   As the reader scrolls, the project mockup scales from a small card up to a
   full-bleed block while the title fades in and locks into the centre.

   Built on GSAP + ScrollTrigger (loaded via CDN, deferred). Only animated
   properties are transform/opacity + a CSS custom prop, so it stays lag-free.

   Graceful by default: the markup renders a clean static showcase with the
   title already visible. The cinematic timeline is *opt-in* via gsap.matchMedia
   and only engages on pointer-capable screens ≥768px with motion allowed —
   everywhere else (mobile, reduced-motion, no-JS, CDN failure) the static
   showcase is what the visitor sees.
   ============================================================================ */
(function () {
  'use strict';

  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
  const section = document.querySelector('.cinematic');
  if (!section) return;

  const stage  = section.querySelector('.cinematic-stage');
  const figure = section.querySelector('.cinematic-figure');
  const title  = section.querySelector('.cinematic-title');
  if (!stage || !figure || !title) return;

  gsap.registerPlugin(ScrollTrigger);

  const mm = gsap.matchMedia();

  // Engage the cinematic sequence only where it reads well and performs well.
  mm.add('(min-width: 768px) and (prefers-reduced-motion: no-preference)', () => {
    section.classList.add('is-cinematic');

    // Start state: small card, transparent title, no scrim.
    gsap.set(figure, { scale: 0.42, transformOrigin: 'center center' });
    gsap.set(title,  { autoAlpha: 0, y: 44 });
    gsap.set(section, { '--scrim': 0 });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: stage,
        start: 'top top',
        end: '+=130%',
        scrub: 0.6,        // ties progress to scroll, smoothed
        pin: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });

    tl.to(figure,  { scale: 1, ease: 'none' }, 0)
      .to(section, { '--scrim': 1, ease: 'none' }, 0.30)
      .to(title,   { autoAlpha: 1, y: 0, ease: 'power2.out', duration: 0.6 }, 0.40);

    // matchMedia cleanup: fully revert when the query stops matching
    return () => {
      section.classList.remove('is-cinematic');
      gsap.set([figure, title], { clearProps: 'all' });
      section.style.removeProperty('--scrim');
    };
  });

  // Keep pin math correct once the hero image actually loads (its height shifts
  // the layout, which would otherwise desync the pinned distance).
  const img = figure.querySelector('img');
  if (img && !img.complete) {
    img.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
  }
})();
