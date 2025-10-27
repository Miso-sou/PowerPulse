let chart;
let userId;
let idToken;
let userProfile = null;

// Available appliances with their display names
const AVAILABLE_APPLIANCES = {
    'AC': 'Air Conditioner',
    'Fridge': 'Refrigerator',
    'WashingMachine': 'Washing Machine',
    'Geyser': 'Water Heater/Geyser',
    'TV': 'Television',
    'Microwave': 'Microwave Oven',
    'Fan': 'Ceiling Fan',
    'Dishwasher': 'Dishwasher',
    'IronBox': 'Iron Box'
};

function init() {
    userId = localStorage.getItem('userId');
    idToken = localStorage.getItem('idToken');

    if (!userId || !idToken) {
        window.location.href = 'index.html';
        return;
    }

    setTodayDate();
    initializeApplianceCheckboxes();
    fetchUserProfile();
    fetchAnalysis();
}

function setTodayDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('readingDate').value = today;
}

function showMessage(message, type) {
    const messageEl = document.getElementById('message');
    messageEl.textContent = message;
    messageEl.className = `alert alert-${type}`;
    messageEl.style.display = 'block';
    setTimeout(() => {
        messageEl.style.display = 'none';
    }, 3000);
}

async function addReading() {
    const date = document.getElementById('readingDate').value;
    const usage = parseFloat(document.getElementById('readingUsage').value);

    if (!date || !usage || usage <= 0) {
        showMessage('Please enter a valid date and usage', 'danger');
        return;
    }

    try {
        const response = await fetch(`${AWS_CONFIG.apiGatewayUrl}/addReading`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId,
                date,
                usage
            })
        });

        if (!response.ok) throw new Error('Failed to add reading');

        showMessage('Reading added successfully!', 'success');
        document.getElementById('readingUsage').value = '';
        setTodayDate();
        fetchAnalysis();
    } catch (err) {
        showMessage(err.message, 'danger');
    }
}

async function fetchAnalysis() {
    try {
        const response = await fetch(`${AWS_CONFIG.apiGatewayUrl}/getAnalysis?userId=${userId}`, {
            headers: {
                'Authorization': `Bearer ${idToken}`
            }
        });

        if (!response.ok) throw new Error('Failed to fetch analysis');

        const data = await response.json();

        // Update stats
        document.getElementById('avgUsage').textContent = data.average.toFixed(2);
        document.getElementById('maxUsage').textContent = data.max.toFixed(2);
        document.getElementById('minUsage').textContent = data.min.toFixed(2);

        // Update chart
        updateChart(data.readings);
    } catch (err) {
        showMessage(err.message, 'danger');
    }
}

function updateChart(readings) {
    const dates = readings.map(r => r.date).sort();
    const usages = dates.map(date => 
        readings.find(r => r.date === date).usage
    );

    const ctx = document.getElementById('usageChart').getContext('2d');

    if (chart) {
        chart.destroy();
    }

    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Energy Usage (kWh)',
                data: usages,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 5,
                pointBackgroundColor: '#667eea',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        padding: 15,
                        font: {
                            size: 12
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Usage (kWh)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Date'
                    }
                }
            }
        }
    });
}

// ========== USER PROFILE FUNCTIONS ==========

function initializeApplianceCheckboxes() {
    const container = document.getElementById('appliancesCheckboxes');
    container.innerHTML = '';

    Object.entries(AVAILABLE_APPLIANCES).forEach(([key, name]) => {
        const div = document.createElement('div');
        div.className = 'col-md-6 mb-2';
        div.innerHTML = `
            <div class="form-check">
                <input class="form-check-input appliance-checkbox" type="checkbox" 
                       value="${key}" id="appliance_${key}" 
                       onchange="toggleStarRating('${key}')">
                <label class="form-check-label" for="appliance_${key}">
                    ${name}
                </label>
                <div id="stars_${key}" style="display: none; margin-left: 20px; margin-top: 5px;">
                    <small class="text-muted">Star Rating:</small>
                    <select class="form-select form-select-sm star-rating-select" id="rating_${key}">
                        <option value="1">1 Star</option>
                        <option value="2">2 Stars</option>
                        <option value="3" selected>3 Stars</option>
                        <option value="4">4 Stars</option>
                        <option value="5">5 Stars</option>
                    </select>
                </div>
            </div>
        `;
        container.appendChild(div);
    });
}

