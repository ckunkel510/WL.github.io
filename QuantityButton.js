window.onload = function() {
  // Select inputs matching:
  // - IDs beginning with "ctl00_PageBody_productDetail_ctl00_qty_"
  // - OR IDs containing both "ProductListView" and "ProductQuantity"
  var inputs = document.querySelectorAll(
    "input[id^='ctl00_PageBody_productDetail_ctl00_qty_'], input[id*='ProductListView'][id*='ProductQuantity']"
  );
  
  inputs.forEach(function(input) {
    // Check if we've already processed this input
    if (input.dataset.processedQuantityButtons === "true") return;
    input.dataset.processedQuantityButtons = "true";
    
    // Set the default value to "1"
    input.value = "1";
    
    // Create a wrapper for the input and buttons.
    var wrapper = document.createElement('div');
    // Inline styling for the wrapper.
    wrapper.style.display = 'inline-flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.border = '1px solid #6b0016'; // Example border color.
    wrapper.style.borderRadius = '4px';
    wrapper.style.overflow = 'hidden';
    
    // Insert the wrapper into the DOM before the input,
    // then move the input into the wrapper.
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);
    
    // Apply inline styling to the input.
    input.style.width = '50px';
    input.style.textAlign = 'center';
    input.style.border = 'none';
    input.style.padding = '5px';
    input.style.fontSize = '16px';
    
    // Create the decrease (–) button.
    var minusBtn = document.createElement('button');
    minusBtn.type = 'button';  // Prevent form submission.
    minusBtn.textContent = '-';
    // Inline styling for the minus button.
    minusBtn.style.width = '30px';
    minusBtn.style.height = '30px';
    minusBtn.style.backgroundColor = '#6b0016';
    minusBtn.style.color = '#fff';
    minusBtn.style.border = 'none';
    minusBtn.style.fontSize = '16px';
    minusBtn.style.cursor = 'pointer';
    minusBtn.style.display = 'flex';
    minusBtn.style.alignItems = 'center';
    minusBtn.style.justifyContent = 'center';
    minusBtn.style.marginRight = '5px';
    
    // Create the increase (+) button.
    var plusBtn = document.createElement('button');
    plusBtn.type = 'button';
    plusBtn.textContent = '+';
    // Inline styling for the plus button.
    plusBtn.style.width = '30px';
    plusBtn.style.height = '30px';
    plusBtn.style.backgroundColor = '#6b0016';
    plusBtn.style.color = '#fff';
    plusBtn.style.border = 'none';
    plusBtn.style.fontSize = '16px';
    plusBtn.style.cursor = 'pointer';
    plusBtn.style.display = 'flex';
    plusBtn.style.alignItems = 'center';
    plusBtn.style.justifyContent = 'center';
    plusBtn.style.marginLeft = '5px';
    
    // Insert the buttons: minus before, plus after the input.
    wrapper.insertBefore(minusBtn, input);
    wrapper.appendChild(plusBtn);
    
    // Event listener for decreasing the value.
    minusBtn.addEventListener('click', function() {
      var currentValue = parseInt(input.value, 10) || 1;
      if (currentValue > 1) {
        input.value = currentValue - 1;
      }
    });
    
    // Event listener for increasing the value.
    plusBtn.addEventListener('click', function() {
      var currentValue = parseInt(input.value, 10) || 1;
      input.value = currentValue + 1;
    });
  });
};
