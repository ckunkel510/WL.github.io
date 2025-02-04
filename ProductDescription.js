<script>
window.onload = async function () {
    console.log("Starting script...");

    // Google Sheet URL with your data
    const googleSheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSz4pwwlgmNw8642O1eDV8Jir2GBslQyyTX4ykx_rRlAb6k2EHe_QYy2gwk7R9bq5gV3KZpYOdXA3HW/pub?output=csv';

    try {
        console.log("Fetching Google Sheet data...");
        const response = await fetch(googleSheetUrl);

        // Handle network or server errors
        if (!response.ok) {
            throw new Error(`Failed to fetch data. Status: ${response.status}`);
        }

        const csvText = await response.text();

        // Log the raw CSV response to confirm fetch success
        console.log("Raw CSV Data:", csvText);

        // Parse CSV data
        const parsedData = parseCsvToJson(csvText);
        console.log("Parsed Data:", parsedData);

        // Log each parsed entry
        parsedData.forEach((entry, index) => {
            console.log(`Entry ${index + 1}:`, entry);
        });

    } catch (error) {
        console.error("Error fetching or processing Google Sheet data:", error);
    }
};

function parseCsvToJson(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) {
        console.warn("No data found in CSV.");
        return [];
    }

    // Extract headers and convert to lowercase for case-insensitive matching
    const headers = lines[0].split(',').map(header => header.trim().toLowerCase());
    console.log("Detected Headers:", headers);

    // Parse each line of the CSV into an object using the headers
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