function toggleStarRating(applianceKey) {
    const checkbox = document.getElementById(`appliance_${applianceKey}`);
    const starsDiv = document.getElementById(`stars_${applianceKey}`);
    starsDiv.style.display = checkbox.checked ? 'block' : 'none';
}

async function fetchUserProfile() {
    try {
        const response = await fetch(`${AWS_CONFIG.apiGatewayUrl}/profile?userId=${userId}`, {
            headers: {
                'Authorization': `Bearer ${idToken}`
            }
        });

        if (response.ok) {
            userProfile = await response.json();
            displayUserProfile(userProfile);
        } else {
            // Profile doesn't exist yet, show form
            document.getElementById('profileForm').style.display = 'block';
            document.getElementById('profileDisplay').style.display = 'none';
        }
    } catch (err) {
        console.error('Error fetching profile:', err);
        document.getElementById('profileForm').style.display = 'block';
        document.getElementById('profileDisplay').style.display = 'none';
    }
}

function displayUserProfile(profile) {
    document.getElementById('displayLocation').textContent = profile.location;
    document.getElementById('displayHomeType').textContent = profile.homeType;

    const appliancesDiv = document.getElementById('displayAppliances');
    appliancesDiv.innerHTML = '';

    Object.entries(profile.appliances).forEach(([key, data]) => {
        const badge = document.createElement('span');
        badge.className = 'badge bg-primary me-2 mb-2';
        badge.textContent = `${AVAILABLE_APPLIANCES[key] || key}: ${data.starRating}⭐`;
        appliancesDiv.appendChild(badge);
    });

    document.getElementById('profileDisplay').style.display = 'block';
    document.getElementById('profileForm').style.display = 'none';

    // Load profile data into form for editing
    document.getElementById('location').value = profile.location;
    document.getElementById('homeType').value = profile.homeType;

    // Set appliance checkboxes and ratings
    Object.entries(profile.appliances).forEach(([key, data]) => {
        const checkbox = document.getElementById(`appliance_${key}`);
        if (checkbox) {
            checkbox.checked = true;
            toggleStarRating(key);
            document.getElementById(`rating_${key}`).value = data.starRating;
        }
    });
}

function showProfileForm() {
    document.getElementById('profileDisplay').style.display = 'none';
    document.getElementById('profileForm').style.display = 'block';
    document.getElementById('cancelProfileBtn').style.display = 'inline-block';
}

function cancelProfileEdit() {
    if (userProfile) {
        displayUserProfile(userProfile);
    }
}

async function saveProfile() {
    const location = document.getElementById('location').value.trim();
    const homeType = document.getElementById('homeType').value;

    if (!location || !homeType) {
        showMessage('Please fill in location and home type', 'danger');
        return;
    }

    // Collect selected appliances
    const appliances = {};
    const checkboxes = document.querySelectorAll('.appliance-checkbox:checked');
    
    if (checkboxes.length === 0) {
        showMessage('Please select at least one appliance', 'danger');
        return;
    }

    checkboxes.forEach(checkbox => {
        const key = checkbox.value;
        const starRating = parseInt(document.getElementById(`rating_${key}`).value);
        appliances[key] = { starRating };
    });

    try {
        const response = await fetch(`${AWS_CONFIG.apiGatewayUrl}/profile`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId,
                location,
                homeType,
                appliances
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to save profile');
        }

        const data = await response.json();
        userProfile = data.profile;
        
        showMessage('Profile saved successfully! You can now generate personalized insights.', 'success');
        displayUserProfile(userProfile);
        document.getElementById('cancelProfileBtn').style.display = 'none';
    } catch (err) {
        showMessage(err.message, 'danger');
    }
}

