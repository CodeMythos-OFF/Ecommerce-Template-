/**
 * GoogleAuthService - Centralized Google Sign-In Service
 * Implements singleton pattern to prevent multiple initializations
 * Supports both popup flow and direct callback flow
 */

const GOOGLE_CLIENT_ID = '441853028836-o65ton6djcjdvkdk2n2kpstdj930e4r6.apps.googleusercontent.com';

class GoogleAuthService {
  constructor() {
    this.isInitialized = false;
    this.isInitializing = false;
    this.initPromise = null;
    // Use base URL only (no /auth-callback path) - matches Google Cloud Console registration
    this.redirectUri = window.location.origin;
  }

  /**
   * Load Google GSI script (only once)
   */
  async loadGoogleScript() {
    return new Promise((resolve, reject) => {
      // Check if script already exists
      const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (existingScript) {
        resolve(window.google);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;

      script.onload = () => {
        resolve(window.google);
      };

      script.onerror = () => {
        reject(new Error('Failed to load Google Sign-In script'));
      };

      document.body.appendChild(script);
    });
  }

  /**
   * Initialize Google Sign-In (singleton)
   */
  async initialize(callback) {
    // If already initialized, return immediately
    if (this.isInitialized) {
      return this.isInitialized;
    }

    // If initializing, wait for the promise
    if (this.isInitializing) {
      return this.initPromise;
    }

    this.isInitializing = true;

    this.initPromise = (async () => {
      try {
        await this.loadGoogleScript();

        if (window.google && !this.isInitialized) {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: callback,
            auto_select: false,
            cancel_on_tap_outside: true,
            // Enable FedCM support
            use_fedcm_for_prompt: true,
          });

          window.google.accounts.id.disableAutoSelect();
          this.isInitialized = true;
        }

        return this.isInitialized;
      } catch (error) {
        console.error('Failed to initialize Google Sign-In:', error);
        this.isInitializing = false;
        throw error;
      }
    })();

    await this.initPromise;
    this.isInitializing = false;
    return this.isInitialized;
  }

  /**
   * Start Google OAuth 2.0 flow
   * Redirects to Google's authorization endpoint or opens in popup
   * usePopup: if true, opens in popup; if false, uses main window redirect
   */
  startOAuthFlow(usePopup = true) {
    const state = Math.random().toString(36).substring(7);
    const nonce = Math.random().toString(36).substring(7);

    // Store state in sessionStorage for verification
    sessionStorage.setItem('google_oauth_state', state);
    sessionStorage.setItem('google_oauth_nonce', nonce);

    // Google OAuth 2.0 authorization endpoint
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid profile email',
      state: state,
      nonce: nonce,
      access_type: 'online',
      prompt: 'consent',
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    if (usePopup) {
      const width = 500;
      const height = 600;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      return window.open(
        authUrl,
        'Google Sign In',
        `width=${width},height=${height},left=${left},top=${top}`
      );
    } else {
      // Direct redirect (simpler approach)
      window.location.href = authUrl;
    }
  }

  /**
   * Open Google Sign-In in a popup window
   * This mimics the popup flow similar to GitHub/Microsoft sign-in
   */
  openSignInPopup() {
    return this.startOAuthFlow(true);
  }

  /**
   * Show Google One Tap prompt
   */
  showPrompt(callback) {
    if (window.google && this.isInitialized) {
      window.google.accounts.id.prompt((notification) => {
        callback(notification);
      });
    }
  }

  /**
   * Render button (if needed)
   */
  renderButton(elementId, options = {}) {
    if (window.google && this.isInitialized) {
      window.google.accounts.id.renderButton(
        document.getElementById(elementId),
        {
          theme: 'outline',
          size: 'large',
          width: 250,
          text: 'signin_with',
          shape: 'rectangular',
          ...options,
        }
      );
    }
  }

  /**
   * Sign out
   */
  signOut() {
    if (window.google) {
      window.google.accounts.id.disableAutoSelect();
    }
  }

  /**
   * Cleanup
   */
  cleanup() {
    const script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (script) {
      document.body.removeChild(script);
    }
    this.isInitialized = false;
    this.isInitializing = false;
  }
}

// Export singleton instance
export default new GoogleAuthService();
