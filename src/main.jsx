import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AuthCallback from './pages/AuthCallback.jsx'

// Check if we're on the auth callback page
const isAuthCallback = window.location.pathname === '/auth-callback' || 
                       window.location.pathname === '/auth-callback.html';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isAuthCallback ? <AuthCallback /> : <App />}
  </StrictMode>,
)
