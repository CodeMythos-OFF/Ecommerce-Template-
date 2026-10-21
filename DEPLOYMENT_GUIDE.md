# Production deployment checklist

This guide prepares ShopMaster for a production deployment while keeping the existing features and checkout flow unchanged.

## Hosting layout

The repository is configured for two Vercel projects:

1. **Frontend project** — repository root, framework preset **Vite**, install command `npm ci`, build command `npm run build`, output directory `dist`.
2. **Backend project** — set the project root directory to `server`. It uses `server/vercel.json` and the `@vercel/node` runtime.
3. **Database** — MongoDB Atlas. Use a dedicated database user with only the permissions the app needs and restrict Atlas network access to trusted deployment access where practical.

The frontend's `vercel.json` rewrites `/api/*` to the backend project. Keep this same-origin proxy as the default so browser cookies work consistently. If the backend deployment URL changes, update the rewrite destination and the backend CORS/security configuration together.

## Required backend environment variables

Set these in the **backend Vercel project's** Environment Variables. Do not commit real values into any `.env*` file.

| Variable | Requirement |
| --- | --- |
| `MONGODB_URI` | Required MongoDB Atlas connection string. |
| `AUTH_SESSION_SECRET` | Required, cryptographically random secret of at least 32 characters. |
| `GOOGLE_CLIENT_ID` | Google OAuth Web client ID. It must match the frontend client ID exactly. |
| `SUPER_ADMIN_DELETE_PIN` | Required for destructive super-admin actions; use a unique random value of at least 12 characters, not a short numeric PIN. |
| `FRONTEND_ORIGINS` | Optional comma-separated list of exact allowed frontend origins, e.g. `https://shop.example.com`. Do not include paths or trailing slashes. |

Optional AI variables: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `GROQ_API_KEY`, and `GROQ_MODEL`. Keep provider keys backend-only. Email notifications require the Microsoft email configuration documented in `server/README.md`; they are not required for core browsing and checkout.

### Generating secrets

Generate `AUTH_SESSION_SECRET` and `SUPER_ADMIN_DELETE_PIN` independently with a cryptographically secure password generator. Never reuse a Google, database, or AI-provider secret for either value. If a real credential was ever committed to Git, rotate it at the issuing provider even after removing the file from the current branch.

## Frontend environment variables

The frontend can use the repository's default Google client ID. If you set `VITE_GOOGLE_CLIENT_ID` in Vercel, set the exact same ID as backend `GOOGLE_CLIENT_ID`. Google client IDs are public identifiers; **never** put a client secret in a `VITE_*` variable.

Leave `VITE_API_URL` unset for the standard Vercel setup, which uses the same-origin `/api` rewrite. For local development, use `http://localhost:5000/api`. If hosting the API separately without a rewrite, set the full API base URL ending in `/api` and verify the browser's CORS, cookie, and Content Security Policy settings for that domain.

## Google OAuth setup

In Google Cloud Console, configure an OAuth **Web application** client. Add each real frontend hostname to **Authorized JavaScript origins**, including localhost only for development. The origin must be just scheme + host + optional port, not a path. Keep the client ID identical between the frontend and backend. Test sign-in and sign-out on the deployed HTTPS domain after configuration.

## Before going live

- [ ] Confirm all required backend environment variables are set in the production environment.
- [ ] Confirm the frontend rewrite points to the correct backend deployment.
- [ ] Confirm the MongoDB Atlas connection succeeds and `/api/health` returns HTTP 200 with `database: "connected"`.
- [ ] Confirm `/api/health` returns HTTP 503 while the database is unavailable; do not treat that state as ready.
- [ ] Test Google sign-in, page refresh/session restoration, and sign-out on the production hostname.
- [ ] Test customer checkout and invoice download with a test order; verify the order and stock in the database.
- [ ] Test seller isolation, approval/revocation, and admin-only operations with separate test accounts.
- [ ] Confirm order status transitions, analytics, legal pages, and the AI assistant if configured.
- [ ] Run the frontend build and dependency audit in CI and resolve any high/critical advisories before public launch.
- [ ] Review privacy policy, terms, tax/shipping/returns statements, and any legal obligations with a qualified adult/professional before accepting real customer data or payments.
- [ ] Enable suitable MongoDB backups, Vercel deployment protection where appropriate, monitoring, and an incident/credential-rotation plan.

## Health and limitations

The health endpoint is a readiness check for both the API process and MongoDB. A 503 response means the app is not ready to serve database-backed operations; it should not be interpreted as a successful production check.

Automated checks cannot verify live Google OAuth, Atlas credentials/network access, Microsoft email, or external AI-provider keys without those services and production environment values. Verify those integrations in a staging deployment before sending real customers to the store.
