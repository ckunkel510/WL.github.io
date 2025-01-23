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
    const sheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR5nZGRFSLOS6_0LhN-uXF2oraESccvFP43BdCQQEqn43vned5cHRhHux2d4-BzY6vmGfk-nzNM8G67/pub?output=csv";

    // Fetch data from the Google Sheet
    $.get(sheetUrl, function (data) {
      const rows = data.split("\n").map(row => row.split(","));
      const header = rows.shift(); // Remove the header row

      // Find all rows that match the current productid
      const matchingRows = rows.filter(row => row[0].trim() === currentPid);

      if (matchingRows.length > 0) {
        const containerDiv = $("<div>").css({ marginBottom: "15px" });

        // Add the "Options" header
        const optionsHeader = $("<h4>")
          .text("Options")
          .css({
            fontSize: "18px",
            fontWeight: "bold",
            marginBottom: "10px",
          });
        containerDiv.append(optionsHeader);

        const textOptionsDiv = $("<div>"); // Container for text options
        const imageOptionsDiv = $("<div>"); // Container for image options
        let imageHeaderAdded = false; // Ensure the "Other Options" header is only added once

        // Process all matching rows
        matchingRows.forEach(row => {
          const optionType = row[1].trim().toLowerCase(); // Get the option type (text or image)

          for (let i = 2; i < row.length; i++) {
            const option = row[i].trim();
            if (!option) continue; // Skip empty options

            const [optionPid, description] = option.split("-");
            const link = `https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=${optionPid.trim()}`;
            const isActive = optionPid.trim() === currentPid; // Check if the current option is active

            if (optionType === "text") {
              // Render text option
              $("<a>")
                .text(description.trim())
                .attr("href", link)
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
                .appendTo(textOptionsDiv);
            } else if (optionType === "image") {
              // Add "Other Options" header before the first image
              if (!imageHeaderAdded) {
                const otherOptionsHeader = $("<h4>")
                  .text("Other Options")
                  .css({
                    fontSize: "18px",
                    fontWeight: "bold",
                    margin: "20px 0 10px",
                  });
                imageOptionsDiv.append(otherOptionsHeader);
                imageHeaderAdded = true;
              }

              // Get the corresponding image link
              const imgColumnIndex = header.indexOf(`o${i - 1}imglink`);
              const imgUrl = imgColumnIndex >= 0 ? row[imgColumnIndex]?.trim() : null;

              if (imgUrl) {
                // Render image option
                $("<a>")
                  .attr("href", link)
                  .attr("title", description.trim()) // Tooltip on hover
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
                  .appendTo(imageOptionsDiv);
              }
            }
          }
        });

        // Append the text and image options to the container
        containerDiv.append(textOptionsDiv);
        containerDiv.append(imageOptionsDiv);

        // Insert the container before the product description div
        $("#ctl00_PageBody_productDetail_productDescription").before(containerDiv);
      }
    });
  });
