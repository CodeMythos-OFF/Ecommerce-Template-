import React, { useState, useEffect } from 'react';
import './GoogleAuth.css';
import GoogleAuthService from './services/GoogleAuthService';

const MICROSOFT_CLIENT_ID = '0ad4fe15-57b7-4e64-8189-2840b19c05f5';
const MICROSOFT_REDIRECT_URI = window.location.origin;

const Auth = ({ onSignInSuccess, onSignInFailure }) => {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Initialize Google Auth Service on mount and handle OAuth callback
  useEffect(() => {
    const initGoogleAuth = async () => {
      try {
        await GoogleAuthService.initialize(handleGoogleCredentialResponse);
      } catch (error) {
        console.error('Failed to initialize Google Auth:', error);
      }
    };

    initGoogleAuth();

    // Check for OAuth callback parameters (when Google redirects back to base URL)
    const handleOAuthCallback = () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');
      const scope = params.get('scope');

      if (code) {
        // Verify state for security
        const storedState = sessionStorage.getItem('google_oauth_state');
        
        if (state && storedState && state === storedState) {
          console.log('OAuth callback received with valid state');
          
          // If this page is opened as a popup, message back to parent window
          if (window.opener && window.opener !== window) {
            try {
              window.opener.postMessage(
                {
                  type: 'google-auth-callback',
                  code: code,
                  scope: scope,
                },
                window.location.origin
              );
              // Close popup after sending message
              setTimeout(() => window.close(), 500);
              return;
            } catch (error) {
              console.error('Failed to message parent window:', error);
            }
          }
          
          // Otherwise, handle in current window
          exchangeCodeForTokens(code);
          
          // Clean up state from URL
          window.history.replaceState({}, document.title, window.location.pathname);
          sessionStorage.removeItem('google_oauth_state');
        } else if (code) {
          // Code present but state validation failed
          console.warn('State mismatch in OAuth callback - possible CSRF attack');
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    };

    handleOAuthCallback();

    return () => {
      // Cleanup is handled by GoogleAuthService singleton
    };
  }, []);

  const handleGoogleSignInClick = () => {
    setIsGoogleLoading(true);
    setIsLoading(true);

    try {
      // Start OAuth flow - uses popup approach
      // Google will redirect back to base URL with authorization code
      // The popup will message back the auth code to this window
      const popup = GoogleAuthService.openSignInPopup();

      if (!popup) {
        setIsGoogleLoading(false);
        setIsLoading(false);
        if (onSignInFailure) {
          onSignInFailure(new Error('Failed to open sign-in popup. Check browser popup settings.'));
        }
        return;
      }

      // Listen for message from popup with OAuth callback
      const handlePopupMessage = (event) => {
        // Verify origin for security
        if (event.origin !== window.location.origin) {
          return;
        }

        if (event.data && event.data.type === 'google-auth-callback') {
          window.removeEventListener('message', handlePopupMessage);
          clearInterval(checkPopupInterval);
          clearTimeout(timeoutId);

          if (event.data.code) {
            console.log('Received auth code from popup');
            exchangeCodeForTokens(event.data.code);
          } else {
            setIsGoogleLoading(false);
            setIsLoading(false);
            if (onSignInFailure) {
              onSignInFailure(new Error('No authorization code received'));
            }
          }
        }
      };

      window.addEventListener('message', handlePopupMessage);

      // Timeout to stop loading if auth doesn't complete
      const timeoutId = setTimeout(() => {
        window.removeEventListener('message', handlePopupMessage);
        setIsGoogleLoading(false);
        setIsLoading(false);
      }, 5000);

      // Monitor if popup is closed without authentication
      const checkPopupInterval = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(checkPopupInterval);
          clearTimeout(timeoutId);
          window.removeEventListener('message', handlePopupMessage);
          // Only show error if loading is still active
          if (isGoogleLoading) {
            setIsGoogleLoading(false);
            setIsLoading(false);
          }
        }
      }, 500);

    } catch (error) {
      setIsGoogleLoading(false);
      setIsLoading(false);
      console.error('Error starting Google sign-in:', error);
      if (onSignInFailure) {
        onSignInFailure(error);
      }
    }
  };

  /**
   * Exchange authorization code for tokens (handled by backend)
   * In production, add a backend endpoint to securely exchange the code
   */
  const exchangeCodeForTokens = async (code) => {
    try {
      // TODO: In production, call your backend API to exchange code for tokens
      // Example endpoint: POST /api/auth/google/callback
      // For now, we'll simulate with a mock response
      // You should implement this on your backend for security

      // Mock implementation - replace with actual backend call
      const mockUserData = {
        provider: 'google',
        email: 'user@example.com',
        name: 'User Name',
        picture: 'https://via.placeholder.com/80',
        sub: 'mock-sub-id',
        loginTime: new Date().toISOString(),
      };

      setUserInfo(mockUserData);
      setIsSignedIn(true);

      sessionStorage.setItem('authUser', JSON.stringify(mockUserData));
      sessionStorage.setItem('authCode', code);

      window.dispatchEvent(new Event('userChanged'));

      if (onSignInSuccess) {
        onSignInSuccess(mockUserData);
      }
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      if (onSignInFailure) {
        onSignInFailure(error);
      }
    } finally {
      setIsGoogleLoading(false);
      setIsLoading(false);
    }
  };

  const handleGoogleCredentialResponse = (response) => {
    // This callback is kept for backward compatibility with the old GSI button
    // but the new popup flow is preferred
    try {
      const userObject = parseJwt(response.credential);

      const userData = {
        provider: 'google',
        email: userObject.email,
        name: userObject.name,
        picture: userObject.picture,
        sub: userObject.sub,
        loginTime: new Date().toISOString(),
      };

      setUserInfo(userData);
      setIsSignedIn(true);

      sessionStorage.setItem('authUser', JSON.stringify(userData));
      sessionStorage.setItem('authToken', response.credential);

      window.dispatchEvent(new Event('userChanged'));

      if (onSignInSuccess) {
        onSignInSuccess(userData);
      }
    } catch (error) {
      console.error('Error processing Google sign-in:', error);
      if (onSignInFailure) {
        onSignInFailure(error);
      }
    } finally {
      setIsGoogleLoading(false);
      setIsLoading(false);
    }
  };

  const handleMicrosoftSignIn = () => {
    setIsLoading(true);

    const authUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
    const params = new URLSearchParams({
      client_id: MICROSOFT_CLIENT_ID,
      response_type: 'id_token',
      redirect_uri: MICROSOFT_REDIRECT_URI,
      scope: 'openid profile email',
      response_mode: 'fragment',
      state: Math.random().toString(36).substring(7),
      nonce: Math.random().toString(36).substring(7),
    });

    const width = 500;
    const height = 600;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    const popup = window.open(
      `${authUrl}?${params.toString()}`,
      'Microsoft Sign In',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    let popupCheckInterval;

    const handleMessage = (event) => {
      if (!event.origin.includes('microsoft') && event.origin !== window.location.origin) {
        return;
      }

      if (event.data && event.data.type === 'microsoft-auth') {
        cleanupMessageListener();
        if (popup) popup.close();
        clearInterval(popupCheckInterval);
        window.removeEventListener('message', handleMessage);

        if (event.data.success) {
          const userData = event.data.userData;
          setUserInfo(userData);
          setIsSignedIn(true);

          sessionStorage.setItem('authUser', JSON.stringify(userData));
          sessionStorage.setItem('authToken', event.data.token);

          window.dispatchEvent(new Event('userChanged'));

          setIsLoading(false);

          if (onSignInSuccess) {
            onSignInSuccess(userData);
          }
        } else {
          setIsLoading(false);
          if (onSignInFailure) {
            onSignInFailure(new Error(event.data.error || 'Microsoft sign-in failed'));
          }
        }
      }
    };

    const cleanupMessageListener = () => {
      window.removeEventListener('message', handleMessage);
    };

    window.addEventListener('message', handleMessage);

    popupCheckInterval = setInterval(() => {
      if (!popup || popup.closed) {
        clearInterval(popupCheckInterval);
        cleanupMessageListener();
        setIsLoading(false);
      }
    }, 500);
  };

  useEffect(() => {
    if (window.opener) {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const idToken = params.get('id_token');
      const error = params.get('error');

      if (idToken) {
        try {
          const userObject = parseJwt(idToken);

          const userData = {
            provider: 'microsoft',
            email: userObject.email || userObject.preferred_username,
            name: userObject.name,
            picture: null,
            sub: userObject.sub,
            loginTime: new Date().toISOString(),
          };

          window.opener.postMessage({
            type: 'microsoft-auth',
            success: true,
            userData: userData,
            token: idToken,
          }, window.location.origin);

          window.close();
        } catch (err) {
          window.opener.postMessage({
            type: 'microsoft-auth',
            success: false,
            error: 'Failed to process token'
          }, window.location.origin);
          window.close();
        }
      } else if (error) {
        window.opener.postMessage({
          type: 'microsoft-auth',
          success: false,
          error: params.get('error_description') || error
        }, window.location.origin);
        window.close();
      }
    }
  }, []);

  const parseJwt = (token) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error parsing JWT:', error);
      return null;
    }
  };

  const handleSignOut = () => {
    // Use GoogleAuthService for cleanup
    GoogleAuthService.signOut();

    setIsSignedIn(false);
    setUserInfo(null);
    setIsLoading(false);
    setIsGoogleLoading(false);

    sessionStorage.removeItem('authUser');
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('authCode');
    sessionStorage.removeItem('google_oauth_state');

    window.dispatchEvent(new Event('userChanged'));
  };

  useEffect(() => {
    const checkStoredUser = () => {
      const storedUser = sessionStorage.getItem('authUser');
      const storedToken = sessionStorage.getItem('authToken');

      if (storedUser && storedToken) {
        try {
          const userData = JSON.parse(storedUser);

          const loginTime = new Date(userData.loginTime);
          const currentTime = new Date();
          const timeDiff = (currentTime - loginTime) / (1000 * 60 * 60);

          if (timeDiff < 1) {
            setUserInfo(userData);
            setIsSignedIn(true);
          } else {
            sessionStorage.removeItem('authUser');
            sessionStorage.removeItem('authToken');
            setUserInfo(null);
            setIsSignedIn(false);
          }
        } catch (error) {
          console.error('Error loading stored user:', error);
          sessionStorage.removeItem('authUser');
          sessionStorage.removeItem('authToken');
          setUserInfo(null);
          setIsSignedIn(false);
        }
      } else {
        setUserInfo(null);
        setIsSignedIn(false);
        setIsLoading(false);
        setIsGoogleLoading(false);
      }
    };

    checkStoredUser();

    const handleUserChange = () => {
      checkStoredUser();
    };

    window.addEventListener('userChanged', handleUserChange);
    return () => window.removeEventListener('userChanged', handleUserChange);
  }, []);

  if (isLoading && !isSignedIn) {
    return (
      <div className="google-auth-loading">
        <div className="spinner"></div>
        <p>Signing you in...</p>
      </div>
    );
  }

  if (isSignedIn && userInfo) {
    return (
      <div className="google-auth-profile">
        {userInfo.picture && (
          <img src={userInfo.picture} alt="Profile" className="profile-picture" />
        )}
        {!userInfo.picture && (
          <div className="profile-picture" style={{
            backgroundColor: '#667eea',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            fontWeight: 'bold'
          }}>
            {userInfo.name?.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="profile-info">
          <h3>{userInfo.name}</h3>
          <p>{userInfo.email}</p>
          <small className="text-muted">
            Signed in with {userInfo.provider === 'google' ? 'Google' : 'Microsoft'}
          </small>
        </div>
        <button onClick={handleSignOut} className="sign-out-button">
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className="google-auth-container">
      <button
        onClick={handleGoogleSignInClick}
        disabled={isGoogleLoading}
        style={{
          width: '250px',
          padding: '10px 20px',
          backgroundColor: 'white',
          border: '1px solid #dadce0',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          cursor: isGoogleLoading ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: '500',
          transition: 'background-color 0.2s, box-shadow 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          position: 'relative',
          opacity: isGoogleLoading ? 0.7 : 1
        }}
        onMouseEnter={(e) => !isGoogleLoading && (e.currentTarget.style.backgroundColor = '#f8f9fa')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
      >
        {isGoogleLoading ? (
          <div style={{
            width: '18px',
            height: '18px',
            border: '3px solid #f3f3f3',
            borderTop: '3px solid #4285f4',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
        ) : (
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.706c-.18-.54-.282-1.117-.282-1.706 0-.593.102-1.17.282-1.706V4.958H.957C.347 6.173 0 7.548 0 9c0 1.452.348 2.827.957 4.042l3.007-2.336z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
        )}
        <span>{isGoogleLoading ? 'Signing in...' : 'Sign in with Google'}</span>
      </button>

      <div style={{margin: '15px 0', textAlign: 'center', color: '#666'}}>
        <span>or</span>
      </div>

      <button
        onClick={handleMicrosoftSignIn}
        disabled={isLoading}
        style={{
          width: '250px',
          padding: '10px 20px',
          backgroundColor: 'white',
          border: '1px solid #8C8C8C',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: '500',
          transition: 'background-color 0.2s',
          opacity: isLoading ? 0.7 : 1
        }}
        onMouseEnter={(e) => !isLoading && (e.currentTarget.style.backgroundColor = '#f5f5f5')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
      >
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

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Auth;