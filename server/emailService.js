import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.office365.com';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || SMTP_USER;

let transporter = null;

const getTransporter = () => {
  if (!SMTP_USER || !SMTP_PASS) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 30000
    });
  }
  return transporter;
};

export const isEmailConfigured = () => Boolean(SMTP_USER && SMTP_PASS && EMAIL_FROM);

export const renderTemplate = (template, variables = {}) => {
  return String(template || '').replace(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g, (_, key) => {
    const value = variables[key];
    return value === undefined || value === null ? '' : String(value);
  });
};

export const sendEmail = async ({ to, subject, text, html }) => {
  const mailer = getTransporter();
  if (!mailer || !to) {
    console.warn('Email not sent: SMTP is not configured or recipient is missing.');
    return { sent: false, skipped: true };
  }

  const info = await mailer.sendMail({
    from: EMAIL_FROM,
    to,
    subject,
    text,
    html
  });

  console.log('📧 Email sent:', info.messageId);
  return { sent: true, messageId: info.messageId };
};

export const verifyEmailTransport = async () => {
  const mailer = getTransporter();
  if (!mailer) return { configured: false, verified: false };
  await mailer.verify();
  return { configured: true, verified: true };
};
