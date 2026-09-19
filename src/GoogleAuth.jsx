import React, { useState, useEffect } from 'react';
import './GoogleAuth.css';

// Google OAuth Configuration
const GOOGLE_CLIENT_ID = '441853028836-o65ton6djcjdvkdk2n2kpstdj930e4r6.apps.googleusercontent.com';

const GoogleAuth = ({ onSignInSuccess, onSignInFailure }) => {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Load Google Sign-In script
    const loadGoogleScript = () => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initializeGoogleSignIn;
      document.body.appendChild(script);
    };

    loadGoogleScript();

    return () => {
      // Cleanup
      const script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (script) {
        document.body.removeChild(script);
      }
    };
  }, []);

  const initializeGoogleSignIn = () => {
    if (window.google) {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      // Render the Google Sign-In button
      window.google.accounts.id.renderButton(
        document.getElementById('googleSignInButton'),
        {
          theme: 'outline',
          size: 'large',
          width: 250,
          text: 'signin_with',
          shape: 'rectangular',
        }
      );
    }
  };

  const handleCredentialResponse = (response) => {
    setIsLoading(true);
    
    try {
      // Decode JWT token to get user info
      const userObject = parseJwt(response.credential);
      
      const userData = {
        email: userObject.email,
        name: userObject.name,
        picture: userObject.picture,
        sub: userObject.sub, // Google user ID
        loginTime: new Date().toISOString(),
      };

      setUserInfo(userData);
      setIsSignedIn(true);
      
      // Store user info in sessionStorage (more secure than localStorage)
      // Data is cleared when browser/tab is closed
      sessionStorage.setItem('googleUser', JSON.stringify(userData));
      sessionStorage.setItem('authToken', response.credential);
      
      // Notify Navigation component about user change
      window.dispatchEvent(new Event('userChanged'));
      
      // Call success callback
      if (onSignInSuccess) {
        onSignInSuccess(userData);
      }
    } catch (error) {
      console.error('Error processing sign-in:', error);
      if (onSignInFailure) {
        onSignInFailure(error);
      }
    } finally {
      setIsLoading(false);
    }
  };

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
    if (window.google) {
      window.google.accounts.id.disableAutoSelect();
    }
    
    setIsSignedIn(false);
    setUserInfo(null);
    
    // Clear session data
    sessionStorage.removeItem('googleUser');
    sessionStorage.removeItem('authToken');
    
    // Notify Navigation component about user change
    window.dispatchEvent(new Event('userChanged'));
    
    // Reload to reinitialize Google Sign-In
    window.location.reload();
  };

  // Check if user is already signed in from sessionStorage
  useEffect(() => {
    const storedUser = sessionStorage.getItem('googleUser');
    const storedToken = sessionStorage.getItem('authToken');
    
    if (storedUser && storedToken) {
      try {
        const userData = JSON.parse(storedUser);
        
        // Optional: Check if session is still valid (e.g., within 1 hour)
        const loginTime = new Date(userData.loginTime);
        const currentTime = new Date();
        const timeDiff = (currentTime - loginTime) / (1000 * 60 * 60); // hours
        
        if (timeDiff < 1) {
          setUserInfo(userData);
          setIsSignedIn(true);
        } else {
          // Session expired, clear storage
          sessionStorage.removeItem('googleUser');
          sessionStorage.removeItem('authToken');
        }
      } catch (error) {
        console.error('Error loading stored user:', error);
        sessionStorage.removeItem('googleUser');
        sessionStorage.removeItem('authToken');
      }
    }
  }, []);

  // Security: Clear session on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Optional: You can add logic here if needed
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  if (isLoading) {
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
        <img src={userInfo.picture} alt="Profile" className="profile-picture" />
        <div className="profile-info">
          <h3>{userInfo.name}</h3>
          <p>{userInfo.email}</p>
          <small className="text-muted">Session expires when browser closes</small>
        </div>
        <button onClick={handleSignOut} className="sign-out-button">
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className="google-auth-container">
      <div id="googleSignInButton"></div>
      <p className="google-auth-disclaimer">
        By signing in, you agree to our Terms of Service and Privacy Policy
      </p>
      <p className="google-auth-security">
        <small>
          🔒 Secure session - automatically expires when you close your browser
        </small>
      </p>
    </div>
  );
};

export default GoogleAuth;
