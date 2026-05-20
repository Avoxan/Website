/* AVOXAN — shared site scripts */

// Mobile menu toggle
(function () {
  const btn = document.querySelector('.mobile-menu-btn');
  const links = document.getElementById('navLinks');
  if (btn && links) {
    btn.addEventListener('click', () => links.classList.toggle('show'));
    links.querySelectorAll('a').forEach((a) =>
      a.addEventListener('click', () => links.classList.remove('show'))
    );
  }
})();

// Reveal animations on scroll
(function () {
  if (!('IntersectionObserver' in window)) return;
  const selectors = '.offer-item, .why-card, .step, .blog-card, .work-card, .related-card, .gpoint-num';
  const els = document.querySelectorAll(selectors);
  if (!els.length) return;

  els.forEach((el) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
  });

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  els.forEach((el) => io.observe(el));
})();

// Reading progress bar (only if .reading-progress is on the page)
(function () {
  const bar = document.querySelector('.reading-progress');
  if (!bar) return;
  const onScroll = () => {
    const h = document.documentElement;
    const scrolled = h.scrollTop;
    const height = h.scrollHeight - h.clientHeight;
    const pct = height > 0 ? (scrolled / height) * 100 : 0;
    bar.style.width = pct + '%';
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

// Expandable process steps (process page)
// We just toggle the parent's `data-open` attribute — visibility of the
// .step-extra panel is then handled by CSS:
//   .step.expandable[data-open="1"] .step-extra { display: block; ... }
// This lets the CSS own the animation and avoids inline-style override.
(function () {
  document.querySelectorAll('.step.expandable').forEach((step) => {
    step.addEventListener('click', (e) => {
      // ignore clicks on links/buttons inside the step
      if (e.target.closest('a, button')) return;
      const open = step.dataset.open === '1';
      step.dataset.open = open ? '0' : '1';
    });
  });
})();

// Contact-page booking widget — tab toggle (Calendly ↔ form)
(function () {
  const tabs = document.querySelectorAll('.booking-tab');
  if (!tabs.length) return;
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.panel;
      // toggle tab buttons
      tabs.forEach((t) => {
        const active = t === tab;
        t.classList.toggle('active', active);
        t.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      // toggle panels
      document.querySelectorAll('.booking-panel').forEach((p) => {
        const active = p.id === targetId;
        p.classList.toggle('active', active);
        if (active) {
          p.removeAttribute('hidden');
        } else {
          p.setAttribute('hidden', '');
        }
      });
    });
  });
})();

// Contact-page reach-out form — Netlify Forms AJAX submitter
//
// Submits the form via fetch() so the user gets an in-page success state
// instead of being navigated to Netlify's default thank-you page.
//
// How this works with Netlify:
//   1. Netlify scans the deployed HTML at build time and finds the
//      <form data-netlify="true" name="contact"> tag in contact.html.
//   2. It registers a "contact" form in your Netlify dashboard.
//   3. We POST FormData to "/" with a `form-name` field — Netlify
//      intercepts that request and stores the submission.
//   4. Submissions appear under Site → Forms → contact in the dashboard.
//
// If JS is disabled or fetch fails, the form submits normally and the
// browser navigates to /?form-submitted=1 — Netlify still captures it.
(function () {
  const form = document.querySelector('form.contact-form[data-netlify="true"]');
  if (!form) return;

  const status = form.querySelector('[data-form-status]');
  const submitBtn = form.querySelector('.form-submit');
  const submitLabel = form.querySelector('.form-submit-label');

  function setStatus(msg, kind) {
    if (!status) return;
    status.textContent = msg;
    status.classList.remove('error', 'success');
    if (kind) status.classList.add(kind);
    status.hidden = false;
  }

  function setSubmitting(submitting) {
    if (!submitBtn) return;
    submitBtn.disabled = submitting;
    if (submitLabel) {
      submitLabel.textContent = submitting ? 'Sending…' : 'Send the note';
    }
  }

  // Encode FormData as application/x-www-form-urlencoded — the format
  // Netlify's form-handler expects for AJAX submissions.
  function encode(fd) {
    const params = new URLSearchParams();
    fd.forEach((value, key) => {
      params.append(key, typeof value === 'string' ? value : '');
    });
    return params.toString();
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;

    const fd = new FormData(form);
    // Honeypot — if filled, silently pretend success (don't tip off bots)
    if ((fd.get('bot-field') || '').toString().trim()) {
      showSuccessState();
      return;
    }

    setSubmitting(true);
    setStatus('Sending…', 'success');

    fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: encode(fd),
    })
      .then((res) => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        showSuccessState();
      })
      .catch((err) => {
        console.error('Form submission failed:', err);
        setSubmitting(false);
        setStatus(
          "Hmm, that didn't send. Try once more — or just email hello@avoxan.com directly and we'll pick it up there.",
          'error'
        );
      });
  });

  function showSuccessState() {
    // Replace the form body with a success card. Keep the surrounding
    // panel intact so the booking-card layout doesn't jump.
    const successHtml = `
      <div class="form-success" role="status" aria-live="polite">
        <div class="form-success-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="11"></circle>
            <path d="M7 12.5l3.5 3.5L17 9"></path>
          </svg>
        </div>
        <h3>Got it — thanks for reaching out.</h3>
        <p>We'll reply within one business day, usually same-day if it's a weekday. Check your spam folder if you haven't heard from us in 48 hours.</p>
        <p class="form-success-foot">In the meantime, feel free to skim our <a href="work/index.html">case studies</a> or read the <a href="blog/index.html">field notes</a>.</p>
      </div>
    `;
    form.outerHTML = successHtml;
  }
})();
