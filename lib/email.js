// Sends the app's transactional emails (signup confirmation, password
// reset) through Resend. We call Resend's plain HTTP API with the
// built-in `fetch` instead of installing their `resend` npm package —
// one less dependency for a single POST request.
//
// Setup (one-time, done by a human in the Resend dashboard, not here):
//   1. Create a free account at resend.com.
//   2. Dashboard -> API Keys -> create one, copy it.
//   3. Put it in .env locally as RESEND_API_KEY=... and in the Vercel
//      project's Environment Variables for production.
//
// IMPORTANT LIMITATION: until you verify your own domain in Resend's
// dashboard (Domains -> Add Domain -> add the DNS records they give
// you), the default onboarding@resend.dev address can ONLY deliver to
// the email address your Resend account itself is signed up with —
// every other recipient gets a 403. That's fine for testing with your
// own account, but real parents signing up won't receive anything until
// a domain is verified and FROM_EMAIL is set to an address on it (e.g.
// FROM_EMAIL="Little Explorers <hello@yourdomain.com>").

const RESEND_API_URL = 'https://api.resend.com/emails';

function getApiKey() {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error(
      'RESEND_API_KEY environment variable is not set. Create a free account at ' +
        'resend.com, copy an API key from the dashboard, and add it to your .env ' +
        'file locally and to the Vercel project settings.'
    );
  }
  return key;
}

function getFromAddress() {
  return process.env.FROM_EMAIL || 'Little Explorers <onboarding@resend.dev>';
}

// Where the links inside emails should point — your live site's URL in
// production (set APP_URL in Vercel), localhost while developing.
function getAppUrl() {
  return process.env.APP_URL || 'http://localhost:3000';
}

async function sendEmail({ to, subject, html }) {
  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: getFromAddress(), to, subject, html }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend API error (${res.status}): ${body}`);
  }
  return res.json();
}

// Shared wrapper so every email in this app looks like it came from the
// same place, instead of hand-writing a full HTML document each time.
function emailShell(heading, bodyHtml) {
  return `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <p style="font-size: 22px; font-weight: 700; color: #6C3CE9; margin: 0 0 20px;">📖 Little Explorers</p>
      <h2 style="font-size: 18px; color: #14121F; margin: 0 0 12px;">${heading}</h2>
      ${bodyHtml}
      <p style="color: #9691a8; font-size: 12px; margin-top: 32px;">
        You're receiving this because this email address was used on Little Explorers.
      </p>
    </div>
  `;
}

function button(href, label) {
  return `
    <p style="margin: 28px 0;">
      <a href="${href}" style="background:#FF4757; color:#fff; padding:14px 28px; border-radius:10px;
         text-decoration:none; font-weight:700; display:inline-block;">${label}</a>
    </p>
    <p style="color:#9691a8; font-size:13px;">If the button doesn't work, copy this link into your browser:<br>${href}</p>
  `;
}

async function sendVerificationEmail(to, token) {
  const link = `${getAppUrl()}/?verify=${token}`;
  await sendEmail({
    to,
    subject: 'Confirm your Little Explorers account',
    html: emailShell(
      'Confirm your email to activate your account',
      `<p style="color:#3d3854; line-height:1.6;">Thanks for signing up! Click below to confirm your email address — you'll need to do this once before you can log in.</p>
       ${button(link, 'Confirm my email')}
       <p style="color:#9691a8; font-size:13px;">This link expires in 24 hours.</p>`
    ),
  });
}

async function sendPasswordResetEmail(to, token) {
  const link = `${getAppUrl()}/?reset=${token}`;
  await sendEmail({
    to,
    subject: 'Reset your Little Explorers password',
    html: emailShell(
      'Reset your password',
      `<p style="color:#3d3854; line-height:1.6;">We received a request to reset your password. Click below to choose a new one.</p>
       ${button(link, 'Reset my password')}
       <p style="color:#9691a8; font-size:13px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email — your password won't change.</p>`
    ),
  });
}

module.exports = { sendEmail, sendVerificationEmail, sendPasswordResetEmail };
