function filterAndDisplayStockData(stockData, branch) {
    const actualStockColumnIndex = stockData.find('th').index((_, th) => {
        const headerText = $(th).text().trim();
        console.log(`Checking header: "${headerText}"`);
        return headerText === 'Actual'; // Exact match for 'Actual'
    });

    if (actualStockColumnIndex === -1) {
        console.error('Actual column not found in stock table. Falling back to manual index.');
        actualStockColumnIndex = 4; // Fallback to manual index
    }

    console.log(`"Actual" column index detected as: ${actualStockColumnIndex}`);

    const filteredRow = stockData.find('tr').filter((_, row) => {
        const branchCell = $(row).find('td').eq(0).text().trim();
        console.log(`Checking branch: "${branchCell}" against "${branch}"`);
        return branchCell.toLowerCase().trim() === branch.toLowerCase().trim();
    });

    if (filteredRow.length) {
        console.log('Matched row for Groesbeck:', filteredRow.html());
        const actualStock = filteredRow.find(`td:eq(${actualStockColumnIndex})`).text().trim();
        console.log(`Actual Stock for "${branch}": "${actualStock}"`);
        displayWidget(branch, actualStock || 'No stock available', false);
    } else {
        console.error(`Branch "${branch}" not found in stock table.`);
        displayWidget(branch, 'No stock available', false);
    }
}
