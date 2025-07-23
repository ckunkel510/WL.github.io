document.addEventListener('DOMContentLoaded', function () {
  console.log('[EmailValidator] Initializing...');

  const input = document.getElementById('ctl00_PageBody_UserNameTextBox');
  const signupBtn = document.getElementById('ctl00_PageBody_SignupButton');

  if (!input || !signupBtn) {
    console.warn('[EmailValidator] Required elements missing.');
    return;
  }

  // Make input behave like an email field
  input.setAttribute('type', 'email');
  input.setAttribute('required', 'true');
  input.setAttribute('placeholder', 'Enter your email');

  // Create a custom error message element
  const customError = document.createElement('div');
  customError.id = 'customEmailError';
  customError.style.color = 'red';
  customError.style.fontSize = '0.9em';
  customError.style.marginTop = '5px';
  customError.style.display = 'none';

  // Insert the error message element just after the input
  input.parentNode.insertBefore(customError, input.nextSibling);

  // Email regex pattern
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function validateEmail(value) {
    if (!value) return 'Email is required';
    if (!emailPattern.test(value)) return 'Please enter a valid email address';
    return '';
  }

  function updateValidationMessage() {
    const value = input.value.trim();
    const message = validateEmail(value);

    if (message) {
      customError.textContent = message;
      customError.style.display = 'block';
      disableSignup();
      console.warn('[EmailValidator] ' + message);
    } else {
      customError.textContent = '';
      customError.style.display = 'none';
      enableSignup();
      console.log('[EmailValidator] Email valid — Sign Up enabled.');
    }
  }

  function disableSignup() {
    signupBtn.classList.add('disabled');
    signupBtn.style.pointerEvents = 'none';
    signupBtn.style.opacity = '0.5';
  }

  function enableSignup() {
    signupBtn.classList.remove('disabled');
    signupBtn.style.pointerEvents = 'auto';
    signupBtn.style.opacity = '1';
  }

  // Validate on page load (in case of prefilled input)
  updateValidationMessage();

  // Validate live
  input.addEventListener('input', updateValidationMessage);

  // Prevent click if not valid
  signupBtn.addEventListener('click', function (e) {
    const message = validateEmail(input.value.trim());
    if (message) {
      e.preventDefault();
      updateValidationMessage();
      console.warn('[EmailValidator] Blocking Sign Up due to invalid email.');
    }
  });
});