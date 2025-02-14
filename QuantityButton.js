document.addEventListener('DOMContentLoaded', function() {
  // Select all inputs whose id starts with the known prefix
  var inputs = document.querySelectorAll("input[id^='ctl00_PageBody_productDetail_ctl00_qty_']");

  inputs.forEach(function(input) {
    // Create a wrapper div to hold the buttons and the input
    var wrapper = document.createElement('div');
    wrapper.className = "quantity-wrapper";
    
    // Insert the wrapper into the DOM in place of the input
    input.parentNode.insertBefore(wrapper, input);
    // Move the input into the wrapper
    wrapper.appendChild(input);
    
    // Create the decrease (–) button
    var minusBtn = document.createElement('button');
    minusBtn.type = "button"; // Prevent accidental form submissions
    minusBtn.className = "quantity-btn decrease";
    minusBtn.textContent = "-";
    
    // Create the increase (+) button
    var plusBtn = document.createElement('button');
    plusBtn.type = "button"; // Prevent accidental form submissions
    plusBtn.className = "quantity-btn increase";
    plusBtn.textContent = "+";
    
    // Insert the buttons in the wrapper: minus before, plus after the input
    wrapper.insertBefore(minusBtn, input);
    wrapper.appendChild(plusBtn);
    
    // Attach event listener to the minus button
    minusBtn.addEventListener('click', function() {
      var currentValue = parseInt(input.value, 10) || 1;
      // Optionally prevent values below 1
      if (currentValue > 1) {
        input.value = currentValue - 1;
      }
    });
    
    // Attach event listener to the plus button
    plusBtn.addEventListener('click', function() {
      var currentValue = parseInt(input.value, 10) || 1;
      input.value = currentValue + 1;
    });
  });
});
