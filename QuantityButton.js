document.addEventListener('DOMContentLoaded', function() {
  // Select all quantity inputs based on the known ID prefix
  var inputs = document.querySelectorAll("input[id^='ctl00_PageBody_productDetail_ctl00_qty_']");
  
  inputs.forEach(function(input) {
    // Create the decrease (–) button
    var minusBtn = document.createElement('button');
    minusBtn.type = 'button'; // Avoid form submission
    minusBtn.className = 'quantity-btn decrease';
    minusBtn.textContent = '-';
    
    // Create the increase (+) button
    var plusBtn = document.createElement('button');
    plusBtn.type = 'button'; // Avoid form submission
    plusBtn.className = 'quantity-btn increase';
    plusBtn.textContent = '+';
    
    // Insert the minus button before the input
    input.parentNode.insertBefore(minusBtn, input);
    
    // Insert the plus button after the input
    if (input.nextSibling) {
      input.parentNode.insertBefore(plusBtn, input.nextSibling);
    } else {
      input.parentNode.appendChild(plusBtn);
    }
    
    // Event listener for the minus button
    minusBtn.addEventListener('click', function() {
      var currentValue = parseInt(input.value, 10) || 1;
      if (currentValue > 1) {
        input.value = currentValue - 1;
      }
    });
    
    // Event listener for the plus button
    plusBtn.addEventListener('click', function() {
      var currentValue = parseInt(input.value, 10) || 1;
      input.value = currentValue + 1;
    });
  });
});
