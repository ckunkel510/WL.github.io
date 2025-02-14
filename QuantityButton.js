window.onload = function() {
  // Select inputs matching:
  // - IDs beginning with "ctl00_PageBody_productDetail_ctl00_qty_"
  // - OR IDs containing both "ProductListView" and "ProductQuantity"
  var inputs = document.querySelectorAll(
    "input[id^='ctl00_PageBody_productDetail_ctl00_qty_'], input[id*='ProductListView'][id*='ProductQuantity']"
  );
  
  inputs.forEach(function(input) {
    // If the input is already processed or already inside a wrapper, skip it.
    if (input.dataset.processedQuantityButtons === "true" || 
        (input.parentNode && input.parentNode.classList.contains('quantity-wrapper'))) {
      return;
    }
    
    // Mark this input as processed.
    input.dataset.processedQuantityButtons = "true";
    
    // Set the default value to "1"
    input.value = "1";
    
    // Create a wrapper container and add a class for future checks.
    var wrapper = document.createElement('div');
    wrapper.className = 'quantity-wrapper';
    // Inline styling for the wrapper.
    wrapper.style.display = 'inline-flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.border = '1px solid #007BFF'; // Example border color.
    wrapper.style.borderRadius = '4px';
    wrapper.style.overflow = 'hidden';
    
    // Insert the wrapper into the DOM before the input, then move the input into it.
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
    minusBtn.style.backgroundColor = '#007BFF';
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
    plusBtn.style.backgroundColor = '#007BFF';
    plusBtn.style.color = '#fff';
    plusBtn.style.border = 'none';
    plusBtn.style.fontSize = '16px';
    plusBtn.style.cursor = 'pointer';
    plusBtn.style.display = 'flex';
    plusBtn.style.alignItems = 'center';
    plusBtn.style.justifyContent = 'center';
    plusBtn.style.marginLeft = '5px';
    
    // Insert the buttons: minus before the input, plus after.
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
