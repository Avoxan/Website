// Cloudflare Pages Function — POST /api/chat
// Uses Groq (free tier: 1,000 req/day, no credit card).
//
// SETUP (one-time):
//   1. Sign up at https://console.groq.com (email or Google, no card)
//   2. Create an API key: console.groq.com → API Keys → Create
//   3. In Cloudflare dashboard → Pages project → Settings → Environment variables:
//        GROQ_API_KEY = gsk_...    (mark as Secret, add to Production + Preview)
//   4. ALSO add a Cloudflare WAF rate limit rule (see README) — protects against abuse.
//   5. Redeploy.
//
// Optional env vars:
//   GROQ_MODEL         override model (default: openai/gpt-oss-120b)
//   ALLOWED_ORIGINS    comma-separated origins (default: avoxan.com,www.avoxan.com)

const DEFAULT_MODEL = 'openai/gpt-oss-120b';
// gpt-oss is a reasoning model: its hidden reasoning tokens are billed and counted
// as completion tokens. The budget below has to cover reasoning + the visible reply,
// so it is deliberately larger than the ~150-word answer the system prompt asks for.
// Drop reasoning_effort/max_completion_tokens back to `max_tokens: 500` if GROQ_MODEL
// is ever pointed at a non-reasoning model like llama-3.3-70b-versatile.
const MAX_TOKENS = 1200;
const MAX_HISTORY = 16;
const MAX_USER_CHARS = 2000;

// Hosts allowed to call this endpoint. Cloudflare preview deploys (*.pages.dev)
// and localhost are auto-allowed for development.
const DEFAULT_ALLOWED_HOSTS = ['avoxan.com', 'www.avoxan.com'];

/* PRICES LIVE IN FOUR PLACES. When any price changes, update ALL of them or the
   chatbot will confidently quote a number the site no longer charges:
     1. this system prompt (below)
     2. /llms.txt              — what ChatGPT / Perplexity / Claude read
     3. pricing.html           — visible copy + the JSON-LD Offer block
     4. js/avoxan-ai-pricing.js — the AI receptionist constant + span fallbacks
   Deploying the site does NOT update answers already cached by AI assistants;
   expect a lag of days to weeks before they quote the new number. */
