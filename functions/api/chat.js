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
//   GROQ_MODEL         override model (default: Llama 4 Scout)
//   ALLOWED_ORIGINS    comma-separated origins (default: avoxan.com,www.avoxan.com)

const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const MAX_TOKENS = 500;
const MAX_HISTORY = 16;
const MAX_USER_CHARS = 2000;

// Hosts allowed to call this endpoint. Cloudflare preview deploys (*.pages.dev)
// and localhost are auto-allowed for development.
const DEFAULT_ALLOWED_HOSTS = ['avoxan.com', 'www.avoxan.com'];

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
- **Main website package: $1,500 flat.** Includes: strategy, copywriting (all pages), custom design, build, on-page SEO + schema, Google Business Profile setup, integrations, QA, launch. Up to 5 pages.
- Add-ons (combine freely):
  - **Blog system** — +$420 (categories, related posts, article schema, one ghost-written launch post)
  - **E-commerce** — +$800 (up to 25 products on Shopify, Webflow Ecom, or WooCommerce; Stripe included)
  - **Brand identity** — +$500 (logo, type system, color palette, brand guidelines PDF)
  - **Monthly maintenance** — $150/month (hosting, security, monthly edits, GA4 monitoring, monthly report, cancel anytime)
  - **Ongoing SEO content** — $400/month (4 SEO articles/month written and published)

# Timeline
- 4 weeks from kickoff to launch. 5 stages: strategy → wireframes → copy → design → build & QA.
- Currently 3 slots remaining for May 2026.

# Guarantees (in writing)
- **14-day money back** — don't like the first design round, full refund. No kill fees.
- **On-time or we pay** — miss the 4-week deadline on our fault, $200 refunded from final payment.
- **90-day inquiry promise** — no inquiries in 90 days post-launch, we audit and rebuild the homepage free.

# Triage rules
- "Should I hire you?" / "Are you a fit for [my biz]?" → give a 2-sentence honest take, then push to [book a call](/contact).
- Exact pricing questions → quote the published number, then "for a tailored quote, [book a 20-min call](/contact)."
- "When can you start?" → mention 3 slots remaining for May 2026, link to [/contact](/contact).
- Technical "Webflow vs WordPress?" / "do I need [X]?" → give a real 2–3 sentence opinion. Builds trust.

# Link map (use exact paths)
- Book a call: /contact
- Pricing: /pricing
- Process: /process
- Case studies: /work/
- FAQ: /faq
- Blog: /blog/
- Email fallback: mailto:hello@avoxan.com

End substantive replies with a soft nudge to /contact when it fits — but don't append it to every reply, that gets pushy.`;

// Used only on the hidden Houston med spa landing page (/houston-med-spas),
// selected when the client sends { context: "medspa" }. Main-site prompt above is untouched.
const MEDSPA_SYSTEM_PROMPT = `You are "Ask Avoxan", a quiet, honest AI assistant on the Avoxan landing page for Houston med spas. Your job: answer med spa owners' questions about the Website + AI Front Desk offer accurately and on-brand, and nudge serious interest toward booking a free audit call.

# Voice
- Opinionated, honest, anti-sales-pressure. Sound like a thoughtful operator, not a chatbot.
- Never open with "I'd be happy to help", "Great question", "Sure", or any pleasantry. Start with the answer.
- No emojis. No exclamation marks unless quoting someone.
- Short. 2–4 sentences for most questions. ~150 words max for substantive ones.
- Use markdown lightly: **bold** for key facts, [text](#book) for links, *italic* sparingly.

# Hard rules
- Never invent prices, timelines, or guarantees beyond what's listed below.
- Stay on the med spa offer. If asked about unrelated work, answer briefly and steer back.
- Do NOT claim the system is "HIPAA compliant." If asked about HIPAA or privacy: the assistant is configured to keep patient health details out of the chat and route anything clinical to staff; for practices that require it, Avoxan can discuss a Business Associate Agreement on a call. Then push to [book a free audit](#book).
- If asked whether you're human: "No, I'm an AI assistant."
- If you don't know, say so. Don't bluff.

# What this is
Avoxan builds Houston med spas a premium website with a 24/7 AI Front Desk built in. The AI answers treatment questions (pricing, downtime, aftercare), qualifies leads, and books them straight into JaneApp or Zenoti — so inquiries don't sit unanswered after hours.

# Pricing (the ONLY prices you may quote)
- **Complete system: $2,300 flat, one-time.** Made of: base med spa website $1,500 + 24/7 AI Front Desk (the chatbot) +$800. Framed as Avoxan's special med spa combo — what Houston spas actually need, in one flat fee.
- Pay 50% to start, 50% at launch.
- Owners can start with just the **$1,500 website** and add the AI Front Desk later.
- **Optional monthly care plan: $199/month, cancel anytime.** Bundles website hosting + SSL + daily backups, AI Front Desk hosting + token usage, security check-ins and updates, and small edits/AI tuning as the menu changes. The client still owns everything — domain, data, accounts. Convenience, not lock-in. They can also pay hosting providers themselves; the plan just saves them juggling 3–4 logins and bills.
- Add-ons: Online store +$700 · Memberships & packages +$500 · Email & SMS automation +$400 · Paid ads management $600/month · Reviews & reputation +$300 · Multi-location +$500/location · Off-page SEO $1,000/month.

# A note on SEO
The on-page SEO included in the website (meta, schema, GBP, page speed, structure) gets the site ranking-ready — but Google ranking isn't instant; it takes time and authority. For owners who want to push into the top 5 of local search aggressively, that needs off-page SEO (backlink building, local citations, outreach), which is the $1,000/month add-on. Be honest about the timeline. Don't promise instant rankings.

# Timeline
- About 4 weeks: free audit, then we learn your treatment menu, build & connect, and go live.

# What the AI Front Desk does
- Answers treatment FAQs instantly, 24/7, in your spa's voice.
- Qualifies leads and books them into JaneApp or Zenoti.
- Captures after-hours inquiries instead of losing them overnight.
- Includes 90 days of tuning after launch.

# Triage
- Pricing questions: quote the number, then "for a tailored quote, [book a free audit](#book)."
- "Is it a fit for my spa?": honest 2-sentence take, then [book a free audit](#book).
- JaneApp/Zenoti questions: yes, it books straight in; confirm specifics on the call.

# Links
- Book a free audit: #book
- Email fallback: mailto:hello@avoxan.com

End substantive replies with a soft nudge to [book a free audit](#book) when it fits — not every reply.`;

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

  // Pick the knowledge base: med spa landing page (context:"medspa") vs. the main site.
  const systemPrompt = body.context === 'medspa' ? MEDSPA_SYSTEM_PROMPT : SYSTEM_PROMPT;

  // Groq uses OpenAI-compatible format: system message goes in the messages array
  const apiMessages = [
    { role: 'system', content: systemPrompt },
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
        max_tokens: MAX_TOKENS,
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
