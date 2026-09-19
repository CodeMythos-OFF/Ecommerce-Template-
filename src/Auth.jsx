import React, { useEffect, useRef, useState } from 'react';
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

  const clearUser = () => {
    sessionStorage.removeItem('authUser');
    setUserInfo(null);
    setIsSignedIn(false);
    window.dispatchEvent(new Event('userChanged'));
  };

  const applyUser = (user) => {
    setUserInfo(user);
    setIsSignedIn(true);
    sessionStorage.setItem('authUser', JSON.stringify(user));
    window.dispatchEvent(new Event('userChanged'));
    onSignInSuccess?.(user);
  };

  const handleGoogleCredentialResponse = async (response) => {
    if (!response?.credential) {
      setIsGoogleLoading(false);
      onSignInFailure?.(new Error('Google did not return a credential'));
      return;
    }

    setIsGoogleLoading(true);

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
      onSignInFailure?.(error);
    } finally {
      setIsGoogleLoading(false);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const initializeGoogle = async () => {
      try {
        await GoogleAuthService.initialize(handleGoogleCredentialResponse);
        if (!cancelled && googleButtonRef.current) {
          const rendered = GoogleAuthService.renderButton(googleButtonRef.current, { width: 250 });
          if (rendered) {
            setGoogleReady(true);
            setGoogleError('');
          } else {
            throw new Error('Google sign-in button could not be rendered');
          }
        }
      } catch (error) {
        console.error('Failed to initialize Google Identity Services:', error);
        if (!cancelled) {
          setGoogleReady(false);
          setGoogleError('Google sign-in could not load. Please refresh the page and try again.');
        }
      }
    };

    initializeGoogle();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          credentials: 'include',
        });

        const data = await response.json().catch(() => ({}));
        if (response.ok && data.success && data.user) {
          setUserInfo(data.user);
          setIsSignedIn(true);
          sessionStorage.setItem('authUser', JSON.stringify(data.user));
        } else {
          clearUser();
        }
      } catch (error) {
        console.warn('Could not restore authentication session:', error);
        clearUser();
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);


  const handleSignOut = async () => {
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
  };

  if (isLoading && !isSignedIn) {
    return (
      <div className="google-auth-loading">
        <div className="spinner"></div>
        <p>Checking your sign-in...</p>
      </div>
    );
  }

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
          <small className="text-muted">
            Signed in with Google
          </small>
        </div>
        <button onClick={handleSignOut} className="sign-out-button">Sign Out</button>
      </div>
    );
  }

  return (
    <div className="google-auth-container">
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
        <p role="alert" style={{ color: '#b02a37', fontSize: '0.85rem', textAlign: 'center', maxWidth: '320px', margin: 0 }}>
          {googleError}
        </p>
      )}
      {!googleReady && !googleError && (
        <p style={{ color: '#666', fontSize: '0.85rem', margin: 0 }}>Loading Google sign-in…</p>
      )}

      <p className="google-auth-disclaimer">
        By signing in, you agree to our Terms of Service and Privacy Policy
      </p>
    </div>
  );
};

export default Auth;
