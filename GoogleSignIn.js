
// Run after DOM load
document.addEventListener('DOMContentLoaded', function () {
  console.log('[3rdPartyLogin] Initializing Google Sign-In placeholder...');

  const forgotLink = document.querySelector('a[href="ResetPassword.aspx"]');
  if (!forgotLink) {
    console.warn('[3rdPartyLogin] Forgot password link not found.');
    return;
  }

  // Create wrapper container
  const container = document.createElement('div');
  container.style.marginTop = '15px';

  // Create disabled Google Sign-In button
  const googleButton = document.createElement('button');
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

  // Coming Soon label
  const comingSoon = document.createElement('div');
  comingSoon.textContent = 'Google Sign-In Coming Soon';
  comingSoon.style.fontSize = '12px';
  comingSoon.style.color = '#999';
  comingSoon.style.textAlign = 'center';
  comingSoon.style.marginTop = '5px';

  container.appendChild(googleButton);
  container.appendChild(comingSoon);

  // Insert it after the "Forgot your password?" link
  forgotLink.parentNode.insertBefore(container, forgotLink.nextSibling);

  console.log('[3rdPartyLogin] Google Sign-In placeholder inserted (disabled).');
});

