<script>
window.onload = async function () {
    console.log("Script loaded. Testing Google Sheet data fetch...");

    // Google Sheet URL with your data
    const googleSheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSz4pwwlgmNw8642O1eDV8Jir2GBslQyyTX4ykx_rRlAb6k2EHe_QYy2gwk7R9bq5gV3KZpYOdXA3HW/pub?output=csv';

    try {
        console.log("Attempting to fetch data from Google Sheet...");
        const response = await fetch(googleSheetUrl);

        // Check for network errors or non-200 status codes
        if (!response.ok) {
            throw new Error(`Network response was not ok. Status: ${response.status}`);
        }

        const csvText = await response.text();

        // Log the raw CSV text
        console.log("Raw CSV Response Text:", csvText);

        // Parse the CSV and log each entry
        const sheetData = parseCsvToJson(csvText);
        console.log("Parsed Sheet Data:", sheetData);

        // If data is successfully parsed, log each entry in detail
        sheetData.forEach((entry, index) => {
            console.log(`Entry ${index + 1}:`, entry);
        });

    } catch (error) {
        console.error("Error fetching or processing Google Sheet data:", error);
    }
};

function parseCsvToJson(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    const headers = lines[0].split(',').map(header => header.trim().toLowerCase());

    console.log("CSV Headers Detected:", headers);

    return lines.slice(1).map(line => {
        const values = line.split(',').map(value => value.trim());
        const entry = headers.reduce((obj, header, index) => {
            obj[header] = values[index] || '';
            return obj;
        }, {});

        return entry;
    });
}
</script>
