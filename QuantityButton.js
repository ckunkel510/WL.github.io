window.onload = function() {
  var inputs = document.querySelectorAll("input[id^='ctl00_PageBody_productDetail_ctl00_qty_']");
  console.log('Found quantity inputs:', inputs);
  
  inputs.forEach(function(input) {
    // Debug: Log each input we're processing.
    console.log('Processing input:', input);
    
    // Create the buttons
    var minusBtn = document.createElement('button');
    minusBtn.type = 'button';
    minusBtn.className = 'quantity-btn decrease';
    minusBtn.textContent = '-';
    
    var plusBtn = document.createElement('button');
    plusBtn.type = 'button';
    plusBtn.className = 'quantity-btn increase';
    plusBtn.textContent = '+';
    
    // Insert buttons before and after the input
    input.parentNode.insertBefore(minusBtn, input);
    if (input.nextSibling) {
      input.parentNode.insertBefore(plusBtn, input.nextSibling);
    } else {
      input.parentNode.appendChild(plusBtn);
    }
    
    // Attach event listeners
    minusBtn.addEventListener('click', function() {
      var currentValue = parseInt(input.value, 10) || 1;
      if (currentValue > 1) {
        input.value = currentValue - 1;
      }
    });
    
    plusBtn.addEventListener('click', function() {
      var currentValue = parseInt(input.value, 10) || 1;
      input.value = currentValue + 1;
    });
  });
};
