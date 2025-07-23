
document.addEventListener('DOMContentLoaded', function () {
  const input = document.getElementById('ctl00_PageBody_UserNameTextBox');
  
  // Change input type to email for browser-level validation
  input.setAttribute('type', 'email');
  input.setAttribute('required', 'true');
  input.setAttribute('placeholder', 'Enter your email');
  
  // Optional fallback in case HTML5 validation is bypassed
  input.form.addEventListener('submit', function (e) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(input.value)) {
      e.preventDefault();
      alert('Please enter a valid email address.');
    }
  });
});

