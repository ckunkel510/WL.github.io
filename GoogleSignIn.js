(function () {
  console.log('[GoogleSignIn] Script loaded');

  const GOOGLE_CLIENT_ID = '573835232997-amdgg0r4fvsn9hi8vf6ndrcpobker9tq.apps.googleusercontent.com';
  const TOKEN_API_URL = 'https://wlmarketingdashboard.vercel.app/api/google-login-token';

  // 1. Load Google Identity SDK
  const sdk = document.createElement('script');
  sdk.src = 'https://accounts.google.com/gsi/client';
  sdk.async = true;
  sdk.defer = true;
  sdk.onload = initGoogleSignIn;
  document.head.appendChild(sdk);
  console.log('[GoogleSignIn] Google SDK injected');

  // 2. Insert Google Sign-In button after "Forgot your password?"
  document.addEventListener('DOMContentLoaded', function () {
    console.log('[GoogleSignIn] DOM ready — looking for ResetPassword link');

    const forgotLink = document.querySelector('a[href="ResetPassword.aspx"]');
    if (!forgotLink) {
      console.warn('[GoogleSignIn] Forgot password link not found — cannot insert button.');
      return;
    }

    const container = document.createElement('div');
    container.style.marginTop = '15px';

    const googleButton = document.createElement('button');
    googleButton.id = 'googleSignInButton';
    googleButton.textContent = 'Sign in with Google';
    googleButton.disabled = true;
    googleButton.style.background = '#fff';
    googleButton.style.color = '#444';
    googleButton.style.border = '1px solid #ccc';
    googleButton.style.padding = '10px 20px';
    googleButton.style.fontSize = '14px';
    googleButton.style.borderRadius = '4px';
    googleButton.style.cursor = 'not-allowed';
    googleButton.style.opacity = '0.5';
    googleButton.style.width = '100%';
    googleButton.style.display = 'block';

    const comingSoon = document.createElement('div');
    comingSoon.textContent = 'Google Sign-In Loading...';
    comingSoon.style.fontSize = '12px';
    comingSoon.style.color = '#999';
    comingSoon.style.textAlign = 'center';
    comingSoon.style.marginTop = '5px';
    comingSoon.id = 'googleSignInStatus';

    container.appendChild(googleButton);
    container.appendChild(comingSoon);
    forgotLink.parentNode.insertBefore(container, forgotLink.nextSibling);

    console.log('[GoogleSignIn] Google Sign-In button inserted and awaiting SDK');
  });

  // 3. Init Google Sign-In
  function initGoogleSignIn() {
    console.log('[GoogleSignIn] Google SDK ready — initializing');

    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredentialResponse
    });

    const btn = document.getElementById('googleSignInButton');
    const status = document.getElementById('googleSignInStatus');

    if (btn) {
      btn.disabled = false;
      btn.style.cursor = 'pointer';
      btn.style.opacity = '1';
      if (status) status.textContent = 'Google Sign-In Ready';

      btn.addEventListener('click', function () {
        console.log('[GoogleSignIn] Prompting Google login...');
        google.accounts.id.prompt(); // popup login
      });
    } else {
      console.error('[GoogleSignIn] Google Sign-In button not found during init.');
    }
  }

  // 4. Handle Google Login Response
  async function handleGoogleCredentialResponse(response) {
    console.log('[GoogleSignIn] Google credential received');
    let email = null;

    try {
      const decoded = parseJwt(response.credential);
      email = decoded.email;
      console.log('[GoogleSignIn] Parsed email:', email);
    } catch (err) {
      console.error('[GoogleSignIn] Failed to parse JWT:', err);
      alert('Error during login — could not verify email.');
      return;
    }

    const token = await fetchToken();
    if (!token) {
      alert('Unable to log in. Token missing or invalid.');
      return;
    }

    const usernameInput = document.getElementById('ctl00_PageBody_SignInControl_UserNameTextBox');
    const passwordInput = document.getElementById('ctl00_PageBody_SignInControl_PasswordTextBox');
    const loginForm = document.querySelector('form');

    if (usernameInput && passwordInput) {
      console.log('[GoogleSignIn] Filling in credentials and submitting form');
      usernameInput.value = email;
      passwordInput.value = token;
      loginForm.submit();
    } else {
      console.error('[GoogleSignIn] Username or password input not found.');
    }
  }

  // 5. Parse JWT to extract email
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

  // 6. Fetch login token from secure Vercel backend
  async function fetchToken() {
    console.log('[GoogleSignIn] Fetching login token from:', TOKEN_API_URL);
    try {
      const res = await fetch(TOKEN_API_URL);
      if (!res.ok) throw new Error(`Response status: ${res.status}`);
      const data = await res.json();
      console.log('[GoogleSignIn] Token retrieved successfully');
      return data.token;
    } catch (err) {
      console.error('[GoogleSignIn] Error fetching login token:', err);
      return null;
    }
  }
})();
