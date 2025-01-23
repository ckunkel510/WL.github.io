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

      // Find the row that matches the current productid
      const matchingRow = rows.find(row => row[0].trim() === currentPid);

      // Render links/buttons only if options are found
      if (matchingRow && matchingRow.length > 1) {
        const optionType = matchingRow[1].trim().toLowerCase(); // Get the option type (text or image)
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

        // Loop through options (skip first two columns: productid and optiontype)
        for (let i = 2; i < matchingRow.length; i++) {
          const option = matchingRow[i].trim();
          if (!option) continue; // Skip empty options

          const [optionPid, description] = option.split("-");
          const link = `https://webtrack.woodsonlumber.com/ProductDetail.aspx?pid=${optionPid.trim()}`;

          if (optionType === "text") {
            // Create a text button
            $("<a>")
              .text(description.trim())
              .attr("href", link)
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
                  $(this).css("backgroundColor", "#FFFFFF");
                },
                function () {
                  $(this).css("backgroundColor", "#007BFF");
                }
              )
              .appendTo(containerDiv);
          } else if (optionType === "image") {
            // Get the corresponding image link
            const imgColumnIndex = header.indexOf(`o${i - 1}imglink`);
            const imgUrl = imgColumnIndex >= 0 ? matchingRow[imgColumnIndex]?.trim() : null;

            if (imgUrl) {
              // Create an image with a link
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
                      border: "1px solid #ccc",
                      borderRadius: "3px",
                      display: "inline-block",
                    })
                )
                .appendTo(containerDiv);
            }
          }
        }

        // Insert the container before the product description div
        $("#ctl00_PageBody_productDetail_productDescription").before(containerDiv);
      }
    });
  });
