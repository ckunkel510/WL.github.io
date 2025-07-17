$(document).ready(function () {
  // Extract the current product ID (pid) from the URL
  const fullQuery = window.location.search;
  const pidMatch = fullQuery.match(/pid=([^&]*)/);
  const currentPid = pidMatch ? pidMatch[1] : null;

  if (!currentPid) {
    console.error("No pid found in the URL.");
    return;
  }

  // Construct the dynamic input ID
  const inputId = `ctl00_PageBody_productDetail_ctl00_qty_${currentPid}`;

  // URL for the Google Sheet data in CSV format
  const sheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR5nZGRFSLOS6_0LhN-uXF2oraESccvFP43BdCQQEqn43vned5cHRhHux2d4-BzY6vmGfk-nzNM8G67/pub?output=csv";

  // Fetch data from the Google Sheet
  $.get(sheetUrl, function (data) {
    const rows = data.split("\n").map(row => row.split(","));
    const header = rows.shift(); // Remove the header row

    // Validate required column indexes
    const productIdIndex = header.indexOf("productid");
    const optionTypeIndex = header.indexOf("Optiontype");
    const headerIndex = header.indexOf("Header");

    if (productIdIndex === -1 || optionTypeIndex === -1 || headerIndex === -1) {
      console.error("Missing required columns (productid, Optiontype, or Header) in Google Sheet.");
      return;
    }

    // Find all rows that match the current productid
    const matchingRows = rows.filter(row => row[productIdIndex]?.trim() === currentPid);

    if (matchingRows.length > 0) {
      const containerDiv = $("<div>")
      .attr("id", "productoption")
      .css({
        display: "inline-block", // Outer wrapper div now uses inline-block
        marginBottom: "20px",
        padding: "10px",
        border: "1px solid #ccc",
        borderRadius: "8px",
        backgroundColor: "#f9f9f9",
        verticalAlign: "top", // Align wrapper with other elements
      });

      // Process all matching rows
      matchingRows.forEach(row => {
        const optionType = row[optionTypeIndex]?.trim().toLowerCase(); // Get the option type (text, image, uom)
        const dynamicHeader = row[headerIndex]?.trim() || "Options";

        // Add the row-specific header
        const rowHeader = $("<h4>")
          .text(dynamicHeader)
          .css({
            fontSize: "18px",
            fontWeight: "bold",
            marginBottom: "10px",
          });
        containerDiv.append(rowHeader);

        // Create a wrapper div for options in this row
        const optionsDiv = $("<div>").css({
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          alignItems: "center",
        });

        // Loop through the option columns (option1, option2, ..., option12)
        for (let i = header.indexOf("option1"); i <= header.indexOf("option12"); i++) {
          const option = row[i]?.trim();
          if (!option) continue; // Skip empty options

          const [optionPid, description] = option.split("-");
          const isActive = optionPid?.trim() === currentPid;

          if (optionType === "text") {
            // Render text option
            $("<a>")
              .text(description.trim())
              .attr("href", `https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=${optionPid.trim()}`)
              .css({
                display: "inline-block",
                padding: "5px 10px",
                margin: "5px",
                backgroundColor: isActive ? "#FFF" : "#6b0016",
                color: isActive ? "#000" : "#FFF",
                textDecoration: "none",
                borderRadius: "5px",
                fontSize: "14px",
                border: isActive ? "1px solid #6b0016" : "none",
              })
              .hover(
                function () {
                  if (!isActive) $(this).css("backgroundColor", "#8d8d8d");
                },
                function () {
                  if (!isActive) $(this).css("backgroundColor", "#6b0016");
                }
              )
              .appendTo(optionsDiv);
          } else if (optionType === "image") {
            // Get the corresponding image link
            const imgColumnIndex = header.indexOf(`o${i - header.indexOf("option1") + 1}imglink`);
            const imgUrl = imgColumnIndex >= 0 ? row[imgColumnIndex]?.trim() : null;

            if (imgUrl) {
              // Render image option
              $("<a>")
                .attr("href", `https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=${optionPid.trim()}`)
                .attr("title", description.trim())
                .css({ margin: "5px", display: "inline-block" })
                .append(
                  $("<img>")
                    .attr("src", imgUrl)
                    .css({
                      width: "50px",
                      height: "50px",
                      border: isActive ? "2px solid #6b0016" : "1px solid #ccc",
                      borderRadius: "3px",
                      display: "inline-block",
                    })
                )
                .appendTo(optionsDiv);
            }
          } else if (optionType === "uom") {
            // Render UOM option as a clickable button
            $("<a>")
              .text(option.trim()) // Use the value in the option column as the button text
              .attr("href", "#")
              .css({
                display: "inline-block",
                padding: "5px 10px",
                margin: "5px",
                backgroundColor: "#6b0016",
                color: "#FFF",
                textDecoration: "none",
                borderRadius: "5px",
                fontSize: "14px",
              })
              .hover(
                function () {
                  $(this).css("backgroundColor", "#8d8d8d");
                },
                function () {
                  $(this).css("backgroundColor", "#6b0016");
                }
              )
              .on("click", function (e) {
                e.preventDefault();

                // Extract numeric value from option text
                const numericValue = option.match(/\d+/)?.[0] || "";

                // Update the input field dynamically
                const qtyInput = $(`#${inputId}`);

                if (qtyInput.length) {
                  qtyInput.val(numericValue); // Update the value with the numeric part
                  qtyInput.text(numericValue); // Update the text (if applicable)
                } else {
                  console.error(`Input with ID ${inputId} not found.`);
                }
              })
              .appendTo(optionsDiv);
          }
        }

        // Append the optionsDiv to the containerDiv
        containerDiv.append(optionsDiv);
      });

      // Insert the container before the product description div
      $("#ctl00_PageBody_productDetail_productDescription").before(containerDiv);
    }
  });
});
