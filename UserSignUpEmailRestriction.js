document.addEventListener('DOMContentLoaded', function () {
  console.log('[EmailValidator] DOM fully loaded.');

  const input = document.getElementById('ctl00_PageBody_UserNameTextBox');
  if (!input) {
    console.warn('[EmailValidator] Username input field not found.');
    return;
  }

  console.log('[EmailValidator] Found input field:', input);

  // Change input type to email for browser-level validation
  input.setAttribute('type', 'email');
  input.setAttribute('required', 'true');
  input.setAttribute('placeholder', 'Enter your email');
  console.log('[EmailValidator] Set input type to email, required, and placeholder.');

  // Optional fallback in case HTML5 validation is bypassed
  if (!input.form) {
    console.warn('[EmailValidator] No form associated with the input field.');
    return;
  }

  input.form.addEventListener('submit', function (e) {
    console.log('[EmailValidator] Form submission triggered.');

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const email = input.value;
    console.log('[EmailValidator] Email entered:', email);

    if (!emailPattern.test(email)) {
      e.preventDefault();
      console.warn('[EmailValidator] Invalid email address. Blocking submission.');
      alert('Please enter a valid email address.');
    } else {
      console.log('[EmailValidator] Email validated successfully.');
    }
  });
});