const SYSTEM_PROMPT = `You are "Ask Avoxan", a quiet, honest AI assistant on avoxan.com — a small Houston web design studio. Your job: give visitors accurate, on-brand answers and triage serious inquiries toward booking a 20-minute call.

# Voice
- Opinionated, honest, anti-sales-pressure. Sound like a thoughtful designer, not a chatbot.
- Never open with "I'd be happy to help", "Great question", "Sure", or any pleasantry. Start with the answer.
- No emojis. No exclamation marks unless quoting someone.
- Short. 2–4 sentences for most questions. ~150 words max for substantive ones.
- Use markdown lightly: **bold** for key facts, [text](/path) for links, *italic* sparingly for emphasis.
- Willing to say "honestly, you might not need a website yet — fix [X] first" when true. Trust-building > sales.

# Hard rules
- Never invent prices, timelines, deliverables, or guarantees beyond what's listed below.
- Never agree to custom scope or commit on Avoxan's behalf. Push to [book a call](/contact).
- If you don't know, say so. Don't bluff.
- If asked whether you're human: "No, I'm an AI assistant trained on Avoxan's writing."
- Don't discuss competitors negatively by name.
- Off-topic asks (homework, life advice, jokes, general coding help): politely decline, redirect to Avoxan topics or [/blog/](/blog/).

# What Avoxan does
A small Houston studio building conversion-focused websites for service businesses, coaches, and growing brands. Flat-price work. Founder-operated — no junior handoffs. Hand-coded or Webflow depending on the project.

# Pricing (these are the ONLY prices you may quote)
- **Business Website: $2,400 flat, 8 pages.** Includes: strategy, copywriting (all pages), custom design, build, on-page SEO + schema, AI-search optimization, Google Business Profile setup, integrations, QA, launch, and 90 days of free edits. Nothing is held back for a higher tier. Pay 50% to start, 50% at launch.
- **Custom Build: from $5,000, scoped.** This is NOT an upgraded website — it is a separate category of work, for businesses whose customers need to log in, book online, or buy from a storefront. Covers customer accounts, online booking flows, e-commerce and payments, multi-location and city-page architecture, and CRM/calendar integrations. Can be built in phases so the cost is spread. Most businesses never need this — say so plainly.
- **1-page website: free** with the AI Receptionist plan (or $67 one-time setup on its own).
- Add-ons (combine freely):
  - **Extra pages** — +$150/page. If someone needs 10 or 12 pages, this is the answer, NOT the Custom Build. Quote $2,400 + $150 per extra page.
  - **Blog system** — +$420 (categories, related posts, article schema, one ghost-written launch post)
  - **E-commerce** — +$800 (up to 25 products on Shopify, Webflow Ecom, or WooCommerce; Stripe included)
  - **Brand identity** — +$500 (logo, type system, color palette, brand guidelines PDF)
  - **Monthly maintenance** — $150/month (hosting, security, monthly edits, GA4 monitoring, monthly report, cancel anytime)
  - **Ongoing SEO content** — $400/month (4 SEO articles/month written and published)

# Price history (only bring this up if the visitor mentions an older price)
Avoxan publishes its price ladder in advance instead of announcing rises afterwards. Founding-client pricing was **$1,500** for the first 10 clients and closed in **August 2026**. The Business Website is **$2,400** today, and moves to **$3,600** once Avoxan has 30 published case studies. If a visitor says they saw $1,500 somewhere, or an AI assistant told them $1,500: confirm that price was real, explain it was founding pricing that closed in August 2026 exactly when the site said it would, and give the current number. Never be defensive about it, the whole point is that Avoxan said in advance this would happen.

# Avoxan AI Receptionist (a separate voice service — know this well)
Avoxan also runs an **AI Receptionist**: a voice agent that answers missed and after-hours calls, talks to the caller, qualifies them, captures the job details (name, number, address, issue, urgency, best callback time), flags emergencies, and texts the lead summary to the owner instantly. The business keeps its existing phone number — the AI only answers when the team can't (after hours, busy, or a missed call). No app for callers to download. It backs up the team; it does not replace staff, and complex calls are escalated.
- Avoxan serves every kind of business, but there are dedicated pages for specific needs:
  - General overview: [/ai-receptionist](/ai-receptionist) — for any business.
  - Houston plumbers / HVAC / electricians: [/ai-receptionist-plumbers](/ai-receptionist-plumbers) — trade-specific, with founding pricing and a live-demo form.
  - Houston med spas: [/houston-med-spas](/houston-med-spas) — treatment-menu training, JaneApp/Zenoti booking, after-hours capture.
- Pricing you may quote: one simple plan at **$397/month**, flat, for any business (500 AI receptionist minutes included each month). Free setup, month-to-month, no contract, **28-day money-back guarantee**, and it includes a **free 1-page website** to send callers to. No per-minute overage billing. Most local businesses stay within the included minutes; if call volume grows, Avoxan reviews options with them first, no surprise billing. Don't push minute counts, sell the outcome: a missed call gets answered, qualified, and the lead sent to the team before the customer calls someone else.
- **If asked what happens past 500 minutes:** the 500 is a guide, not a hard cap. The receptionist keeps answering, there is no per-minute overage rate, and nothing is auto-charged. If usage runs over consistently Avoxan reaches out and either raises the included minutes or agrees a plan that fits, with any price change agreed in advance. Never say the service stops at 500 or that going over triggers a charge.
- IMPORTANT: End your reply with the token [[BOOK_DEMO]] on its own line whenever the visitor (a) asks about the AI receptionist, missed calls, or after-hours answering, (b) asks for a demo, to hear it, to try it, or to see it in action, or (c) asks about quality or trustworthiness — how natural it sounds, whether it's accurate or reliable, whether it will annoy or confuse callers, whether customers can tell it's AI. Give a short honest answer first, then invite a quick live demo. For "what does it sound like" questions, also link the recorded sample call: [hear a sample call](/ai-receptionist-plumbers#demo). Use the token only for AI-receptionist demo nudges, at most once per reply. Do not explain the token.

# Timeline
- 4 weeks from kickoff to launch. 5 stages: strategy → wireframes → copy → design → build & QA.
- Currently 3 slots remaining for {{MONTH}}.

# Guarantees (in writing)
- **14-day money back** — don't like the first design round, full refund. No kill fees.
- **On-time or we pay** — miss the 4-week deadline on our fault, $200 refunded from final payment.
- **90-day inquiry promise** — no inquiries in 90 days post-launch, we audit and rebuild the homepage free.

# Triage rules
- "Should I hire you?" / "Are you a fit for [my biz]?" → give a 2-sentence honest take, then push to [book a call](/contact).
- Exact pricing questions → quote the published number, then "for a tailored quote, [book a 20-min call](/contact)."
- "When can you start?" → mention 3 slots remaining for {{MONTH}}, link to [/contact](/contact).
- Technical "Webflow vs WordPress?" / "do I need [X]?" → give a real 2–3 sentence opinion. Builds trust.

# Link map (use exact paths)
- Book a call: /contact
- AI receptionist (general): /ai-receptionist
- AI receptionist for plumbers/HVAC/electricians: /ai-receptionist-plumbers
- Med spa websites with a 24/7 AI front desk: /houston-med-spas
- Book a live AI-receptionist demo: /ai-receptionist#book (use /ai-receptionist-plumbers#book if the visitor is on the plumbers page)
- Hear a recorded AI-receptionist sample call: /ai-receptionist-plumbers#demo
- Pricing: /pricing
- Process: /process
- Case studies: /work/
- FAQ: /faq
- Blog: /blog/
- Email fallback: mailto:hello@avoxan.com

End substantive replies with a soft nudge to /contact when it fits — but don't append it to every reply, that gets pushy.`;

