(function () {
  console.log("[Marketing Opt-In] Script loaded");

  const waitForElement = (selector, callback) => {
    const el = document.querySelector(selector);
    if (el) return callback(el);
    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        callback(el);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  };

  waitForElement('#ctl00_PageBody_SignupButton', (signupBtn) => {
    const checkboxContainer = document.createElement('div');
    checkboxContainer.className = 'epi-form-group-signup2';
    checkboxContainer.innerHTML = `
      <label style="display: flex; align-items: flex-start; margin-bottom: 10px;">
        <input type="checkbox" id="signupEmailMarketing" style="margin-top: 4px; margin-right: 8px;">
        <span>
          I want to receive Woodson Lumber email promotions and updates.<br>
          <small>
            You can unsubscribe at any time. View our
            <a href="https://webtrack.woodsonlumber.com/PrivacyPolicy.aspx" target="_blank">Privacy Policy</a>.
          </small>
        </span>
      </label>
      <label style="display: flex; align-items: flex-start;">
        <input type="checkbox" id="signupTextMarketing" style="margin-top: 4px; margin-right: 8px;">
        <span>
          I want to receive text message updates and offers from Woodson Lumber.<br>
          <small>
            Message and data rates may apply. View our
            <a href="https://webtrack.woodsonlumber.com/PrivacyPolicy.aspx" target="_blank">Privacy Policy</a>.
          </small>
        </span>
      </label>
    `;

    // Insert checkboxes just above the sign-up button
    signupBtn.parentElement.insertBefore(checkboxContainer, signupBtn);

    // Add listener
    signupBtn.addEventListener('click', () => {
      const emailOptIn = document.getElementById("signupEmailMarketing")?.checked;
      const smsOptIn = document.getElementById("signupTextMarketing")?.checked;

      if (emailOptIn || smsOptIn) {
        const email = document.getElementById("ctl00_PageBody_EmailAddressTextBox")?.value || '';
        const firstName = document.getElementById("ctl00_PageBody_FirstNameTextBox")?.value || '';
        const lastName = document.getElementById("ctl00_PageBody_LastNameTextBox")?.value || '';
        const phone = document.getElementById("ctl00_PageBody_ContactTelephoneTextBox")?.value || '';

        const payload = {
          email_address: email,
          first_name: firstName,
          last_name: lastName,
          phone_number: phone,
          lists: [], // Replace with Constant Contact list IDs as needed
          custom_fields: {
            email_opt_in: emailOptIn,
            sms_opt_in: smsOptIn
          }
        };

        fetch("https://script.google.com/macros/s/AKfycbyC0Rxsu2QeGA5wIns8aW-p4Et9SeHZ9IA2VUFyS5g4J-35XhgA0nHezCJjjy0rpk8jcw/exec", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    action: "signup_optin",
    email_address: email,
    first_name: firstName,
    last_name: lastName,
    phone_number: phone,
    custom_fields: {
      email_opt_in: emailOptIn,
      sms_opt_in: smsOptIn
    }
  })
})

      }
    });
  });
})();
