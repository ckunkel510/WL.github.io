  $(document).ready(function () {
    // Extract the current product ID (pid) from the URL
    const urlParams = new URLSearchParams(window.location.search);
    const fullQuery = window.location.search;
    const pidMatch = fullQuery.match(/pid=([^&]*)/);
    const currentPid = pidMatch ? pidMatch[1] : null;

    if (!currentPid) {
      console.error("No pid found in the URL.");
      return;
    }

    // URL for the Google Sheet data in CSV format
    const sheetUrl = "https://docs.google.com/spreadsheets/d/1pSBd7HkAFWe1tntmnOaUD3Nnf1ZaJiCdptMO7j_M0V4/edit?usp=sharing";

    // Fetch data from the Google Sheet
    $.get(sheetUrl, function (data) {
      const rows = data.split("\n").map(row => row.split(","));
      const header = rows.shift(); // Remove the header row
      const matchingRow = rows.find(row => row[0].trim() === currentPid);

      if (matchingRow) {
        // Create dropdown menu
        const dropdownDiv = $("<div>").css({ marginBottom: "15px" });
        const header = $("<h4>").text("Options").css({ marginBottom: "5px" });
        const dropdown = $("<select>").css({ padding: "5px", fontSize: "14px" });

        // Add options to the dropdown
        matchingRow.slice(1).forEach(option => {
          const [optionPid, description] = option.split("-");
          $("<option>")
            .val(optionPid.trim())
            .text(description.trim())
            .appendTo(dropdown);
        });

        // Add change event to redirect on selection
        dropdown.on("change", function () {
          const selectedPid = $(this).val();
          if (selectedPid) {
            window.location.href = `https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=${selectedPid}`;
          }
        });

        // Add header and dropdown to the div
        dropdownDiv.append(header, dropdown);

        // Insert the dropdown before the product description div
        $("#ctl00_PageBody_productDetail_productDescription").before(dropdownDiv);
      }
    });
  });
