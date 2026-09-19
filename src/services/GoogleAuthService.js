/**
 * GoogleAuthService - production Google Identity Services integration.
 * Google returns an ID token to the browser; the backend verifies it.
 */
const GOOGLE_CLIENT_ID = '34579317567-tals9olen2trsjfs3gfualbdlfdkki7n.apps.googleusercontent.com';

class GoogleAuthService {
  constructor() {
    this.isInitialized = false;
    this.isInitializing = false;
    this.initPromise = null;
  }

  async loadGoogleScript() {
    if (window.google?.accounts?.id) return window.google;

    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (existing) {
        const check = () => window.google?.accounts?.id ? resolve(window.google) : setTimeout(check, 25);
        check();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => window.google?.accounts?.id
        ? resolve(window.google)
        : reject(new Error('Google Identity Services loaded incorrectly'));
      script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
      document.head.appendChild(script);
    });
  }

  async initialize(callback) {
    if (this.isInitialized) return true;
    if (this.isInitializing) return this.initPromise;

    this.isInitializing = true;
    this.initPromise = (async () => {
      try {
        await this.loadGoogleScript();
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback,
          auto_select: false,
          cancel_on_tap_outside: true,
          use_fedcm_for_prompt: true,
          context: 'signin',
        });
        this.isInitialized = true;
        return true;
      } finally {
        this.isInitializing = false;
      }
    })();

    return this.initPromise;
  }

  renderButton(element, options = {}) {
    if (!window.google?.accounts?.id || !this.isInitialized || !element) return false;
    element.replaceChildren();
    window.google.accounts.id.renderButton(element, {
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      shape: 'rectangular',
      width: 250,
      ...options,
    });
    return true;
  }

  showPrompt() {
    if (window.google?.accounts?.id && this.isInitialized) {
      window.google.accounts.id.prompt();
    }
  }

  signOut() {
    if (window.google?.accounts?.id) window.google.accounts.id.disableAutoSelect();
  }

  cleanup() {
    this.isInitialized = false;
    this.isInitializing = false;
    this.initPromise = null;
  }
}

export { GOOGLE_CLIENT_ID };
export default new GoogleAuthService();
