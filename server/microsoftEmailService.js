import crypto from 'crypto';
import { ConfidentialClientApplication } from '@azure/msal-node';

const GRAPH_SCOPE = 'https://graph.microsoft.com/Mail.Send';
const AUTHORITY = 'https://login.microsoftonline.com/consumers';
const CALLBACK_PATH = '/api/email/microsoft/callback';

const config = () => ({
  clientId: process.env.MICROSOFT_CLIENT_ID || '',
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
  redirectUri: process.env.MICROSOFT_REDIRECT_URI || ''
});

const app = () => {
  const { clientId, clientSecret } = config();
  if (!clientId || !clientSecret) return null;
  return new ConfidentialClientApplication({ auth: { clientId, clientSecret, authority: AUTHORITY } });
};

const key = () => crypto.createHash('sha256').update(process.env.AUTH_SESSION_SECRET || '').digest();

const encrypt = (value) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
};

const decrypt = (value) => {
  const [iv, tag, encrypted] = String(value || '').split('.');
  if (!iv || !tag || !encrypted) throw new Error('Invalid Microsoft token cache');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8');
};

export const getMicrosoftRedirectUri = () => config().redirectUri || `${process.env.BACKEND_PUBLIC_URL || 'https://backend-cm-test.vercel.app'}${CALLBACK_PATH}`;
export const isMicrosoftEmailConfigured = () => Boolean(config().clientId && config().clientSecret && process.env.AUTH_SESSION_SECRET);

export const createMicrosoftAuthUrl = async (state) => {
  const client = app();
  if (!client) throw new Error('Microsoft OAuth is not configured');
  return client.getAuthCodeUrl({
    scopes: ['openid', 'profile', 'email', 'offline_access', GRAPH_SCOPE],
    redirectUri: getMicrosoftRedirectUri(),
    state,
    prompt: 'select_account'
  });
};

export const exchangeMicrosoftCode = async (code) => {
  const client = app();
  if (!client) throw new Error('Microsoft OAuth is not configured');
  const result = await client.acquireTokenByCode({
    code,
    scopes: ['openid', 'profile', 'email', 'offline_access', GRAPH_SCOPE],
    redirectUri: getMicrosoftRedirectUri()
  });
  if (!result?.account) throw new Error('Microsoft account authorization failed');
  return { cache: encrypt(client.getTokenCache().serialize()), account: result.account };
};

export const getMicrosoftAccessToken = async (encryptedCache) => {
  const client = app();
  if (!client) throw new Error('Microsoft OAuth is not configured');
  client.getTokenCache().deserialize(decrypt(encryptedCache));
  const accounts = await client.getTokenCache().getAllAccounts();
  if (!accounts.length) throw new Error('Microsoft account is not connected');
  const result = await client.acquireTokenSilent({ account: accounts[0], scopes: [GRAPH_SCOPE] });
  return { accessToken: result.accessToken, cache: encrypt(client.getTokenCache().serialize()), account: result.account };
};

export const sendMicrosoftEmail = async ({ accessToken, to, subject, text, html }) => {
  const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: html ? 'HTML' : 'Text', content: html || text || '' },
        toRecipients: [{ emailAddress: { address: to } }]
      },
      saveToSentItems: true
    })
  });
  if (!response.ok) throw new Error(`Microsoft Graph sendMail failed: ${response.status} ${await response.text()}`);
};
