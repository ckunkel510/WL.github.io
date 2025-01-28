$(document).ready(function () {
    const stores = [
        { name: 'Brenham', zip: 77833, lat: 30.1669, lon: -96.3977 },
        { name: 'Bryan', zip: 77803, lat: 30.6744, lon: -96.3743 },
        { name: 'Caldwell', zip: 77836, lat: 30.5316, lon: -96.6939 },
        { name: 'Lexington', zip: 78947, lat: 30.4152, lon: -97.0105 },
        { name: 'Groesbeck', zip: 76642, lat: 31.5249, lon: -96.5336 },
        { name: 'Mexia', zip: 76667, lat: 31.6791, lon: -96.4822 },
        { name: 'Buffalo', zip: 75831, lat: 31.4632, lon: -96.0580 }
    ];

    const DEFAULT_STORE = 'Groesbeck';

    // Main function to handle logic for both pages
    function main() {
        if (window.location.href.includes('UserSignup.aspx')) {
            handleUserSignup();
        } else if (window.location.href.includes('AccountSettings.aspx')) {
            handleAccountSettings();
        }
    }

    // Logic for UserSignup page
    function handleUserSignup() {
        const signupButton = $('#ctl00_PageBody_SignupButton');

        signupButton.on('click', function () {
            determineUserLocation()
                .then(userLocation => {
                    const nearestStore = findNearestStore(userLocation, stores);
                    sessionStorage.setItem('nearestBranch', nearestStore.name); // Store nearest branch in sessionStorage

                    console.log(`Nearest branch determined: ${nearestStore.name}`);
                    // Redirect to AccountSettings.aspx with the branch parameter
                    window.location.href = `AccountSettings.aspx?branch=${encodeURIComponent(nearestStore.name)}`;
                })
                .catch(() => {
                    console.error('Could not determine user location. Defaulting to Groesbeck.');
                    sessionStorage.setItem('nearestBranch', DEFAULT_STORE);
                    // Redirect with default branch
                    window.location.href = `AccountSettings.aspx?branch=${encodeURIComponent(DEFAULT_STORE)}`;
                });
        });
    }

    // Logic for AccountSettings page
    function handleAccountSettings() {
        const urlParams = new URLSearchParams(window.location.search);
        const branch = urlParams.get('branch') || sessionStorage.getItem('nearestBranch');

        if (branch) {
            console.log(`Updating branch to: ${branch}`);

            const dropdown = $('#ctl00_PageBody_ChangeUserDetailsControl_ddBranch');
            if (dropdown.length) {
                // Update dropdown to the nearest branch
                dropdown.find('option').each(function () {
                    if ($(this).text().trim() === branch) {
                        $(this).prop('selected', true);
                    }
                });

                // Simulate clicking the update button
                const updateButton = $('#ctl00_PageBody_ChangeUserDetailsControl_UpdateUserDetailsButton');
                if (updateButton.length) {
                    console.log('Simulating click on Update button...');
                    updateButton.click();
                } else {
                    console.error('Update button not found.');
                }
            } else {
                console.error('Branch dropdown not found.');
            }
        } else {
            console.error('Branch parameter not found.');
        }
    }

    // Determine user location via geolocation API
    function determineUserLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                console.error('Geolocation is not supported by this browser.');
                reject('Geolocation is not supported.');
                return;
            }

            navigator.geolocation.getCurrentPosition(
                position => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    console.log(`User location retrieved: Latitude ${lat}, Longitude ${lon}`);
                    resolve({ lat, lon });
                },
                error => {
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            console.error('User denied the request for Geolocation.');
                            break;
                        case error.POSITION_UNAVAILABLE:
                            console.error('Location information is unavailable.');
                            break;
                        case error.TIMEOUT:
                            console.error('The request to get user location timed out.');
                            break;
                        default:
                            console.error('An unknown error occurred while fetching geolocation.');
                    }
                    reject(error.message);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        });
    }

    // Find the nearest store to the user location
    function findNearestStore(userLocation, stores) {
        console.log(`Finding nearest store to user location: ${JSON.stringify(userLocation)}`);
        let nearestStore = null;
        let shortestDistance = Infinity;

        stores.forEach(store => {
            const distance = calculateDistance(
                userLocation.lat,
                userLocation.lon,
                store.lat,
                store.lon
            );
            console.log(`Distance to ${store.name}: ${distance} miles`);
            if (distance < shortestDistance) {
                nearestStore = store;
                shortestDistance = distance;
            }
        });

        return nearestStore || { name: DEFAULT_STORE };
    }

    // Calculate distance between two coordinates
    function calculateDistance(lat1, lon1, lat2, lon2) {
        const toRadians = degrees => (degrees * Math.PI) / 180;
        const R = 3958.8; // Radius of Earth in miles
        const dLat = toRadians(lat2 - lat1);
        const dLon = toRadians(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // Initialize the script
    main();
});
