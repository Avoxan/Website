/**
 * /api/contact - Cloudflare Pages Function
 *
 * Handles the website discovery form plus the AI receptionist forms, then
 * sends the submission to the same Resend-powered inbox workflow.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SUBJECT_PREFIX_BY_FORM = {
  website_discovery: 'New Website Discovery Call Lead',
  ai_receptionist: 'New AI Receptionist Lead',
  ai_receptionist_plumbers: 'New Houston Plumber AI Receptionist Lead',
};

const FORM_TYPE_LABELS = {
  website_discovery: 'Website discovery',
  ai_receptionist: 'AI receptionist',
  ai_receptionist_plumbers: 'Houston plumber AI receptionist',
};

const FIELD_LABELS = {
  form_type: 'Form type',
  source_page: 'Page/source',
  name: 'Name',
  business: 'Business name',
  business_name: 'Business name',
  company: 'Business name',
  email: 'Email',
  phone: 'Phone number',
  website: 'Website',
  industry: 'Industry',
  emergency_service: 'Emergency / after-hours service',
  missed_calls: 'Missed calls per week',
  demo_time: 'Preferred demo time',
  best_time: 'Best way/time',
  message: 'Message',
};

const ORDERED_FIELDS = [
  'form_type',
  'source_page',
  'name',
  'business',
  'business_name',
  'company',
  'email',
  'phone',
  'website',
  'industry',
  'emergency_service',
  'missed_calls',
  'demo_time',
  'best_time',
  'message',
];

export async function onRequestPost(context) {
  const { request, env } = context;

  let formData;
  try {
    formData = await request.formData();
  } catch (err) {
    return json({ ok: false, error: 'Invalid form data' }, 400);
  }

  // Honeypot: bots that fill every field get silently dropped.
  if ((formData.get('bot-field') || '').toString().trim()) {
    return json({ ok: true });
  }

  const fields = collectFields(formData);
  const validationError = validateSubmission(fields);
  if (validationError) {
    return json({ ok: false, error: validationError }, 400);
  }

  const formType = fields.form_type || 'unknown';
  const name = fields.name || '';
  const business = fields.business || fields.business_name || fields.company || '';
  const subjectName = business || name || 'Unknown';
  const subject = buildSubject(formType, subjectName);
  const submittedAt = new Date();
  const textBody = buildTextBody(subject, fields, submittedAt);
  const htmlBody = buildHtmlBody(subject, fields, submittedAt);

  if (!env.RESEND_API_KEY) {
    console.log('[contact] RESEND_API_KEY not set - logging submission:');
    console.log(textBody);
    return json({ ok: true, mode: 'logged' });
  }

  const toEmail = env.CONTACT_EMAIL || 'hello@avoxan.com';
  const fromEmail = env.FROM_EMAIL || 'Avoxan <contact@avoxan.com>';
  const payload = {
    from: fromEmail,
    to: [toEmail],
    subject,
    text: textBody,
    html: htmlBody,
  };

  if (fields.email && EMAIL_RE.test(fields.email)) {
    payload.reply_to = fields.email;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('[contact] Resend API error', res.status, body);
      console.log('[contact] Lost-email submission body:');
      console.log(textBody);
      return json(
        { ok: false, error: "Couldn't reach the mail server - try again, or just email hello@avoxan.com directly." },
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

export const onRequestGet = () =>
  json({ ok: false, error: 'POST only' }, 405);

function collectFields(formData) {
  const fields = {};

  for (const [key, rawValue] of formData.entries()) {
    if (key === 'bot-field') continue;

    const value = String(rawValue || '').trim();
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      fields[key] = [fields[key], value].filter(Boolean).join(', ');
    } else {
      fields[key] = value;
    }
  }

  return fields;
}

function validateSubmission(fields) {
  const formType = fields.form_type || 'unknown';
  const name = fields.name || '';
  const business = fields.business || fields.business_name || fields.company || '';
  const email = fields.email || '';
  const phone = fields.phone || '';
  const message = fields.message || '';

  if (formType === 'website_discovery') {
    if (!name || !email || !message) {
      return 'Name, email, and message are required.';
    }
  } else if (formType === 'ai_receptionist' || formType === 'ai_receptionist_plumbers') {
    if (!name || !business || !phone) {
      return 'Name, business name, and phone number are required.';
    }
  } else if (!name && !business) {
    return 'Name or business name is required.';
  }

  if (email && !EMAIL_RE.test(email)) {
    return 'That email address looks off.';
  }

  if (message.length > 5000) {
    return 'Message is too long (5000 chars max).';
  }

  return null;
}

function buildSubject(formType, subjectName) {
  const prefix = SUBJECT_PREFIX_BY_FORM[formType];
  if (prefix) return `${prefix}: ${subjectName}`;
  return `New Avoxan Form Submission: ${subjectName}`;
}

function buildTextBody(subject, fields, submittedAt) {
  const lines = [
    subject,
    '',
    ...orderedFieldKeys(fields).map((key) => `${fieldLabel(key)}: ${displayValue(key, fields[key])}`),
    '',
    `Submitted: ${submittedAt.toISOString()}`,
  ];

  return lines.join('\n');
}

function buildHtmlBody(subject, fields, submittedAt) {
  const rows = orderedFieldKeys(fields).map((key) => `
        <tr>
          <td style="padding:7px 14px 7px 0;color:#6b6661;width:170px;vertical-align:top;">${esc(fieldLabel(key))}</td>
          <td style="padding:7px 0;vertical-align:top;">${formatHtmlValue(key, fields[key])}</td>
        </tr>
  `).join('');

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:640px;color:#14110f;line-height:1.55;">
      <h2 style="font-family:Georgia,serif;font-weight:500;font-size:22px;border-bottom:2px solid #C04A1F;padding-bottom:10px;margin:0 0 18px;">
        ${esc(subject)}
      </h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:14px;">
        ${rows}
      </table>
      <p style="color:#9a958f;font-size:12px;margin-top:24px;">
        Submitted ${esc(submittedAt.toUTCString())}
      </p>
    </div>
  `;
}

function orderedFieldKeys(fields) {
  const seen = new Set();
  const keys = [];

  ORDERED_FIELDS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      keys.push(key);
      seen.add(key);
    }
  });

  Object.keys(fields).forEach((key) => {
    if (!seen.has(key)) keys.push(key);
  });

  return keys;
}

function fieldLabel(key) {
  return FIELD_LABELS[key] || key
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function displayValue(key, value) {
  if (key === 'form_type') {
    return FORM_TYPE_LABELS[value] || value || 'Not provided';
  }
  return value || 'Not provided';
}

function formatHtmlValue(key, value) {
  const display = displayValue(key, value);
  if (!value) return `<span style="color:#9a958f;">${esc(display)}</span>`;

  if (key === 'email' && EMAIL_RE.test(value)) {
    return `<a href="mailto:${esc(value)}" style="color:#14110f;">${esc(value)}</a>`;
  }

  if (key === 'website') {
    const href = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return `<a href="${esc(href)}" style="color:#14110f;">${esc(value)}</a>`;
  }

  return `<span style="white-space:pre-wrap;">${esc(display)}</span>`;
}

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
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[c]));
}
