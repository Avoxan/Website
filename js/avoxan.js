/* AVOXAN - shared site scripts */

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

// Reading progress bar
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

// Expandable process steps
(function () {
  document.querySelectorAll('.step.expandable').forEach((step) => {
    step.addEventListener('click', (e) => {
      if (e.target.closest('a, button')) return;
      const open = step.dataset.open === '1';
      step.dataset.open = open ? '0' : '1';
    });
  });
})();

// Contact-page booking widget tab toggle
(function () {
  const tabs = document.querySelectorAll('.booking-tab');
  if (!tabs.length) return;
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.panel;
      tabs.forEach((t) => {
        const active = t === tab;
        t.classList.toggle('active', active);
        t.setAttribute('aria-selected', active ? 'true' : 'false');
      });
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

// Site forms - Cloudflare Pages Function submitter
(function () {
  const forms = document.querySelectorAll('form[data-form][action="/api/contact"]');
  if (!forms.length) return;

  forms.forEach((form) => {
    const status = form.querySelector('[data-form-status]');
    const submitBtn = form.querySelector('button[type="submit"]');
    const submitLabel = form.querySelector('.form-submit-label');
    const originalSubmitText = submitLabel ? submitLabel.textContent : '';

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
      submitBtn.setAttribute('aria-busy', submitting ? 'true' : 'false');
      if (submitLabel) {
        submitLabel.textContent = submitting ? 'Sending...' : originalSubmitText;
      }
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;

      const fd = new FormData(form);

      if ((fd.get('bot-field') || '').toString().trim()) {
        showSuccessState(form, status);
        return;
      }

      setSubmitting(true);
      setStatus('Sending...', 'success');

      fetch(form.getAttribute('action') || '/api/contact', {
        method: 'POST',
        body: fd,
        headers: { Accept: 'application/json' },
      })
        .then(async (res) => {
          let data = null;
          try { data = await res.json(); } catch { /* non-JSON response */ }

          if (res.ok && data && data.ok) {
            showSuccessState(form, status);
            return;
          }

          const msg = (data && data.error)
            ? data.error
            : "Hmm, that didn't go through. Try once more, or email hello@avoxan.com directly.";
          setSubmitting(false);
          setStatus(msg, 'error');
        })
        .catch((err) => {
          console.error('Form submission failed:', err);
          setSubmitting(false);
          setStatus(
            'Network error - check your connection and try again, or email hello@avoxan.com directly.',
            'error'
          );
        });
    });

    function showSuccessState(formEl, statusEl) {
      setSubmitting(false);

      if (formEl.dataset.form === 'contact') {
        const successHtml = `
          <div class="form-success" role="status" aria-live="polite">
            <div class="form-success-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="11"></circle>
                <path d="M7 12.5l3.5 3.5L17 9"></path>
              </svg>
            </div>
            <h3>Got it - thanks for reaching out.</h3>
            <p>We'll reply within one business day, usually same-day if it's a weekday. Check your spam folder if you haven't heard from us in 48 hours.</p>
            <p class="form-success-foot">In the meantime, feel free to skim our <a href="work/index.html">case studies</a> or read the <a href="blog/index.html">field notes</a>.</p>
          </div>
        `;
        formEl.outerHTML = successHtml;
        return;
      }

      formEl.reset();
      if (statusEl) {
        setStatus("Got it - thanks. We'll follow up shortly.", 'success');
      }
    }
  });
})();

// Magnetic buttons + fluid hover micro-interactions
(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  if (reduceMotion || coarse) return;

  function makeMagnetic(el, strength) {
    el.classList.add('magnetic');

    function onMove(e) {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      el.style.transform =
        'translate(' + dx * strength + 'px,' + dy * strength + 'px)';
      el.style.setProperty('--mx-pct', ((e.clientX - r.left) / r.width) * 100 + '%');
      el.style.setProperty('--my-pct', ((e.clientY - r.top) / r.height) * 100 + '%');
    }

    function reset() {
      el.style.transform = '';
    }

    el.addEventListener('pointerenter', () => {
      el.addEventListener('pointermove', onMove);
    });
    el.addEventListener('pointerleave', () => {
      el.removeEventListener('pointermove', onMove);
      reset();
    });
    el.addEventListener('blur', reset);
  }

  document.querySelectorAll('.btn-primary, .btn-secondary').forEach((el) =>
    makeMagnetic(el, 0.28)
  );
  document.querySelectorAll('.nav-cta').forEach((el) => makeMagnetic(el, 0.2));
})();
