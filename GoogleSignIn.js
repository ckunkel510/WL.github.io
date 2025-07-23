(function () {
  console.log('[GoogleSignIn] Script loaded');

  const GOOGLE_CLIENT_ID = '573835232997-amdgg0r4fvsn9hi8vf6ndrcpobker9tq.apps.googleusercontent.com';
  const TOKEN_API_URL = 'https://wlmarketingdashboard.vercel.app/api/google-login-token';

  // Insert the Google Sign-In button now
  function insertGoogleButton() {
    console.log('[GoogleSignIn] Attempting to insert Google Sign-In button...');

    const forgotLink = document.querySelector('a[href="ResetPassword.aspx"]');
    if (!forgotLink) {
      console.warn('[GoogleSignIn] Forgot password link not found — cannot insert button.');
      return false;
    }

    if (document.getElementById('googleSignInButton')) {
      console.log('[GoogleSignIn] Button already exists.');
      return true;
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
    comingSoon.id = 'googleSignInStatus';
    comingSoon.style.fontSize = '12px';
    comingSoon.style.color = '#999';
    comingSoon.style.textAlign = 'center';
    comingSoon.style.marginTop = '5px';

    container.appendChild(googleButton);
    container.appendChild(comingSoon);
    forgotLink.parentNode.insertBefore(container, forgotLink.nextSibling);

    console.log('[GoogleSignIn] Google Sign-In button injected.');
    return true;
  }

  // Decode JWT token
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

  // Fetch token from backend
  // Fetch token from backend
async function fetchToken() {
  console.log('[GoogleSignIn] 🟡 fetchToken() called — attempting to retrieve from:', TOKEN_API_URL);
  try {
    const res = await fetch(TOKEN_API_URL);
    console.log('[GoogleSignIn] 🔵 fetch() response status:', res.status);
    if (!res.ok) {
      const errText = await res.text();
      console.error('[GoogleSignIn] 🔴 Response body (non-OK):', errText);
      throw new Error(`Fetch failed with status ${res.status}`);
    }
    const data = await res.json();
    console.log('[GoogleSignIn] ✅ Token JSON received:', data);
    return data.token;
  } catch (err) {
    console.error('[GoogleSignIn] ❌ fetchToken failed:', err);
    return null;
  }
}


  // Handle Google login
  // Handle Google login
async function handleGoogleCredentialResponse(response) {
  console.log('[GoogleSignIn] ⚡ Google credential callback triggered');

  if (!response || !response.credential) {
    console.error('[GoogleSignIn] ❌ No credential received from Google');
    return;
  }

  let email;
  try {
    const decoded = parseJwt(response.credential);
    email = decoded.email;
    console.log('[GoogleSignIn] ✅ Parsed email from credential:', email);
  } catch (err) {
    console.error('[GoogleSignIn] ❌ Failed to decode Google JWT:', err);
    alert('Invalid login. Please try again.');
    return;
  }

  console.log('[GoogleSignIn] 📬 Requesting secure token from Vercel API...');
  const token = await fetchToken();

  if (!token) {
    console.error('[GoogleSignIn] ❌ Token fetch returned null');
    alert('Could not log in. Please try again later.');
    return;
  }

  console.log('[GoogleSignIn] 🟢 Token received. Proceeding with login.');

  const usernameInput = document.getElementById('ctl00_PageBody_SignInControl_UserNameTextBox');
  const passwordInput = document.getElementById('ctl00_PageBody_SignInControl_PasswordTextBox');
  const loginForm = document.querySelector('form');

  if (usernameInput && passwordInput && loginForm) {
    usernameInput.value = email;
    passwordInput.value = token;
    console.log('[GoogleSignIn] ✅ Credentials set. Submitting form.');
    loginForm.submit();
  } else {
    console.error('[GoogleSignIn] ❌ Could not find form inputs.');
  }
}


  // Initialize Google SDK once it's loaded
  function initGoogleSignIn() {
    console.log('[GoogleSignIn] SDK ready — initializing Google login');

    const googleButton = document.getElementById('googleSignInButton');
    const status = document.getElementById('googleSignInStatus');

    if (!googleButton) {
      console.error('[GoogleSignIn] Button not found at init. Aborting.');
      return;
    }

    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredentialResponse
    });

    googleButton.disabled = false;
    googleButton.style.opacity = '1';
    googleButton.style.cursor = 'pointer';
    if (status) status.textContent = 'Google Sign-In Ready';

    googleButton.addEventListener('click', () => {
      console.log('[GoogleSignIn] Prompting Google sign-in...');
      google.accounts.id.prompt();
    });
  }

  // MAIN EXECUTION
  const inserted = insertGoogleButton();
  if (!inserted) {
    // DOM may not be ready yet
    document.addEventListener('DOMContentLoaded', insertGoogleButton);
  }

  // Inject the Google SDK and bind the init function to its onload
  const sdk = document.createElement('script');
  sdk.src = 'https://accounts.google.com/gsi/client';
  sdk.async = true;
  sdk.defer = true;
  sdk.onload = initGoogleSignIn;
  document.head.appendChild(sdk);
  console.log('[GoogleSignIn] Google SDK requested.');
})();
