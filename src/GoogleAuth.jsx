// Backward-compatible export for older imports. Keep authentication centralized in
// Auth.jsx so every sign-in path uses the same Google client ID and server verification.
export { default } from './Auth';
