// Ensure this script runs after the DOM is fully loaded
document.addEventListener('DOMContentLoaded', async function() {
    // Ensure the script only runs on AccountPayment_r.aspx
    if (!window.location.href.includes('AccountPayment_r.aspx')) {
        return;
    }

    // Fetch data from the JobBalances_R.aspx table
    async function fetchJobBalances() {
        try {
            const response = await fetch('https://webtrack.woodsonlumber.com/JobBalances_R.aspx');
            if (!response.ok) {
                throw new Error(`Failed to fetch JobBalances data: ${response.statusText}`);
            }

            const text = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');

            // Extract rows containing Job and Net Amount
            const rows = doc.querySelectorAll('table tr');
            const jobData = [];

            rows.forEach(row => {
                const jobCell = row.querySelector('td[data-title="Job"]');
                const netAmountCell = row.querySelector('td[data-title="Net Amount"]');

                if (jobCell && netAmountCell) {
                    jobData.push({
                        job: jobCell.textContent.trim(),
                        netAmount: parseFloat(netAmountCell.textContent.trim().replace(/[^\d.-]/g, ''))
                    });
                }
            });

            return jobData;
        } catch (error) {
            console.error('Error fetching or parsing JobBalances data:', error);
            return [];
        }
    }

    // Render radio buttons and attach them to the page
    async function renderRadioButtons() {
        try {
            const jobBalances = await fetchJobBalances();
            if (jobBalances.length === 0) {
                console.warn('No JobBalances data found. Skipping radio button rendering.');
                return;
            }

            const targetDiv = document.getElementById('ctl00_PageBody_SearchPanel');
            if (!targetDiv) {
                console.error('Target div not found. Cannot render radio buttons.');
                return;
            }

            // Create a container for the radio buttons
            const container = document.createElement('div');
            container.id = 'job-balance-options';
            container.style.marginBottom = '1em';

            jobBalances.forEach((job, index) => {
                const label = document.createElement('label');
                label.style.display = 'block';
                label.style.marginBottom = '5px';

                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = 'jobBalance';
                radio.value = job.netAmount;
                radio.dataset.job = job.job;
                radio.id = `job-${index}`;

                label.appendChild(radio);
                label.appendChild(document.createTextNode(` ${job.job} - $${job.netAmount.toFixed(2)}`));
                container.appendChild(label);
            });

            // Insert the container before the target div
            targetDiv.parentNode.insertBefore(container, targetDiv);

            // Add event listener to update the total and textarea
            container.addEventListener('change', function(event) {
                if (event.target && event.target.type === 'radio') {
                    const paymentInput = document.getElementById('ctl00_PageBody_PaymentAmountTextBox');
                    const remittanceTextarea = document.getElementById('ctl00_PageBody_RemittanceAdviceTextBox');

                    if (!paymentInput) {
                        console.error('Payment amount input not found. Cannot update total.');
                        return;
                    }

                    if (!remittanceTextarea) {
                        console.error('Remittance advice textarea not found. Cannot update notes.');
                        return;
                    }

                    const currentTotal = parseFloat(paymentInput.value) || 0;
                    const selectedAmount = parseFloat(event.target.value);
                    const selectedJob = event.target.dataset.job;

                    paymentInput.value = (currentTotal + selectedAmount).toFixed(2);

                    // Append job and amount to the textarea
                    remittanceTextarea.value += `${selectedJob}: $${selectedAmount.toFixed(2)}\n`;
                }
            });
        } catch (error) {
            console.error('Error rendering radio buttons:', error);
        }
    }

    // Run the script
    await renderRadioButtons();
});
