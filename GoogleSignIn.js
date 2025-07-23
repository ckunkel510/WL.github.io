(function () {
  console.log('[GoogleSignIn] Script loaded');

  const GOOGLE_CLIENT_ID = '573835232997-amdgg0r4fvsn9hi8vf6ndrcpobker9tq.apps.googleusercontent.com';
  const TOKEN_API_URL = 'https://wlmarketingdashboard.vercel.app/api/google-login-token';

  // Insert the Google Sign-In button now
  function insertGoogleButton() {
  console.log('[GoogleSignIn] Attempting to insert Google Sign-In button...');

  const signInBtn = document.getElementById('ctl00_PageBody_SignInControl_SignInButton');
  if (!signInBtn) {
    console.warn('[GoogleSignIn] Sign In button not found — cannot insert button.');
    return false;
  }

  if (document.getElementById('googleSignInDiv')) {
    console.log('[GoogleSignIn] Button already exists.');
    return true;
  }

  const container = document.createElement('div');
  container.id = 'googleSignInDiv';
  container.style.marginTop = '15px';

  signInBtn.parentNode.insertBefore(container, signInBtn.nextSibling);

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
  console.log('[GoogleSignIn] Fetching token from:', TOKEN_API_URL);
  try {
    const res = await fetch(TOKEN_API_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    console.log('[GoogleSignIn] Fetch response received:', res);

    if (!res.ok) {
      console.error('[GoogleSignIn] Bad response status:', res.status);
      throw new Error(`Bad status: ${res.status}`);
    }

    const data = await res.json();
    console.log('[GoogleSignIn] Parsed token response:', data);
    return data.token;
  } catch (err) {
    console.error('[GoogleSignIn] Failed to fetch token:', err);
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
  console.log('[GoogleSignIn] 🛂 Token being used as password:', token);

  const usernameInput = document.getElementById('ctl00_PageBody_SignInControl_UserNameTextBox');
  const passwordInput = document.getElementById('ctl00_PageBody_SignInControl_PasswordTextBox');
  const signInButton = document.getElementById('ctl00_PageBody_SignInControl_SignInButton');

  if (usernameInput && passwordInput && signInButton) {
    usernameInput.value = email;
    passwordInput.value = token;
    console.log('[GoogleSignIn] ✅ Credentials set in input fields.');

    setTimeout(() => {
      console.log('[GoogleSignIn] 🚀 Attempting __doPostBack login...');
      try {
        __doPostBack('ctl00$PageBody$SignInControl$SignInButton', '');
      } catch (err) {
        console.error('[GoogleSignIn] ❌ __doPostBack failed:', err);
      }
    }, 1000);
  } else {
    console.error('[GoogleSignIn] ❌ Required fields not found.');
  }
}







  // Initialize Google SDK once it's loaded
  function initGoogleSignIn() {
  console.log('[GoogleSignIn] SDK ready — initializing Google login');

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleGoogleCredentialResponse
  });

  // Render the official button
  google.accounts.id.renderButton(
    document.getElementById('googleSignInDiv'),
    {
      theme: 'outline',
      size: 'large',
      width: 300,
    }
  );

  // Optional: also enable One Tap
  // google.accounts.id.prompt();
}


  // MAIN EXECUTION
  const inserted = insertGoogleButton();
if (!inserted) {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[GoogleSignIn] Retrying button insertion after DOM ready...');
    insertGoogleButton();
  });
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