// ========== INSIGHTS FUNCTIONS ==========

async function generateInsights() {
    const btn = document.getElementById('generateBtnText');
    const spinner = document.getElementById('generateBtnSpinner');
    const container = document.getElementById('insightsContainer');

    // Show loading state
    btn.textContent = 'Generating...';
    spinner.style.display = 'inline-block';
    container.innerHTML = '<div class="text-center"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div><p class="mt-2">Analyzing your energy usage patterns...</p></div>';

    try {
        const response = await fetch(`${AWS_CONFIG.apiGatewayUrl}/insights?userId=${userId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || error.error || 'Failed to generate insights');
        }

        const data = await response.json();
        displayInsights(data.insights, data.metadata);
        
    } catch (err) {
        container.innerHTML = `
            <div class="alert alert-danger">
                <strong>Error:</strong> ${err.message}
            </div>
        `;
    } finally {
        btn.textContent = 'Generate Insights';
        spinner.style.display = 'none';
    }
}

function displayInsights(insights, metadata) {
    const container = document.getElementById('insightsContainer');
    container.innerHTML = '';

    if (!insights || insights.length === 0) {
        container.innerHTML = '<p class="text-muted">No insights available. Add more readings to get personalized recommendations.</p>';
        return;
    }

    // Add metadata info
    if (metadata) {
        const metaDiv = document.createElement('div');
        metaDiv.className = 'alert alert-info mb-3';
        let metaText = `<small><strong>Insights Type:</strong> ${metadata.type || 'rule-based'}`;
        if (metadata.weather) {
            metaText += ` | <strong>Weather:</strong> ${metadata.weather.temperature}°C, ${metadata.weather.description}`;
        }
        if (metadata.readingsCount) {
            metaText += ` | <strong>Data Points:</strong> ${metadata.readingsCount}`;
        }
        metaText += '</small>';
        metaDiv.innerHTML = metaText;
        container.appendChild(metaDiv);
    }

    // Display each insight as a card
    insights.forEach((insight, index) => {
        const insightCard = document.createElement('div');
        insightCard.className = 'insight-card mb-3 p-3 border rounded';
        
        // Determine card style based on insight type
        let borderClass = 'border-primary';
        if (insight.type === 'warning') borderClass = 'border-warning';
        if (insight.type === 'success') borderClass = 'border-success';
        if (insight.type === 'error') borderClass = 'border-danger';
        if (insight.type === 'ai') borderClass = 'border-info';
        
        insightCard.classList.add(borderClass);

        const icon = insight.icon || '💡';
        const title = insight.title || `Insight ${index + 1}`;
        const message = insight.message || insight;

        insightCard.innerHTML = `
            <div class="d-flex align-items-start">
                <div class="me-3" style="font-size: 2rem;">${icon}</div>
                <div class="flex-grow-1">
                    <h6 class="mb-1"><strong>${title}</strong></h6>
                    <p class="mb-0">${message}</p>
                </div>
            </div>
        `;
        
        container.appendChild(insightCard);
    });
}

async function uploadCSV() {
    const fileInput = document.getElementById('csvFile');
    const file = fileInput.files[0];

    if (!file) {
        showMessage('Please select a CSV file', 'danger');
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        const text = e.target.result;
        const lines = text.trim().split('\n');
        const readings = [];

        for (let i = 0; i < lines.length; i++) {
            const [date, usage] = lines[i].split(',');
            if (date && usage) {
                readings.push({
                    date: date.trim(),
                    usage: parseFloat(usage.trim())
                });
            }
        }

        try {
            const response = await fetch(`${AWS_CONFIG.apiGatewayUrl}/uploadCSV`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${idToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId,
                    readings
                })
            });

            if (!response.ok) throw new Error('Failed to upload CSV');

            showMessage(`${readings.length} readings uploaded successfully!`, 'success');
            fileInput.value = '';
            fetchAnalysis();
        } catch (err) {
            showMessage(err.message, 'danger');
        }
    };

    reader.readAsText(file);
}

window.addEventListener('load', init);