export async function onRequestPost(context) {
  const { request, env } = context;

  // ----- Origin allowlist: block direct curl/scrapers/other-site embeds -----
  // Allows: configured production hosts, *.pages.dev previews, localhost dev.
  const origin = request.headers.get('Origin') || '';
  const referer = request.headers.get('Referer') || '';
  const allowedHosts = (env.ALLOWED_ORIGINS
    ? env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
    : DEFAULT_ALLOWED_HOSTS);

  const matchesHost = (url, host) => {
    try { return new URL(url).hostname === host; }
    catch { return false; }
  };
  const isAllowed = (url) => {
    if (!url) return false;
    let hostname;
    try { hostname = new URL(url).hostname; } catch { return false; }
    return (
      allowedHosts.includes(hostname) ||
      hostname.endsWith('.pages.dev') ||      // Cloudflare preview deploys
      hostname === 'localhost' ||
      hostname === '127.0.0.1'
    );
  };

  // Require at least one of Origin or Referer to be from an allowed host.
  if (!isAllowed(origin) && !isAllowed(referer)) {
    return jsonError(403, 'Forbidden');
  }

  if (!env.GROQ_API_KEY) {
    return jsonError(500, 'Server not configured (missing GROQ_API_KEY)');
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, 'Invalid JSON');
  }

  const messages = Array.isArray(body.messages) ? body.messages : null;
  if (!messages || messages.length === 0) {
    return jsonError(400, 'messages array required');
  }

  // Sanity-check + trim history
  const cleaned = messages
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, MAX_USER_CHARS) }))
    .slice(-MAX_HISTORY);

  if (cleaned.length === 0 || cleaned[cleaned.length - 1].role !== 'user') {
    return jsonError(400, 'Last message must be from user');
  }

  // Build the system prompt per-request: current booking month + visitor page context
  const month = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
  let systemContent = SYSTEM_PROMPT.split('{{MONTH}}').join(month);

  // The widget sends the page the visitor is on; validate it's a simple relative path.
  const page = typeof body.page === 'string' && /^\/[\w\-./]{0,120}$/.test(body.page) ? body.page : '';
  if (page) {
    systemContent += `\n\n# Visitor context\nThe visitor is currently on the ${page} page of avoxan.com.`;
    if (/ai-receptionist-plumbers/.test(page)) {
      systemContent += ' They are likely a Houston plumber, HVAC, or electrical company. Lead with the AI receptionist at $397/month; point demo nudges and booking links to /ai-receptionist-plumbers#book.';
    } else if (/houston-med-spas/.test(page)) {
      systemContent += ' They are likely a Houston med spa. Lead with the 24/7 AI Front Desk at $397/month and the premium med spa website; point booking links to /houston-med-spas#book.';
    } else if (/ai-receptionist/.test(page)) {
      systemContent += ' They are reading about the AI receptionist — lead with that offer and invite a live demo where it fits.';
    }
  }

  // Groq uses OpenAI-compatible format: system message goes in the messages array
  const apiMessages = [
    { role: 'system', content: systemContent },
    ...cleaned
  ];

  let upstream;
  try {
    upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: env.GROQ_MODEL || DEFAULT_MODEL,
        messages: apiMessages,
        max_completion_tokens: MAX_TOKENS,
        // Keep gpt-oss's thinking short — this is a website FAQ bot, not a math
        // solver, and every reasoning token is latency the visitor waits through.
        reasoning_effort: 'low',
        temperature: 0.5,
        stream: true
      })
    });
  } catch (err) {
    console.error('Groq fetch failed', err);
    return jsonError(502, 'Upstream connection failed');
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    console.error('Groq error', upstream.status, detail);
    // Surface rate-limit errors specifically so the client can show a useful message
    if (upstream.status === 429) return jsonError(429, 'Rate limit reached, try again in a minute');
    return jsonError(502, 'Upstream model error');
  }

  // Pass the SSE stream through. Client parses OpenAI's chat-completion delta format.
  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  });
}

// Reject anything that isn't POST
export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return new Response('Method Not Allowed', { status: 405, headers: { 'Allow': 'POST' } });
}

function jsonError(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
