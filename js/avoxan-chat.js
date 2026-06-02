/* ============================================================================
   Ask Avoxan — chat widget
   Self-contained. Drop in once with:
     <script src="/avoxan-chat.js" defer></script>
   No deps. Inherits brand CSS variables from avoxan.css if present.
   ========================================================================= */
(function () {
  if (window.__avoxanChatLoaded) return;
  window.__avoxanChatLoaded = true;

  // ---------- Config ---------------------------------------------------------
  const API_PATH = '/api/chat';
  const STORAGE_KEY = 'avx_chat_v1';
  const MAX_HISTORY = 20;
  // AI receptionist pages (general + trade-specific) get receptionist-led prompts.
  const IS_RECEPTIONIST = /ai-receptionist/i.test(location.pathname);
  // Where the "Book a live demo" button points (the live-demo lead form).
  const DEMO_FORM_URL = '/ai-receptionist#book';
  const SUGGESTIONS = IS_RECEPTIONIST ? [
    'How does the AI receptionist handle a missed call?',
    'Do I need to change my phone number?',
    'How much does the AI receptionist cost?'
  ] : [
    'How does the Avoxan AI receptionist work?',
    "What's included in $1,500?",
    'Can it answer calls after hours?'
  ];

  // ---------- Styles ---------------------------------------------------------
  // All classes prefixed `avx-` so we don't collide with avoxan.css.
  // Falls back gracefully if brand CSS variables aren't defined yet.
  const CSS = `
  .avx-root {
    --avx-cream: var(--cream, #F2EBDC);
    --avx-cream-warm: var(--cream-warm, #ECE3CE);
    --avx-cream-accent: var(--accent-cream, #E8DFC9);
    --avx-ink: var(--ink, #1A1814);
    --avx-ink-soft: var(--ink-soft, #4A4540);
    --avx-muted: var(--muted, #8A8278);
    --avx-sienna: var(--sienna, #C04A1F);
    --avx-sienna-deep: #A8401B;
    --avx-line: var(--line, rgba(26, 24, 20, 0.08));
    --avx-line-strong: var(--line-strong, rgba(26, 24, 20, 0.15));
    --avx-shadow: 0 12px 40px -8px rgba(26, 24, 20, 0.25), 0 4px 12px -4px rgba(26, 24, 20, 0.1);
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    z-index: 9999;
    font-family: 'Geist', ui-sans-serif, system-ui, sans-serif;
    color: var(--avx-ink);
    -webkit-font-smoothing: antialiased;
  }
  .avx-root *, .avx-root *::before, .avx-root *::after { box-sizing: border-box; }

  /* ===== Launcher pill (closed state) ===== */
  .avx-launcher {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.6rem 1.05rem 0.6rem 0.6rem;
    background: var(--avx-cream);
    border: 2px solid var(--avx-sienna);
    border-radius: 100px;
    cursor: pointer;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 0.74rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--avx-ink);
    box-shadow: 0 12px 40px -8px rgba(192, 74, 31, 0.35), 0 4px 12px -4px rgba(192, 74, 31, 0.18);
    transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, border-color 0.2s ease;
    -webkit-tap-highlight-color: transparent;
  }
  .avx-launcher:hover {
    transform: translateY(-1px);
    background: #FBF6E9;
    border-color: var(--avx-sienna-deep);
  }
  .avx-launcher:active { transform: translateY(0); }
  .avx-launcher-mark {
    width: 26px; height: 35px;
    display: inline-flex; align-items: center; justify-content: center;
    background: transparent;
  }
  .avx-launcher-mark img,
  .avx-launcher-mark svg { width: 100%; height: 100%; display: block; }
  .avx-launcher-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--avx-sienna);
    margin-left: 0.15rem;
  }

  /* ===== Panel (open state) ===== */
  .avx-panel {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 384px;
    max-height: min(640px, calc(100dvh - 3rem));
    background: var(--avx-cream);
    border: 2px solid var(--avx-sienna);
    border-radius: 14px;
    box-shadow: 0 12px 40px -8px rgba(192, 74, 31, 0.35), 0 4px 12px -4px rgba(192, 74, 31, 0.18);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transform-origin: bottom right;
    /* Subtle paper grain to match site */
    background-image:
      url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.07 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
    background-blend-mode: multiply;
  }

  /* Open/close animations */
  .avx-root[data-state="closed"] .avx-panel { display: none; }
  .avx-root[data-state="opening"] .avx-launcher,
  .avx-root[data-state="open"] .avx-launcher {
    opacity: 0; pointer-events: none; transform: scale(0.9);
    transition: opacity 0.15s ease, transform 0.15s ease;
  }
  .avx-root[data-state="opening"] .avx-panel,
  .avx-root[data-state="open"] .avx-panel {
    animation: avxOpen 0.28s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  @keyframes avxOpen {
    from { opacity: 0; transform: translateY(12px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  /* ===== Header ===== */
  .avx-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.1rem;
    background: var(--avx-cream-warm);
    border-bottom: 1px solid var(--avx-line);
    flex-shrink: 0;
  }
  .avx-header-mark {
    width: 30px; height: 40px;
    display: inline-flex; align-items: center; justify-content: center;
    background: transparent;
    flex-shrink: 0;
  }
  .avx-header-mark img,
  .avx-header-mark svg { width: 100%; height: 100%; display: block; }
  .avx-header-text { flex: 1; min-width: 0; }
  .avx-header-title {
    font-family: 'Fraunces', Georgia, serif;
    font-variation-settings: "opsz" 144, "SOFT" 50, "wght" 500;
    font-size: 1.1rem;
    line-height: 1.15;
    color: var(--avx-ink);
    letter-spacing: -0.01em;
  }
  .avx-header-sub {
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 0.62rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--avx-ink-soft);
    margin-top: 0.2rem;
  }
  .avx-close {
    width: 28px; height: 28px;
    border: none;
    background: transparent;
    color: var(--avx-ink-soft);
    cursor: pointer;
    border-radius: 6px;
    font-size: 1.4rem;
    line-height: 1;
    transition: background 0.15s, color 0.15s;
    display: inline-flex; align-items: center; justify-content: center;
  }
  .avx-close:hover { background: var(--avx-line); color: var(--avx-ink); }

  /* ===== Thread ===== */
  .avx-thread {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem 1.1rem 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
    scrollbar-width: thin;
    scrollbar-color: var(--avx-line-strong) transparent;
  }
  .avx-thread::-webkit-scrollbar { width: 6px; }
  .avx-thread::-webkit-scrollbar-thumb { background: var(--avx-line-strong); border-radius: 3px; }

  /* Intro state */
  .avx-intro-line {
    font-family: 'Fraunces', Georgia, serif;
    font-variation-settings: "opsz" 144, "SOFT" 70, "wght" 400;
    font-style: italic;
    font-size: 1rem;
    line-height: 1.5;
    color: var(--avx-ink);
    margin: 0 0 1rem;
  }
  .avx-intro-line a {
    color: var(--avx-sienna);
    text-decoration: underline;
    text-decoration-color: rgba(192, 74, 31, 0.35);
    text-underline-offset: 2px;
  }
  .avx-suggestions {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .avx-suggestion {
    text-align: left;
    background: transparent;
    border: 1px solid var(--avx-line-strong);
    border-radius: 6px;
    padding: 0.55rem 0.75rem;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 0.7rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--avx-ink-soft);
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }
  .avx-suggestion:hover {
    background: var(--avx-cream-accent);
    border-color: var(--avx-ink-soft);
    color: var(--avx-ink);
  }

  /* Messages */
  .avx-msg { display: flex; flex-direction: column; max-width: 100%; }
  .avx-msg-user {
    align-self: flex-end;
    background: var(--avx-cream-warm);
    border: 1px solid var(--avx-line);
    border-radius: 14px 14px 4px 14px;
    padding: 0.65rem 0.9rem;
    font-size: 0.94rem;
    line-height: 1.45;
    color: var(--avx-ink);
    max-width: 85%;
  }
  .avx-msg-bot {
    align-self: stretch;
    font-size: 0.96rem;
    line-height: 1.6;
    color: var(--avx-ink);
  }
  .avx-msg-bot p { margin: 0 0 0.7rem; }
  .avx-msg-bot p:last-child { margin-bottom: 0; }
  .avx-msg-bot strong { font-weight: 600; color: var(--avx-ink); }
  .avx-msg-bot em {
    font-family: 'Fraunces', Georgia, serif;
    font-variation-settings: "opsz" 144, "SOFT" 60, "wght" 400;
    font-style: italic;
  }
  .avx-msg-bot a {
    color: var(--avx-sienna);
    text-decoration: underline;
    text-decoration-color: rgba(192, 74, 31, 0.35);
    text-underline-offset: 2px;
    transition: text-decoration-color 0.15s;
  }
  .avx-msg-bot a:hover { text-decoration-color: var(--avx-sienna); }
  .avx-msg-bot ul, .avx-msg-bot ol { margin: 0.3rem 0 0.7rem 1.2rem; padding: 0; }
  .avx-msg-bot li { margin-bottom: 0.25rem; }

  /* "Book a live demo" CTA button (shown when the AI nudges a demo) */
  .avx-demo-btn {
    display: inline-flex; align-items: center; gap: 0.45rem;
    margin-top: 0.6rem;
    padding: 0.6rem 1.05rem;
    background: var(--avx-sienna); color: #fff;
    border-radius: 100px;
    font-family: 'Geist', ui-sans-serif, system-ui, sans-serif;
    font-size: 0.85rem; font-weight: 600; text-decoration: none;
    transition: background 0.2s ease, transform 0.2s ease;
  }
  .avx-demo-btn:hover { background: var(--avx-sienna-deep); transform: translateY(-1px); }
  .avx-demo-btn svg { width: 14px; height: 14px; }

  /* Typing indicator */
  .avx-typing { display: inline-flex; gap: 4px; padding: 0.25rem 0; }
  .avx-typing span {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--avx-muted);
    animation: avxDot 1.2s infinite ease-in-out both;
  }
  .avx-typing span:nth-child(2) { animation-delay: 0.15s; }
  .avx-typing span:nth-child(3) { animation-delay: 0.3s; }
  @keyframes avxDot {
    0%, 80%, 100% { opacity: 0.3; transform: translateY(0); }
    40% { opacity: 1; transform: translateY(-3px); }
  }

  .avx-error {
    font-size: 0.85rem;
    color: var(--avx-sienna-deep);
    background: rgba(192, 74, 31, 0.06);
    border: 1px solid rgba(192, 74, 31, 0.2);
    border-radius: 6px;
    padding: 0.55rem 0.75rem;
    line-height: 1.4;
  }
  .avx-error a { color: var(--avx-sienna-deep); text-decoration: underline; }

  /* ===== Footer ===== */
  .avx-footer {
    border-top: 1px solid var(--avx-line);
    background: var(--avx-cream-warm);
    padding: 0.75rem 1.1rem 0.85rem;
    flex-shrink: 0;
  }
  .avx-form {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border-bottom: 1px solid var(--avx-line-strong);
    transition: border-color 0.15s;
  }
  .avx-form:focus-within { border-bottom-color: var(--avx-ink); }
  .avx-input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    padding: 0.55rem 0;
    font-family: 'Geist', ui-sans-serif, system-ui, sans-serif;
    font-size: 0.95rem;
    color: var(--avx-ink);
  }
  .avx-input::placeholder {
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 0.78rem;
    letter-spacing: 0.04em;
    color: var(--avx-muted);
  }
  .avx-send {
    border: none;
    background: transparent;
    color: var(--avx-ink-soft);
    cursor: pointer;
    width: 28px; height: 28px;
    border-radius: 50%;
    display: inline-flex; align-items: center; justify-content: center;
    transition: color 0.15s, background 0.15s, transform 0.15s;
  }
  .avx-send:hover:not(:disabled) { color: var(--avx-sienna); transform: translateX(2px); }
  .avx-send:disabled { opacity: 0.35; cursor: not-allowed; }
  .avx-send svg { width: 18px; height: 18px; }
  .avx-disclosure {
    margin-top: 0.55rem;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 0.62rem;
    letter-spacing: 0.06em;
    color: var(--avx-muted);
    line-height: 1.5;
  }
  .avx-disclosure a {
    color: var(--avx-ink-soft);
    text-decoration: underline;
    text-decoration-color: var(--avx-line-strong);
  }
  .avx-disclosure a:hover { color: var(--avx-sienna); }

  /* ===== Mobile ===== */
  @media (max-width: 540px) {
    .avx-root { bottom: 1rem; right: 1rem; left: 1rem; }
    .avx-launcher { float: right; }
    .avx-panel {
      width: 100%;
      max-height: calc(100dvh - 2rem);
      height: calc(100dvh - 2rem);
      border-radius: 12px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .avx-root *, .avx-root *::before, .avx-root *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
  `;

  // ---------- Logo mark ------------------------------------------------------
  // Uses the new Avoxan oval mark from /avoxan-logo.svg. Kept as an <img> so the
  // brand asset stays the single source of truth — update the SVG once, every
  // surface (nav, footer, favicon, chatbot) follows.
  const LOGO_SVG = `<img src="/avoxan-logo.svg" alt="Avoxan" aria-hidden="true">`;

  const ARROW_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;

  // ---------- State ----------------------------------------------------------
  let history = loadHistory();
  let isStreaming = false;
  let root, panel, thread, input, sendBtn, introEl;

  // Touch device detection — used to suppress auto-focus that pops the keyboard
  function isTouchDevice() {
    return matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  }

  // ---------- Helpers --------------------------------------------------------
  function loadHistory() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.slice(-MAX_HISTORY) : [];
    } catch { return []; }
  }
  function saveHistory() {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-MAX_HISTORY))); } catch {}
  }
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  // Minimal, safe markdown: links, bold, italic, line breaks, simple lists.
  function renderMarkdown(text) {
    const escaped = escapeHtml(text);
    const lines = escaped.split('\n');
    let html = '';
    let inList = false;
    for (let raw of lines) {
      const line = raw.trimEnd();
      const liMatch = line.match(/^(\s*)[-*]\s+(.+)$/);
      if (liMatch) {
        if (!inList) { html += '<ul>'; inList = true; }
        html += '<li>' + inlineFormat(liMatch[2]) + '</li>';
      } else {
        if (inList) { html += '</ul>'; inList = false; }
        if (line === '') html += ''; // paragraph break handled by splitting later
        else html += '<p>' + inlineFormat(line) + '</p>';
      }
    }
    if (inList) html += '</ul>';
    return html || '<p></p>';
  }
  // Renders a bot message and turns the [[BOOK_DEMO]] token into a CTA button.
  function renderBot(text) {
    const hasDemo = text.indexOf('[[BOOK_DEMO]]') !== -1;
    let clean = text.replace(/\[\[BOOK_DEMO\]\]/g, '');
    clean = clean.replace(/\[\[[A-Z_]*$/, ''); // hide a partial token still streaming in
    let html = renderMarkdown(clean.trim());
    if (hasDemo) {
      html += '<a class="avx-demo-btn" href="' + DEMO_FORM_URL + '">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>' +
        'Book a live demo</a>';
    }
    return html;
  }
  function inlineFormat(s) {
    return s
      // [text](url) — restrict to safe protocols / relative paths
      .replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:|\/|#)[^)\s]+)\)/g,
        (_, t, u) => `<a href="${u}" target="${u.startsWith('http') ? '_blank' : '_self'}" rel="noopener">${t}</a>`)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
  }
  function scrollToBottom() {
    requestAnimationFrame(() => { thread.scrollTop = thread.scrollHeight; });
  }

  // ---------- DOM ------------------------------------------------------------
  function injectStyles() {
    const style = document.createElement('style');
    style.setAttribute('data-avx', 'styles');
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function buildDOM() {
    root = document.createElement('div');
    root.className = 'avx-root';
    root.setAttribute('data-state', 'closed');

    root.innerHTML = `
      <button class="avx-launcher" aria-label="Open Ask Avoxan chat" data-action="open">
        <span class="avx-launcher-mark">${LOGO_SVG}</span>
        <span>Ask Avoxan</span>
        <span class="avx-launcher-dot" aria-hidden="true"></span>
      </button>

      <div class="avx-panel" role="dialog" aria-modal="false" aria-label="Ask Avoxan">
        <header class="avx-header">
          <span class="avx-header-mark">${LOGO_SVG}</span>
          <div class="avx-header-text">
            <div class="avx-header-title">Ask Avoxan</div>
            <div class="avx-header-sub">AI assistant · Trained on our writing</div>
          </div>
          <button class="avx-close" aria-label="Close chat" data-action="close">&times;</button>
        </header>

        <div class="avx-thread" role="log" aria-live="polite" aria-atomic="false"></div>

        <footer class="avx-footer">
          <form class="avx-form" data-action="send">
            <input
              class="avx-input"
              type="text"
              autocomplete="off"
              placeholder="Ask a question…"
              aria-label="Your message"
              maxlength="1000"
            />
            <button class="avx-send" type="submit" aria-label="Send message" disabled>
              ${ARROW_SVG}
            </button>
          </form>
          <div class="avx-disclosure">
            AI — can be wrong. For binding answers, <a href="/contact">book a 20-min call →</a>
          </div>
        </footer>
      </div>
    `;
    document.body.appendChild(root);

    panel = root.querySelector('.avx-panel');
    thread = root.querySelector('.avx-thread');
    input = root.querySelector('.avx-input');
    sendBtn = root.querySelector('.avx-send');
  }

  function renderIntro() {
    introEl = document.createElement('div');
    introEl.className = 'avx-intro';
    introEl.innerHTML = `
      <p class="avx-intro-line">Ask anything about pricing, process, or whether we're a fit. For real conversations, <a href="/contact">book a call</a>.</p>
      <div class="avx-suggestions"></div>
    `;
    const sugBox = introEl.querySelector('.avx-suggestions');
    SUGGESTIONS.forEach(q => {
      const b = document.createElement('button');
      b.className = 'avx-suggestion';
      b.type = 'button';
      b.textContent = q;
      b.addEventListener('click', () => sendMessage(q));
      sugBox.appendChild(b);
    });
    thread.appendChild(introEl);
  }

  function clearIntro() {
    if (introEl && introEl.parentNode) {
      introEl.parentNode.removeChild(introEl);
      introEl = null;
    }
  }

  function rehydrateHistory() {
    if (history.length === 0) {
      renderIntro();
      return;
    }
    history.forEach(m => appendMessage(m.role, m.content, /*animate*/ false));
    scrollToBottom();
  }

  function appendMessage(role, content, animate = true) {
    const el = document.createElement('div');
    el.className = 'avx-msg ' + (role === 'user' ? 'avx-msg-user' : 'avx-msg-bot');
    if (role === 'user') {
      el.textContent = content;
    } else {
      el.innerHTML = renderBot(content);
    }
    if (animate) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(4px)';
      el.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
      thread.appendChild(el);
      requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; });
    } else {
      thread.appendChild(el);
    }
    scrollToBottom();
    return el;
  }

  function appendTyping() {
    const el = document.createElement('div');
    el.className = 'avx-msg avx-msg-bot avx-msg-typing';
    el.innerHTML = `<span class="avx-typing"><span></span><span></span><span></span></span>`;
    thread.appendChild(el);
    scrollToBottom();
    return el;
  }

  function appendError(msg) {
    const el = document.createElement('div');
    el.className = 'avx-error';
    el.innerHTML = msg;
    thread.appendChild(el);
    scrollToBottom();
  }

  // ---------- Open / close ---------------------------------------------------
  function openPanel() {
    if (root.getAttribute('data-state') !== 'closed') return;
    root.setAttribute('data-state', 'opening');
    requestAnimationFrame(() => root.setAttribute('data-state', 'open'));
    setTimeout(() => {
      if (input && !isTouchDevice()) input.focus();
    }, 280);
  }
  function closePanel() {
    root.setAttribute('data-state', 'closed');
  }

  // ---------- Send + stream --------------------------------------------------
  async function sendMessage(text) {
    text = text.trim();
    if (!text || isStreaming) return;

    clearIntro();
    appendMessage('user', text);
    history.push({ role: 'user', content: text });
    saveHistory();

    input.value = '';
    sendBtn.disabled = true;
    isStreaming = true;

    const typingEl = appendTyping();
    let botEl = null;
    let assistantText = '';

    try {
      const res = await fetch(API_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.slice(-MAX_HISTORY), context: 'site' })
      });

      if (!res.ok || !res.body) {
        throw new Error('Request failed: ' + res.status);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Parse Anthropic SSE stream
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE events are separated by blank lines
        let idx;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const rawEvent = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);

          // Each event has lines like "event: foo" and "data: {...}"
          let dataLine = '';
          for (const line of rawEvent.split('\n')) {
            if (line.startsWith('data:')) dataLine = line.slice(5).trim();
          }
          if (!dataLine || dataLine === '[DONE]') continue;

          try {
            const evt = JSON.parse(dataLine);
            // Groq (OpenAI-compatible) emits: { choices: [{ delta: { content: "..." } }] }
            const chunk = evt.choices?.[0]?.delta?.content || '';
            if (chunk) {
              if (!botEl) {
                typingEl.remove();
                botEl = document.createElement('div');
                botEl.className = 'avx-msg avx-msg-bot';
                thread.appendChild(botEl);
              }
              assistantText += chunk;
              botEl.innerHTML = renderBot(assistantText);
              scrollToBottom();
            }
            // finish_reason on the last frame signals end; no special action needed
          } catch (e) {
            // Ignore parse errors on partial frames; rethrow real errors
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }

      if (assistantText) {
        history.push({ role: 'assistant', content: assistantText });
        saveHistory();
      } else {
        typingEl.remove();
        appendError('No response received. Try again, or email <a href="mailto:hello@avoxan.com">hello@avoxan.com</a>.');
      }
    } catch (err) {
      console.error('[Ask Avoxan]', err);
      if (typingEl && typingEl.parentNode) typingEl.remove();
      if (botEl && !assistantText && botEl.parentNode) botEl.remove();
      appendError('Connection hiccup. Try again, or email <a href="mailto:hello@avoxan.com">hello@avoxan.com</a>.');
    } finally {
      isStreaming = false;
      sendBtn.disabled = !input.value.trim();
      if (!isTouchDevice()) input.focus();
    }
  }

  // ---------- Wire up --------------------------------------------------------
  function bindEvents() {
    root.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'open') openPanel();
      if (action === 'close') closePanel();
    });

    root.querySelector('form.avx-form').addEventListener('submit', (e) => {
      e.preventDefault();
      sendMessage(input.value);
    });

    input.addEventListener('input', () => {
      sendBtn.disabled = !input.value.trim() || isStreaming;
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && root.getAttribute('data-state') === 'open') closePanel();
    });
  }

  // ---------- Init -----------------------------------------------------------
  function init() {
    injectStyles();
    buildDOM();
    rehydrateHistory();
    bindEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
