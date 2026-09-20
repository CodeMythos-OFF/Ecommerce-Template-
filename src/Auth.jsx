import React, { useCallback, useEffect, useRef, useState } from 'react';
import './GoogleAuth.css';
import GoogleAuthService from './services/GoogleAuthService';

const API_URL = import.meta.env.VITE_API_URL || 'https://shopmaster-backend.vercel.app/api';

const Auth = ({ onSignInSuccess, onSignInFailure }) => {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [googleError, setGoogleError] = useState('');
  const googleButtonRef = useRef(null);
  const googleButtonRenderedRef = useRef(false);

  const clearUser = useCallback(() => {
    sessionStorage.removeItem('authUser');
    googleButtonRenderedRef.current = false;
    setUserInfo(null);
    setIsSignedIn(false);
    window.dispatchEvent(new Event('userChanged'));
  }, []);

  const applyUser = useCallback((user) => {
    setUserInfo(user);
    setIsSignedIn(true);
    sessionStorage.setItem('authUser', JSON.stringify(user));
    window.dispatchEvent(new Event('userChanged'));
    onSignInSuccess?.(user);
  }, [onSignInSuccess]);

  const handleGoogleCredentialResponse = useCallback(async (response) => {
    if (!response?.credential) {
      setIsGoogleLoading(false);
      onSignInFailure?.(new Error('Google did not return a credential'));
      return;
    }

    setIsGoogleLoading(true);
    setGoogleError('');

    try {
      const result = await fetch(`${API_URL}/auth/google/verify`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });

      const data = await result.json().catch(() => ({}));
      if (!result.ok || !data.success || !data.user) {
        throw new Error(data.error || 'Google sign-in verification failed');
      }

      applyUser(data.user);
    } catch (error) {
      console.error('Google sign-in failed:', error);
      clearUser();
      setGoogleError(error.message || 'Google sign-in failed');
      onSignInFailure?.(error);
    } finally {
      setIsGoogleLoading(false);
      setIsLoading(false);
    }
  }, [applyUser, clearUser, onSignInFailure]);

  // Restore the server-side session on every mount. If the cookie/session is gone,
  // clear the cached browser user instead of waiting forever on the loading screen.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const restoreSession = async () => {
      try {
        const result = await fetch(`${API_URL}/auth/me`, {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        });
        const data = await result.json().catch(() => ({}));

        if (cancelled) return;

        if (result.ok && data.authenticated && data.user) {
          applyUser(data.user);
        } else {
          clearUser();
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('Session restore failed:', error);
          clearUser();
        }
      } finally {
        clearTimeout(timeoutId);
        if (!cancelled) setIsLoading(false);
      }
    };

    restoreSession();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [applyUser, clearUser]);
  // Initialize Google once and render its button only once per mount.
  useEffect(() => {
    let cancelled = false;

    const initializeGoogle = async () => {
      try {
        setGoogleError('');
        await GoogleAuthService.initialize(handleGoogleCredentialResponse);
        if (cancelled) return;
        setGoogleReady(true);

        requestAnimationFrame(() => {
          if (cancelled || !googleButtonRef.current || googleButtonRenderedRef.current) return;
          const rendered = GoogleAuthService.renderButton(googleButtonRef.current, { width: 250 });
          if (rendered) {
            googleButtonRenderedRef.current = true;
          } else {
            setGoogleError('Google Sign-In could not be rendered. Please refresh the page.');
          }
        });
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to initialize Google Identity Services:', error);
          setGoogleError(error.message || 'Could not load Google Sign-In.');
        }
      }
    };

    initializeGoogle();
    return () => { cancelled = true; };
  }, [handleGoogleCredentialResponse]);


  const handleSignOut = async () => {
    setIsGoogleLoading(true);

    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.warn('Logout request failed:', error);
    }

    GoogleAuthService.signOut();
    clearUser();
    setIsLoading(false);
    setIsGoogleLoading(false);
    setGoogleError('');
    setGoogleReady(true);
  };

  if (isSignedIn && userInfo) {
    return (
      <div className="google-auth-profile">
        {userInfo.picture ? (
          <img src={userInfo.picture} alt="Profile" className="profile-picture" />
        ) : (
          <div className="profile-picture" style={{
            backgroundColor: '#667eea', color: 'white', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: '24px', fontWeight: 'bold'
          }}>
            {userInfo.name?.charAt(0).toUpperCase() || '?'}
          </div>
        )}
        <div className="profile-info">
          <h3>{userInfo.name}</h3>
          <p>{userInfo.email}</p>
          <small className="text-muted">Signed in with Google</small>
        </div>
        <button onClick={handleSignOut} className="sign-out-button">Sign Out</button>
      </div>
    );
  }

  return (
    <div className="google-auth-container">
      {isLoading && (
        <div className="google-auth-loading">
          <div className="spinner"></div>
          <p>Checking your sign-in...</p>
        </div>
      )}

      <div
        ref={googleButtonRef}
        aria-label="Sign in with Google"
        style={{
          width: '250px',
          minHeight: '44px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          opacity: isGoogleLoading ? 0.7 : 1,
          pointerEvents: isGoogleLoading ? 'none' : 'auto'
        }}
      />

      {googleError && (
        <p role="alert" style={{ marginTop: '12px', color: '#dc3545', fontSize: '14px' }}>
          {googleError}
        </p>
      )}

      <p className="google-auth-disclaimer">
        By signing in, you agree to our Terms of Service and Privacy Policy
      </p>
    </div>
  );
};

export default Auth;
