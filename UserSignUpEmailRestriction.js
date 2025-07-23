document.addEventListener('DOMContentLoaded', function () {
  console.log('[EmailValidator] Initializing...');

  const input = document.getElementById('ctl00_PageBody_UserNameTextBox');
  if (!input) {
    console.warn('[EmailValidator] Input not found.');
    return;
  }

  // Change input to type email for native browser validation
  input.setAttribute('type', 'email');
  input.setAttribute('required', 'true');
  input.setAttribute('placeholder', 'Enter your email');

  // Create custom error message element
  const customError = document.createElement('div');
  customError.id = 'customEmailError';
  customError.style.color = 'red';
  customError.style.fontSize = '0.9em';
  customError.style.marginTop = '5px';
  customError.style.display = 'none';

  // Insert after input
  input.parentNode.insertBefore(customError, input.nextSibling);

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
      console.warn('[EmailValidator] ' + message);
    } else {
      customError.textContent = '';
      customError.style.display = 'none';
      console.log('[EmailValidator] Email looks good.');
    }
  }

  // Validate immediately on page load in case there's a prefilled value
  updateValidationMessage();

  // Validate on input change
  input.addEventListener('input', updateValidationMessage);

  // Also validate on form submission
  if (input.form) {
    input.form.addEventListener('submit', function (e) {
      const value = input.value.trim();
      const message = validateEmail(value);
      if (message) {
        e.preventDefault();
        updateValidationMessage();
      }
    });
  }
});