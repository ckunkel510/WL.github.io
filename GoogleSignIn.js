// GoogleSignIn.js

// Load when window finishes to ensure all elements are in place
window.addEventListener('load', async function () {
  console.log('[GoogleSignIn] Initializing...');

  const googleButton = document.getElementById('googleSignInButton');
  const usernameInput = document.getElementById('ctl00_PageBody_SignInControl_UserNameTextBox');
  const passwordInput = document.getElementById('ctl00_PageBody_SignInControl_PasswordTextBox');
  const loginForm = document.querySelector('form');

  // Load env token from remote endpoint (from MarketingDashboard backend)
  async function fetchToken() {
    try {
      const response = await fetch('https://https://wlmarketingdashboard.vercel.app/api/google-login-token');
      if (!response.ok) throw new Error('Failed to fetch token');
      const data = await response.json();
      return data.token;
    } catch (err) {
      console.error('[GoogleSignIn] Error fetching token:', err);
      return null;
    }
  }

  // Decode Google JWT token to extract email
  function parseJwt(token) {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json);
  }

  // Callback after successful Google sign-in
  async function handleGoogleCredentialResponse(response) {
    const decoded = parseJwt(response.credential);
    const email = decoded.email;
    console.log('[GoogleSignIn] Google Sign-In successful for:', email);

    const token = await fetchToken();
    if (!token) {
      alert('Unable to complete sign-in. Please try again later.');
      return;
    }

    if (usernameInput && passwordInput) {
      usernameInput.value = email;
      passwordInput.value = token;

      console.log('[GoogleSignIn] Filled username and token. Submitting form...');
      loginForm?.submit();
    } else {
      console.warn('[GoogleSignIn] Username or password field not found.');
    }
  }

  // Initialize Google Identity
  if (googleButton) {
    google.accounts.id.initialize({
      client_id: '573835232997-amdgg0r4fvsn9hi8vf6ndrcpobker9tq.apps.googleusercontent.com',
      callback: handleGoogleCredentialResponse
    });

    googleButton.disabled = false;
    googleButton.style.cursor = 'pointer';
    googleButton.style.opacity = '1';

    googleButton.addEventListener('click', () => {
      console.log('[GoogleSignIn] Prompting Google Sign-In...');
      google.accounts.id.prompt(); // Optional — opens One Tap
    });
  } else {
    console.warn('[GoogleSignIn] Google sign-in button not found.');
  }
});
