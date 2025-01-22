$(document).ready(function () {
    // Extract the current product ID (pid) from the URL
    const fullQuery = window.location.search;
    const pidMatch = fullQuery.match(/pid=([^&]*)/);
    const currentPid = pidMatch ? pidMatch[1] : null;

    if (!currentPid) {
      console.error("No pid found in the URL.");
      return;
    }

    // URL for the Google Sheet data in CSV format
    const sheetUrl = "https://docs.google.com/spreadsheets/d/e/YOUR_SHEET_ID/pub?output=csv";

    // Fetch data from the Google Sheet
    $.get(sheetUrl, function (data) {
      const rows = data.split("\n").map(row => row.split(","));
      const header = rows.shift(); // Remove the header row

      // Find the row that matches the current productid
      const matchingRow = rows.find(row => row[0].trim() === currentPid);

      // Render dropdown only if options are found
      if (matchingRow && matchingRow.length > 1) {
        // Create dropdown menu
        const dropdownDiv = $("<div>").css({ marginBottom: "15px" });
        const dropdownHeader = $("<h4>").text("Options").css({ marginBottom: "5px" });
        const dropdown = $("<select>")
          .css({ padding: "5px", fontSize: "14px" })
          .append('<option value="">Select an option</option>'); // Default placeholder option

        // Add options to the dropdown (start from the second column)
        matchingRow.slice(1).forEach(option => {
          if (option.trim()) {
            const [optionPid, description] = option.split("-");
            $("<option>")
              .val(optionPid.trim())
              .text(description.trim())
              .appendTo(dropdown);
          }
        });

        // Add change event to redirect on selection
        dropdown.on("change", function () {
          const selectedPid = $(this).val();
          if (selectedPid) {
            window.location.href = `https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=${selectedPid}`;
          }
        });

        // Add header and dropdown to the div
        dropdownDiv.append(dropdownHeader, dropdown);

        // Insert the dropdown before the product description div
        $("#ctl00_PageBody_productDetail_productDescription").before(dropdownDiv);
      }
    });
  });
