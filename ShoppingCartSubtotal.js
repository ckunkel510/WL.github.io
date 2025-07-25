document.addEventListener("DOMContentLoaded", function () {
  try {
    var rows = document.querySelectorAll('table tr');
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var td = row.querySelector('td');
      if (td && td.textContent.includes('Subtotal')) {
        var amountCell = row.querySelectorAll('td')[1];
        if (!amountCell) continue;

        var text = amountCell.textContent.trim();
        var match = text.match(/\$?([\d,]+\.\d{2})/);
        if (match && match[1]) {
          var subtotal = parseFloat(match[1].replace(/,/g, ''));
          sessionStorage.setItem('purchaseSubtotal', subtotal);
          break;
        }
      }
    }
  } catch (e) {
    console.error('Subtotal sessionStorage error:', e);
  }
});

document.addEventListener("DOMContentLoaded", function () {
  // Clear sessionStorage after order is submitted
  var completeBtn = document.getElementById("ctl00_PageBody_CompleteCheckoutButton");
  if (completeBtn) {
    completeBtn.addEventListener("click", function () {
      setTimeout(function () {
        sessionStorage.removeItem("purchaseSubtotal");
        console.log("✅ purchaseSubtotal cleared from sessionStorage");
      }, 5000); // wait 3 seconds before clearing
    });
  }
});
