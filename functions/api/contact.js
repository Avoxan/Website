/**
 * /api/contact — Cloudflare Pages Function
 * ─────────────────────────────────────────────────────────────────────
 * Handles POST submissions from the contact form on /contact.html and
 * forwards them to hello@avoxan.com via the Resend transactional-email
 * API. Returns JSON so the page can show an in-place success/error
 * state without a navigation.
 *
 * ─── ONE-TIME SETUP ──────────────────────────────────────────────────
 *   1. Sign up at https://resend.com (free tier: 3,000 emails/month,
 *      100/day — more than enough for a contact form).
 *   2. Add and verify the `avoxan.com` domain in Resend's dashboard.
 *      Resend will give you 3 DNS records (SPF, DKIM, return-path) —
 *      add them in Cloudflare DNS, click "Verify," done in <5 minutes.
 *   3. Create an API key in Resend → API Keys.
 *   4. In Cloudflare Pages dashboard → your site → Settings →
 *      Environment variables → add the following (set them on BOTH
 *      "Production" and "Preview" if you want previews to work):
 *
 *        RESEND_API_KEY   = re_xxxxxxxxxxxxxxxxxxx   (from step 3)
 *        CONTACT_EMAIL    = hello@avoxan.com         (where leads go)
 *        FROM_EMAIL       = Avoxan <contact@avoxan.com>
 *                                       (must be on the verified domain)
 *
 *   5. Redeploy. That's it.
 *
 * If RESEND_API_KEY is missing, the function still returns success to
 * the user (so the form never *looks* broken during setup) but logs the
 * submission to the Cloudflare Functions log — visible in your Pages
 * dashboard under Deployments → [deployment] → Functions → Real-time
 * logs. No submission is ever lost.
 * ─────────────────────────────────────────────────────────────────────
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  let formData;
  try {
    // Accept both multipart/form-data and application/x-www-form-urlencoded
    formData = await request.formData();
  } catch (err) {
    return json({ ok: false, error: 'Invalid form data' }, 400);
  }

  // Honeypot — bots that fill every input get silently dropped.
  // Returning success keeps the bot from retrying.
  if ((formData.get('bot-field') || '').toString().trim()) {
    return json({ ok: true });
  }

  // Pull and trim every field
  const name     = (formData.get('name')      || '').toString().trim();
  const email    = (formData.get('email')     || '').toString().trim();
  const phone    = (formData.get('phone')     || '').toString().trim();
  const website  = (formData.get('website')   || '').toString().trim();
  const bestTime = (formData.get('best_time') || '').toString().trim();
  const message  = (formData.get('message')   || '').toString().trim();

  // Server-side validation (don't trust client-side `required` alone)
  if (!name || !email || !message) {
    return json(
      { ok: false, error: 'Name, email, and message are required.' },
      400
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ ok: false, error: 'That email address looks off.' }, 400);
  }
  if (message.length > 5000) {
    return json({ ok: false, error: 'Message is too long (5000 chars max).' }, 400);
  }

  // Build readable email bodies
  const subject = `New Avoxan inquiry — ${name}`;
  const textBody = [
    `New inquiry from ${name}`,
    '',
    `Email:           ${email}`,
    phone    ? `Phone:           ${phone}`             : null,
    website  ? `Website:         ${website}`           : null,
    bestTime ? `Best to reach:   ${bestTime}`          : null,
    '',
    'Message',
    '─────────────────────────',
    message,
    '─────────────────────────',
    '',
    'Sent from avoxan.com/contact',
    `Submitted: ${new Date().toISOString()}`,
  ].filter((l) => l !== null).join('\n');

  const htmlBody = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;color:#14110f;line-height:1.55;">
      <h2 style="font-family:Georgia,serif;font-weight:500;font-size:22px;border-bottom:2px solid #C04A1F;padding-bottom:10px;margin:0 0 18px;">
        New inquiry from ${esc(name)}
      </h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:14px;">
        <tr><td style="padding:6px 14px 6px 0;color:#6b6661;width:130px;">Email</td>
            <td><a href="mailto:${esc(email)}" style="color:#14110f;">${esc(email)}</a></td></tr>
        ${phone    ? `<tr><td style="padding:6px 14px 6px 0;color:#6b6661;">Phone</td><td>${esc(phone)}</td></tr>` : ''}
        ${website  ? `<tr><td style="padding:6px 14px 6px 0;color:#6b6661;">Website</td><td><a href="${esc(website)}" style="color:#14110f;">${esc(website)}</a></td></tr>` : ''}
        ${bestTime ? `<tr><td style="padding:6px 14px 6px 0;color:#6b6661;">Best to reach</td><td>${esc(bestTime)}</td></tr>` : ''}
      </table>
      <h3 style="font-family:Georgia,serif;font-weight:500;font-size:16px;margin:0 0 10px;color:#14110f;">Message</h3>
      <div style="white-space:pre-wrap;background:#F2EBDC;padding:16px 18px;border-left:3px solid #C04A1F;border-radius:4px;font-size:14px;line-height:1.6;">${esc(message)}</div>
      <p style="color:#9a958f;font-size:12px;margin-top:24px;">
        Sent from avoxan.com/contact · ${new Date().toUTCString()}
      </p>
    </div>
  `;

  // If RESEND_API_KEY is missing, log and return success.
  // This keeps the form working during initial deploy / before Resend
  // is configured — submissions appear in the Pages Functions log.
  if (!env.RESEND_API_KEY) {
    console.log('[contact] RESEND_API_KEY not set — logging submission:');
    console.log(textBody);
    return json({ ok: true, mode: 'logged' });
  }

  const toEmail   = env.CONTACT_EMAIL || 'hello@avoxan.com';
  const fromEmail = env.FROM_EMAIL    || 'Avoxan <contact@avoxan.com>';

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        reply_to: email,
        subject,
        text: textBody,
        html: htmlBody,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('[contact] Resend API error', res.status, body);
      // We still got the data — log it so nothing is lost.
      console.log('[contact] Lost-email submission body:');
      console.log(textBody);
      return json(
        { ok: false, error: "Couldn't reach the mail server — try again, or just email hello@avoxan.com directly." },
        502
      );
    }

    return json({ ok: true });
  } catch (err) {
    console.error('[contact] Submission handler crash:', err);
    console.log('[contact] Lost-email submission body:');
    console.log(textBody);
    return json(
      { ok: false, error: 'Server error. Please email hello@avoxan.com directly.' },
      500
    );
  }
}

// Block all other HTTP methods cleanly
export const onRequestGet = () =>
  json({ ok: false, error: 'POST only' }, 405);

// ─── helpers ─────────────────────────────────────────────────────────
function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[c]));
}
