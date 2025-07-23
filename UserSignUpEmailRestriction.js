
document.addEventListener('DOMContentLoaded', function () {
  console.log('[EmailValidator] DOM loaded');

  const input = document.getElementById('ctl00_PageBody_UserNameTextBox');
  const validator = document.getElementById('ctl00_PageBody_UserNameValidator');
  const errorMessageDiv = validator?.querySelector('.errorMessage');

  if (!input || !validator || !errorMessageDiv) {
    console.warn('[EmailValidator] Missing elements. Input or validator not found.');
    return;
  }

  // Save original message so we can restore it
  const originalMessage = errorMessageDiv.textContent;

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function validateEmailLive() {
    const value = input.value.trim();
    const isValid = emailPattern.test(value);

    if (!value) {
      validator.style.display = 'block';
      errorMessageDiv.textContent = 'Email is required';
      console.warn('[EmailValidator] Empty field — showing required.');
    } else if (!isValid) {
      validator.style.display = 'block';
      errorMessageDiv.textContent = 'Please enter a valid email address';
      console.warn('[EmailValidator] Invalid email — showing message.');
    } else {
      validator.style.display = 'none';
      errorMessageDiv.textContent = originalMessage;
      console.log('[EmailValidator] Email valid — hiding error.');
    }
  }

  // Convert to email field for native validation fallback
  input.setAttribute('type', 'email');
  input.setAttribute('required', 'true');
  input.setAttribute('placeholder', 'Enter your email');

  // Live validation
  input.addEventListener('input', validateEmailLive);

  // Re-validate on form submit as a fallback
  input.form.addEventListener('submit', function (e) {
    if (!emailPattern.test(input.value)) {
      e.preventDefault();
      validateEmailLive();
    }
  });

  console.log('[EmailValidator] Script initialized.');
});
