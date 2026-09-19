import React, { useEffect, useRef, useState } from 'react';
import './GoogleAuth.css';
import GoogleAuthService from './services/GoogleAuthService';

const MICROSOFT_CLIENT_ID = '0ad4fe15-57b7-4e64-8189-2840b19c05f5';
const MICROSOFT_REDIRECT_URI = window.location.origin;
const API_URL = import.meta.env.VITE_API_URL || 'https://shopmaster-backend.vercel.app/api';

const Auth = ({ onSignInSuccess, onSignInFailure }) => {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
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
          GoogleAuthService.renderButton(googleButtonRef.current, { width: 250 });
        }
      } catch (error) {
        console.error('Failed to initialize Google Identity Services:', error);
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

  const handleMicrosoftSignIn = () => {
    setIsLoading(true);
    const state = crypto.randomUUID();
    const nonce = crypto.randomUUID();
    sessionStorage.setItem('microsoft_oauth_state', state);
    sessionStorage.setItem('microsoft_oauth_nonce', nonce);

    const authUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
    const params = new URLSearchParams({
      client_id: MICROSOFT_CLIENT_ID,
      response_type: 'id_token',
      redirect_uri: MICROSOFT_REDIRECT_URI,
      scope: 'openid profile email',
      response_mode: 'fragment',
      state,
      nonce,
    });

    const width = 500, height = 600;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    const popup = window.open(
      `${authUrl}?${params.toString()}`,
      'Microsoft Sign In',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    if (!popup) {
      setIsLoading(false);
      onSignInFailure?.(new Error('Please allow popups for Microsoft sign-in.'));
      return;
    }

    let interval;
    const cleanup = () => {
      clearInterval(interval);
      window.removeEventListener('message', handleMessage);
    };

    const handleMessage = (event) => {
      if (event.origin !== window.location.origin || event.data?.type !== 'microsoft-auth') return;
      cleanup();
      popup.close();

      if (event.data.success) applyUser(event.data.userData);
      else onSignInFailure?.(new Error(event.data.error || 'Microsoft sign-in failed'));

      setIsLoading(false);
    };

    window.addEventListener('message', handleMessage);
    interval = setInterval(() => {
      if (popup.closed) {
        cleanup();
        setIsLoading(false);
      }
    }, 500);
  };

  useEffect(() => {
    if (!window.opener) return;

    const params = new URLSearchParams(window.location.hash.substring(1));
    const idToken = params.get('id_token');
    const state = params.get('state');
    const error = params.get('error');

    if (idToken) {
      const storedState = sessionStorage.getItem('microsoft_oauth_state');
      if (!storedState || state !== storedState) {
        window.opener.postMessage(
          { type: 'microsoft-auth', success: false, error: 'Invalid OAuth state' },
          window.location.origin
        );
        window.close();
        return;
      }

      try {
        const userObject = parseJwt(idToken);
        if (!userObject?.sub) throw new Error('Invalid Microsoft ID token');

        window.opener.postMessage({
          type: 'microsoft-auth',
          success: true,
          userData: {
            provider: 'microsoft',
            email: userObject.email || userObject.preferred_username,
            name: userObject.name,
            picture: null,
            sub: userObject.sub,
            loginTime: new Date().toISOString(),
          },
        }, window.location.origin);
      } catch {
        window.opener.postMessage(
          { type: 'microsoft-auth', success: false, error: 'Failed to process token' },
          window.location.origin
        );
      } finally {
        window.close();
      }
    } else if (error) {
      window.opener.postMessage({
        type: 'microsoft-auth',
        success: false,
        error: params.get('error_description') || error,
      }, window.location.origin);
      window.close();
    }
  }, []);

  const parseJwt = (token) => {
    try {
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(decodeURIComponent(atob(base64).split('').map(
        (c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      ).join('')));
    } catch {
      return null;
    }
  };

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
            Signed in with {userInfo.provider === 'google' ? 'Google' : 'Microsoft'}
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

      <div style={{ margin: '15px 0', textAlign: 'center', color: '#666' }}>or</div>

      <button onClick={handleMicrosoftSignIn} disabled={isLoading} style={{
        width: '250px', padding: '10px 20px', backgroundColor: 'white',
        border: '1px solid #8C8C8C', borderRadius: '4px', display: 'flex',
        alignItems: 'center', justifyContent: 'center', gap: '10px',
        cursor: isLoading ? 'not-allowed' : 'pointer', fontSize: '14px',
        fontWeight: '500', opacity: isLoading ? 0.7 : 1
      }}>
        <svg width="21" height="21" viewBox="0 0 21 21" fill="none">
          <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
          <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
          <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
          <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
        </svg>
        Sign in with Microsoft
      </button>

      <p className="google-auth-disclaimer">
        By signing in, you agree to our Terms of Service and Privacy Policy
      </p>
    </div>
  );
};

export default Auth;
