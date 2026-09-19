import React, { useEffect } from 'react';

/**
 * Auth Callback Page
 * Handles the redirect from Google OAuth popup
 * This page processes the auth code and sends it back to the parent window
 */
const AuthCallback = () => {
  useEffect(() => {
    // Parse the URL parameters
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (error) {
      // Handle error
      window.opener.postMessage({
        type: 'google-auth',
        success: false,
        error: params.get('error_description') || error,
      }, window.location.origin);
      window.close();
      return;
    }

    if (code && state) {
      // Verify state for security
      const storedState = sessionStorage.getItem('google_oauth_state');
      if (state !== storedState) {
        window.opener.postMessage({
          type: 'google-auth',
          success: false,
          error: 'State mismatch. Please try again.',
        }, window.location.origin);
        window.close();
        return;
      }

      // Send code to parent window
      // Parent will exchange the code for tokens via backend
      window.opener.postMessage({
        type: 'google-auth',
        success: true,
        code: code,
        state: state,
      }, window.location.origin);

      // Close this window
      window.close();
    }
  }, []);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      fontFamily: 'sans-serif',
      backgroundColor: '#f0f0f0',
    }}>
      <div style={{
        textAlign: 'center',
        padding: '2rem',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}>
        <div style={{
          display: 'inline-block',
          width: '40px',
          height: '40px',
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #4285f4',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '1rem',
        }}></div>
        <p style={{ color: '#666', margin: 0 }}>Completing sign-in...</p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
};

export default AuthCallback;
