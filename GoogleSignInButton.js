(function () {
  console.log('[GoogleSignIn] Script loaded');

  // 1. Dynamically load Google Identity SDK
  const sdk = document.createElement('script');
  sdk.src = 'https://accounts.google.com/gsi/client';
  sdk.async = true;
  sdk.defer = true;
  document.head.appendChild(sdk);
  console.log('[GoogleSignIn] Google SDK requested');

  // 2. Wait for DOMContentLoaded before injecting button
  document.addEventListener('DOMContentLoaded', function () {
    console.log('[GoogleSignIn] DOM ready, attempting to insert button');

    const forgotLink = document.querySelector('a[href="ResetPassword.aspx"]');
    if (!forgotLink) {
      console.warn('[GoogleSignIn] Forgot password link not found.');
      return;
    }

    // 3. Create wrapper
    const container = document.createElement('div');
    container.style.marginTop = '15px';

    // 4. Create disabled Google button
    const googleButton = document.createElement('button');
    googleButton.id = 'googleSignInButton';
    googleButton.textContent = 'Sign in with Google';
    googleButton.disabled = true;
    googleButton.style.background = '#ffffff';
    googleButton.style.color = '#757575';
    googleButton.style.border = '1px solid #ccc';
    googleButton.style.padding = '10px 20px';
    googleButton.style.fontSize = '14px';
    googleButton.style.borderRadius = '4px';
    googleButton.style.cursor = 'not-allowed';
    googleButton.style.opacity = '0.5';
    googleButton.style.width = '100%';
    googleButton.style.display = 'block';

    // 5. Coming soon label
    const comingSoon = document.createElement('div');
    comingSoon.textContent = 'Google Sign-In Coming Soon';
    comingSoon.style.fontSize = '12px';
    comingSoon.style.color = '#999';
    comingSoon.style.textAlign = 'center';
    comingSoon.style.marginTop = '5px';

    // 6. Assemble and insert
    container.appendChild(googleButton);
    container.appendChild(comingSoon);
    forgotLink.parentNode.insertBefore(container, forgotLink.nextSibling);

    console.log('[GoogleSignIn] Placeholder inserted');
  });
})();
