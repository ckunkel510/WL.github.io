function filterAndDisplayStockData(stockData, branch) {
    let columnIndex = stockData.find('th').index((_, th) => {
        const headerText = $(th).text().trim();
        console.log(`Checking header: "${headerText}"`);
        return headerText === 'Actual'; // Exact match for 'Actual'
    });

    // Fallback to Header2 (3rd column) if "Actual" column is not found
    if (columnIndex === -1) {
        console.warn('"Actual" column not found. Falling back to "Header2" column.');
        columnIndex = 2; // 3rd column index (Header2)
    }

    console.log(`Using column index: ${columnIndex}`);

    const filteredRow = stockData.find('tr').filter((_, row) => {
        const branchCell = $(row).find('td').eq(0).text().trim();
        console.log(`Checking branch: "${branchCell}" against "${branch}"`);
        return branchCell.toLowerCase().trim() === branch.toLowerCase().trim();
    });

    if (filteredRow.length) {
        console.log('Matched row for branch:', filteredRow.html());
        const stockValue = filteredRow.find(`td:eq(${columnIndex})`).text().trim();
        console.log(`Stock value for "${branch}" (column ${columnIndex}): "${stockValue}"`);
        displayWidget(branch, stockValue || 'No stock available', false);
    } else {
        console.error(`Branch "${branch}" not found in stock table.`);
        displayWidget(branch, 'No stock available', false);
    }
}

function displayWidget(branch, quantity, showSignInButton) {
    // Ensure only one widget exists
    $('#stock-widget').remove();

    let buttonHtml = '';

    if (showSignInButton) {
        buttonHtml = `
            <a href="https://webtrack.woodsonlumber.com/SignIn.aspx" style="display: inline-block; padding: 10px 20px; background: #6b0016; color: white; text-decoration: none; border: 1px solid transparent; border-radius: 4px; font-weight: bold; text-align: center; margin-top: 10px;">
                Check Your Local Store Inventory
            </a>
        `;
    }

    const widgetHtml = `
        <div id="stock-widget" style="display: table; border: 1px solid #ccc; padding: 10px; margin: 20px 0; background: #f9f9f9; text-align: center;">
            <h3>Stock Information</h3>
            <p><strong>Branch:</strong> ${branch}</p>
            <p><strong>Available Quantity:</strong> ${quantity}</p>
            ${buttonHtml}
        </div>
    `;

    $('#ctl00_PageBody_productDetail_productDescription').before(widgetHtml);
}
