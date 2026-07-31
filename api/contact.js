// Vercel serverless function backing the portfolio contact form.
//
// Delivery is via Resend's REST API (no dependencies — plain fetch). Set these
// project env vars to turn on real email delivery:
//   RESEND_API_KEY   - API key from https://resend.com
//   CONTACT_TO       - inbox that receives messages (default: daniel.lotsu.jnr@gmail.com)
//   CONTACT_FROM     - verified sender, e.g. "Portfolio <hello@yourdomain.com>"
//                      (default: onboarding@resend.dev, Resend's test sender)
//
// Without RESEND_API_KEY the endpoint still validates and accepts the message and
// responds { ok: true, delivered: false } so the form stays usable.

const crypto = require('crypto');
const { appendMessage } = require('./_messages');

const TO = process.env.CONTACT_TO || 'daniel.lotsu.jnr@gmail.com';
const FROM = process.env.CONTACT_FROM || 'Portfolio Contact <onboarding@resend.dev>';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ ok: false, error: 'Invalid request body' });
  }

  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  const message = String(body.message || '').trim();

  if (!name) return res.status(400).json({ ok: false, error: 'Name is required' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ ok: false, error: 'A valid email is required' });
  if (!message) return res.status(400).json({ ok: false, error: 'Message is required' });
  if (name.length > 120 || email.length > 200 || message.length > 5000) {
    return res.status(400).json({ ok: false, error: 'That message is too long' });
  }

  // Store first, so the CMS inbox has the message even if email delivery is off or
  // the provider is down. A storage failure must not lose the submission either —
  // log it and carry on to the email attempt.
  let stored = false;
  try {
    await appendMessage({
      id: crypto.randomUUID(),
      name,
      email,
      message,
      receivedAt: new Date().toISOString(),
      read: false,
    });
    stored = true;
  } catch (err) {
    console.error('[contact] could not store the message for the inbox:', err);
  }

  // CMS: Contact -> "Email me on new message". When off, the submission is kept in
  // the inbox only.
  let emailWanted = true;
  try {
    const { readContent } = require('./_content');
    const { content } = await readContent();
    emailWanted = !(content && content.contact && content.contact.emailOnMessage === false);
  } catch (err) {
    console.error('[contact] could not read the email preference, defaulting to send:', err);
  }
  if (!emailWanted) {
    return res.status(200).json({ ok: true, delivered: false, stored, suppressed: true });
  }

  if (!process.env.RESEND_API_KEY) {
    console.log('[contact] no RESEND_API_KEY set — message accepted but not emailed:', { name, email });
    return res.status(200).json({ ok: true, delivered: false, stored });
  }

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        reply_to: email,
        subject: `Portfolio message from ${name}`,
        html:
          `<p><strong>From:</strong> ${esc(name)} &lt;${esc(email)}&gt;</p>` +
          `<p style="white-space:pre-wrap">${esc(message)}</p>`,
        text: `From: ${name} <${email}>\n\n${message}`,
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      console.error('[contact] resend rejected the message:', r.status, detail);
      // the submission is already in the inbox, so it is not lost — don't tell the
      // sender it failed just because the email leg did
      if (stored) return res.status(200).json({ ok: true, delivered: false, stored });
      return res.status(502).json({ ok: false, error: 'Email provider rejected the message' });
    }

    return res.status(200).json({ ok: true, delivered: true, stored });
  } catch (err) {
    console.error('[contact] delivery failed:', err);
    if (stored) return res.status(200).json({ ok: true, delivered: false, stored });
    return res.status(502).json({ ok: false, error: 'Could not reach the email provider' });
  }
};
