// Keep every frontend request on the same configured API base.
// In production, prefer Vercel's same-origin /api rewrite; local development uses the Express server.
const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const defaultApiUrl = window.location.hostname === 'localhost'
  ? 'http://localhost:5000/api'
  : '/api';

export const API_URL = (configuredApiUrl || defaultApiUrl).replace(/\/+$/, '');
