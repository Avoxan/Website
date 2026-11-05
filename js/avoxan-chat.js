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
  const IS_PLUMBER = /ai-receptionist-plumbers/i.test(location.pathname);
  const IS_RECEPTIONIST = !IS_PLUMBER && /ai-receptionist/i.test(location.pathname);
  // Where the "Book a live demo" button points — the demo form on the page the visitor is already on.
  const DEMO_FORM_URL = IS_PLUMBER ? '/ai-receptionist-plumbers#demo' : '/ai-receptionist#demo';
  // Suggested questions, ordered so the most relevant for the current page sit on top.
  const SUGGESTIONS = IS_PLUMBER ? [
    // Plumber-specific first…
    'How does it handle an after-hours emergency call?',
    "Which AI receptionist plan fits me?",
    'Can I hear a live demo?',
    // …everything else below
    'Do I need to change my phone number?',
    "What's included in the $2,400 website?"
  ] : IS_RECEPTIONIST ? [
    // AI-receptionist first…
    'How does the AI receptionist handle a missed call?',
    'How much does the AI receptionist cost?',
    'Can I hear a live demo?',
    // …everything else below
    "What's included in the $2,400 website?",
    'How fast can you launch a website?'
  ] : [
    'How does the Avoxan AI receptionist work?',
    "What's included in $2,400?",
    'Can it answer calls after hours?'
  ];

  // ---------- Styles ---------------------------------------------------------
  // All classes prefixed `avx-` so we don't collide with avoxan.css.
  // Falls back gracefully if brand CSS variables aren't defined yet.
  const CSS = `
  @property --avx-a { syntax: '<angle>'; inherits: false; initial-value: 0deg; }
  .avx-root {
    /* Studio palette by default; a page can override these on .avx-root */
    --avx-bg: #14100D;
    --avx-fg: #F1EAE0;
    --avx-mute: rgba(241, 234, 224, 0.66);
    --avx-faint: rgba(241, 234, 224, 0.48);
    --avx-line: rgba(241, 234, 224, 0.12);
    --avx-surface: rgba(241, 234, 224, 0.05);
    --avx-accent: #E4703F;
    --avx-on-accent: #170C07;
    --avx-launch-bg: rgba(20, 16, 13, 0.8);
    --avx-serif: 'Instrument Serif', Georgia, serif;
    --avx-sans: 'Geist', ui-sans-serif, system-ui, sans-serif;
    --avx-mono: 'JetBrains Mono', ui-monospace, monospace;
    --avx-ease: cubic-bezier(0.2, 0.7, 0.1, 1);
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    z-index: 9999;
    font-family: var(--avx-sans);
    color: var(--avx-fg);
    -webkit-font-smoothing: antialiased;
  }
  .avx-root *, .avx-root *::before, .avx-root *::after { box-sizing: border-box; }

  /* ===== Launcher: a dark glass pill with copper light running round its edge ===== */
  .avx-launcher {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    height: 54px;
    padding: 0 20px 0 8px;
    border: 0;
    border-radius: 999px;
    background: var(--avx-launch-bg);
    -webkit-backdrop-filter: blur(16px) saturate(140%);
    backdrop-filter: blur(16px) saturate(140%);
    color: var(--avx-fg);
    font: 500 15px/1 var(--avx-sans);
    letter-spacing: -0.005em;
    cursor: pointer;
    box-shadow: inset 0 0 0 1px var(--avx-line), 0 22px 50px -18px rgba(0, 0, 0, 0.75);
    transition: transform 0.35s var(--avx-ease), box-shadow 0.35s var(--avx-ease);
    -webkit-tap-highlight-color: transparent;
  }
  .avx-launcher::before {
    content: "";
    position: absolute;
    inset: 0;
    padding: 1.5px;
    border-radius: inherit;
    background: conic-gradient(from var(--avx-a), transparent 0 64%, rgba(228, 112, 63, 0.9) 78%, #FFD6B8 84%, rgba(228, 112, 63, 0.9) 89%, transparent 96%);
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
    mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    mask-composite: exclude;
    animation: avxSpin 5.5s linear infinite;
    pointer-events: none;
  }
  @keyframes avxSpin { to { --avx-a: 360deg; } }
  .avx-launcher:hover { transform: translateY(-2px); box-shadow: inset 0 0 0 1px var(--avx-line), 0 28px 60px -18px rgba(0, 0, 0, 0.85), 0 0 40px -10px rgba(228, 112, 63, 0.45); }
  .avx-launcher:active { transform: translateY(0); }
  .avx-launcher-mark {
    width: 38px; height: 38px;
    border-radius: 50%;
    display: grid; place-items: center;
    background: radial-gradient(circle at 30% 25%, rgba(228, 112, 63, 0.28), rgba(228, 112, 63, 0.08) 70%);
    box-shadow: inset 0 0 0 1px rgba(228, 112, 63, 0.35);
  }
  .avx-launcher-mark img { width: 20px; height: 27px; display: block; }
  .avx-launcher-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: #6FCF8E;
    box-shadow: 0 0 0 0 rgba(111, 207, 142, 0.6);
    animation: avxPing 2.6s infinite;
    margin-left: 2px;
  }
  @keyframes avxPing { 0% { box-shadow: 0 0 0 0 rgba(111, 207, 142, 0.55); } 70% { box-shadow: 0 0 0 8px rgba(111, 207, 142, 0); } 100% { box-shadow: 0 0 0 0 rgba(111, 207, 142, 0); } }

  /* ===== Panel ===== */
  .avx-panel {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 404px;
    height: min(680px, calc(100dvh - 3rem));
    background: var(--avx-bg);
    border-radius: 26px;
    box-shadow: inset 0 0 0 1px var(--avx-line), 0 50px 120px -30px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transform-origin: bottom right;
  }
  .avx-root[data-state="closed"] .avx-panel { display: none; }
  .avx-root[data-state="opening"] .avx-launcher,
  .avx-root[data-state="open"] .avx-launcher {
    opacity: 0; pointer-events: none; transform: scale(0.92);
    transition: opacity 0.18s ease, transform 0.18s ease;
  }
  .avx-root[data-state="opening"] .avx-panel,
  .avx-root[data-state="open"] .avx-panel { animation: avxOpen 0.5s var(--avx-ease) both; }
  @keyframes avxOpen {
    from { opacity: 0; transform: translateY(18px) scale(0.94); }
    to   { opacity: 1; transform: none; }
  }

  /* ===== Header ===== */
  .avx-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 14px 12px 16px;
    flex-shrink: 0;
  }
  .avx-header-mark {
    width: 36px; height: 36px; flex-shrink: 0;
    border-radius: 50%;
    display: grid; place-items: center;
    background: radial-gradient(circle at 30% 25%, rgba(228, 112, 63, 0.28), rgba(228, 112, 63, 0.08) 70%);
    box-shadow: inset 0 0 0 1px rgba(228, 112, 63, 0.35);
  }
  .avx-header-mark img { width: 19px; height: 26px; display: block; }
  .avx-header-text { flex: 1; min-width: 0; }
  .avx-header-title { font: 500 15px/1.2 var(--avx-sans); letter-spacing: -0.01em; color: var(--avx-fg); }
  .avx-header-sub {
    display: flex; align-items: center; gap: 7px;
    margin-top: 4px;
    font: 400 10.5px/1 var(--avx-mono);
    letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--avx-faint);
  }
  .avx-header-sub::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: #6FCF8E; }
  .avx-close {
    width: 36px; height: 36px;
    border: 0; border-radius: 50%;
    background: var(--avx-surface);
    box-shadow: inset 0 0 0 1px var(--avx-line);
    color: var(--avx-mute);
    cursor: pointer;
    display: grid; place-items: center;
    transition: color 0.2s, background 0.2s, transform 0.3s var(--avx-ease);
  }
  .avx-close svg { width: 14px; height: 14px; }
  .avx-close:hover { color: var(--avx-fg); transform: rotate(90deg); }

  /* ===== Thread ===== */
  .avx-thread {
    flex: 1;
    overflow-y: auto;
    padding: 4px 16px 16px;
    display: flex;
    flex-direction: column;
    gap: 18px;
    scrollbar-width: thin;
    scrollbar-color: var(--avx-line) transparent;
    overscroll-behavior: contain;
  }
  .avx-thread::-webkit-scrollbar { width: 6px; }
  .avx-thread::-webkit-scrollbar-thumb { background: var(--avx-line); border-radius: 3px; }

  /* Intro: a card cut from the silk film, then suggestions */
  .avx-hello {
    position: relative;
    isolation: isolate;
    min-height: 190px;
    padding: 20px;
    border-radius: 20px;
    overflow: hidden;
    display: flex; flex-direction: column; justify-content: flex-end;
    background: #0D0B09 url("/assets/studio/silk-poster.webp") 74% 36% / auto 190% no-repeat;
    box-shadow: inset 0 0 0 1px rgba(241, 234, 224, 0.1);
    color: #F1EAE0;
  }
  .avx-hello::before {
    content: ""; position: absolute; inset: 0; z-index: -1;
    background: linear-gradient(0deg, rgba(13, 11, 9, 0.95) 8%, rgba(13, 11, 9, 0.55) 52%, rgba(13, 11, 9, 0.05) 100%),
                linear-gradient(90deg, rgba(13, 11, 9, 0.7), rgba(13, 11, 9, 0) 70%);
  }
  .avx-hello h2 {
    margin: 0;
    font: 400 38px/1 var(--avx-serif);
    letter-spacing: -0.025em;
  }
  .avx-hello h2 em {
    font-style: italic;
    background: linear-gradient(180deg, #F2AE80 0%, #E28D58 30%, #FFD7B8 45%, #D9834D 55%, #7C361A 67%, #A04C24 76%, #EE9F6C 88%, #B85F31 100%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
    padding-right: 0.08em;
  }
  .avx-hello p { margin: 10px 0 0; font-size: 14px; line-height: 1.5; color: rgba(241, 234, 224, 0.72); max-width: 30ch; }
  .avx-hello p a { color: #F1EAE0; text-decoration: underline; text-decoration-color: rgba(228, 112, 63, 0.7); text-underline-offset: 3px; }
  .avx-try { margin: 4px 0 10px; font: 400 10.5px/1 var(--avx-mono); letter-spacing: 0.1em; text-transform: uppercase; color: var(--avx-faint); }
  .avx-suggestions { display: flex; flex-wrap: wrap; gap: 8px; }
  .avx-suggestion {
    text-align: left;
    border: 0;
    border-radius: 999px;
    padding: 10px 15px;
    background: var(--avx-surface);
    box-shadow: inset 0 0 0 1px var(--avx-line);
    font: 400 13.5px/1.3 var(--avx-sans);
    color: var(--avx-fg);
    cursor: pointer;
    transition: box-shadow 0.25s, background 0.25s, transform 0.3s var(--avx-ease);
  }
  .avx-suggestion:hover {
    background: rgba(228, 112, 63, 0.1);
    box-shadow: inset 0 0 0 1px rgba(228, 112, 63, 0.55);
    transform: translateY(-1px);
  }
  .avx-intro > * { animation: avxRise 0.6s var(--avx-ease) both; }
  .avx-intro > *:nth-child(2) { animation-delay: 0.08s; }
  .avx-intro > *:nth-child(3) { animation-delay: 0.14s; }
  @keyframes avxRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

  /* Messages */
  .avx-msg { display: flex; flex-direction: column; max-width: 100%; }
  .avx-msg-user {
    align-self: flex-end;
    max-width: 84%;
    padding: 11px 15px;
    border-radius: 20px 20px 6px 20px;
    background: rgba(228, 112, 63, 0.16);
    background: color-mix(in srgb, var(--avx-accent) 16%, transparent);
    box-shadow: inset 0 0 0 1px rgba(228, 112, 63, 0.3);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--avx-accent) 32%, transparent);
    font-size: 14.5px;
    line-height: 1.45;
    color: var(--avx-fg);
  }
  .avx-msg-bot { align-self: stretch; font-size: 15px; line-height: 1.6; color: var(--avx-fg); }
  .avx-msg-bot p { margin: 0 0 0.7rem; }
  .avx-msg-bot p:last-child { margin-bottom: 0; }
  .avx-msg-bot strong { font-weight: 600; }
  .avx-msg-bot em { font-family: var(--avx-serif); font-style: italic; font-size: 1.12em; }
  .avx-msg-bot a {
    color: var(--avx-fg);
    text-decoration: underline;
    text-decoration-color: var(--avx-accent);
    text-underline-offset: 3px;
    transition: color 0.2s;
  }
  .avx-msg-bot a:hover { color: var(--avx-accent); }
  .avx-msg-bot ul, .avx-msg-bot ol { margin: 0.3rem 0 0.7rem 1.1rem; padding: 0; }
  .avx-msg-bot li { margin-bottom: 0.3rem; }
  .avx-msg-bot li::marker { color: var(--avx-accent); }

  .avx-demo-btn {
    display: inline-flex; align-items: center; gap: 8px;
    margin-top: 0.7rem;
    padding: 11px 18px;
    background: var(--avx-accent); color: var(--avx-on-accent);
    border-radius: 999px;
    font: 600 14px/1 var(--avx-sans); text-decoration: none;
    transition: transform 0.3s var(--avx-ease), box-shadow 0.3s;
  }
  .avx-demo-btn:hover { transform: translateY(-1px); box-shadow: 0 10px 30px -10px rgba(228, 112, 63, 0.7); }
  .avx-demo-btn svg { width: 13px; height: 13px; }
  .avx-msg-bot a.avx-demo-btn, .avx-msg-bot a.avx-demo-btn:hover { color: var(--avx-on-accent); text-decoration: none; }

  /* Thinking: the same speaking bars as the client quote on the homepage */
  .avx-typing { display: inline-flex; align-items: center; gap: 3px; height: 22px; }
  .avx-typing i { width: 3px; height: 16px; border-radius: 2px; background: var(--avx-accent); transform: scaleY(0.35); animation: avxTalk 1.1s cubic-bezier(0.7, 0, 0.2, 1) infinite; }
  .avx-typing i:nth-child(2) { animation-delay: -0.35s; }
  .avx-typing i:nth-child(3) { animation-delay: -0.7s; }
  .avx-typing i:nth-child(4) { animation-delay: -0.15s; }
  @keyframes avxTalk { 0%, 100% { transform: scaleY(0.35); } 50% { transform: scaleY(1); } }

  .avx-error {
    font-size: 13.5px; line-height: 1.45;
    color: var(--avx-fg);
    background: rgba(228, 112, 63, 0.08);
    box-shadow: inset 0 0 0 1px rgba(228, 112, 63, 0.3);
    border-radius: 14px;
    padding: 11px 14px;
  }
  .avx-error a { color: var(--avx-fg); text-decoration: underline; text-decoration-color: var(--avx-accent); }

  /* ===== Composer ===== */
  .avx-footer { padding: 10px 14px 14px; flex-shrink: 0; }
  .avx-form {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 6px 6px 18px;
    border-radius: 999px;
    background: var(--avx-surface);
    box-shadow: inset 0 0 0 1px var(--avx-line);
    transition: box-shadow 0.25s;
  }
  .avx-form:focus-within { box-shadow: inset 0 0 0 1px var(--avx-accent), 0 0 0 4px rgba(228, 112, 63, 0.14); }
  .avx-input {
    flex: 1; min-width: 0;
    border: 0; outline: 0;
    background: transparent;
    padding: 9px 0;
    font: 400 15px/1.3 var(--avx-sans);
    color: var(--avx-fg);
  }
  .avx-input::placeholder { color: var(--avx-faint); }
  .avx-send {
    width: 40px; height: 40px; flex-shrink: 0;
    border: 0; border-radius: 50%;
    background: var(--avx-accent);
    color: var(--avx-on-accent);
    cursor: pointer;
    display: grid; place-items: center;
    transition: transform 0.3s var(--avx-ease), background 0.2s, color 0.2s;
  }
  .avx-send:hover:not(:disabled) { transform: translateY(-2px); }
  .avx-send:disabled { background: var(--avx-line); color: var(--avx-faint); cursor: not-allowed; }
  .avx-send svg { width: 17px; height: 17px; }
  .avx-disclosure {
    margin-top: 10px;
    text-align: center;
    font-size: 11.5px;
    line-height: 1.4;
    color: var(--avx-faint);
  }
  .avx-disclosure a { color: var(--avx-mute); text-decoration: underline; text-decoration-color: var(--avx-line); text-underline-offset: 2px; }
  .avx-disclosure a:hover { color: var(--avx-fg); }

  /* ===== Phones: a full-height sheet ===== */
  @media (max-width: 540px) {
    .avx-root { bottom: 1rem; right: 1rem; left: 1rem; }
    .avx-launcher { float: right; }
    .avx-panel {
      position: fixed;
      inset: 8px 8px max(8px, env(safe-area-inset-bottom)) 8px;
      width: auto; height: auto;
      border-radius: 24px;
    }
    .avx-hello { min-height: 170px; }
    .avx-hello h2 { font-size: 34px; }
    .avx-input { font-size: 16px; } /* stops iOS zooming into the field */
  }

  @media (prefers-reduced-motion: reduce) {
    .avx-root *, .avx-root *::before, .avx-root *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;

  // ---------- Logo mark ------------------------------------------------------
  // Uses the new Avoxan oval mark from /avoxan-logo.svg. Kept as an <img> so the
  // brand asset stays the single source of truth — update the SVG once, every
  // surface (nav, footer, favicon, chatbot) follows.
  const LOGO_SVG = `<img src="/avoxan-logo.svg" alt="Avoxan" aria-hidden="true">`;

  const ARROW_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"/></svg>`;
  const CLOSE_SVG = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/></svg>`;

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
  // Safety net for reasoning models (gpt-oss): Groq normally returns their thinking
  // in a separate `reasoning` field we never read, but if it ever arrives inline the
  // escaped tags would render as visible text. Drops closed blocks and the
  // still-streaming tail of an open one.
  function stripReasoning(text) {
    return text
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<think>[\s\S]*$/i, '');
  }
  // Renders a bot message and turns the [[BOOK_DEMO]] token into a CTA button.
  function renderBot(text) {
    const hasDemo = text.indexOf('[[BOOK_DEMO]]') !== -1;
    let clean = stripReasoning(text).replace(/\[\[BOOK_DEMO\]\]/g, '');
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
            <div class="avx-header-sub">Online · Replies in seconds</div>
          </div>
          <button class="avx-close" aria-label="Close chat" data-action="close">${CLOSE_SVG}</button>
        </header>

        <div class="avx-thread" role="log" aria-live="polite" aria-atomic="false"></div>

        <footer class="avx-footer">
          <form class="avx-form" data-action="send">
            <input
              class="avx-input"
              type="text"
              autocomplete="off"
              placeholder="Ask about pricing, timelines…"
              aria-label="Your message"
              maxlength="1000"
            />
            <button class="avx-send" type="submit" aria-label="Send message" disabled>
              ${ARROW_SVG}
            </button>
          </form>
          <div class="avx-disclosure">
            AI can get things wrong. For anything binding, <a href="/contact#book">book a call</a>.
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
      <div class="avx-hello">
        <h2>Ask us <em>anything.</em></h2>
        <p>Pricing, timelines, the AI receptionist, or whether we're a fit. Rather talk? <a href="/contact">Book a call</a>.</p>
      </div>
      <p class="avx-try">Try asking</p>
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
    el.innerHTML = `<span class="avx-typing" role="status" aria-label="Avoxan is typing"><i></i><i></i><i></i><i></i></span>`;
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
        body: JSON.stringify({ messages: history.slice(-MAX_HISTORY), context: 'site', page: location.pathname })
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
        // Keep reasoning out of the history we send back up on the next turn.
        history.push({ role: 'assistant', content: stripReasoning(assistantText) });
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
