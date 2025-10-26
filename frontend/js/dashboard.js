let chart;
let userId;
let idToken;

function init() {
    userId = localStorage.getItem('userId');
    idToken = localStorage.getItem('idToken');

    if (!userId || !idToken) {
        window.location.href = 'index.html';
        return;
    }

    setTodayDate();
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

async function getTips() {
    try {
        const response = await fetch(`${AWS_CONFIG.apiGatewayUrl}/getAnalysis?userId=${userId}`, {
            headers: {
                'Authorization': `Bearer ${idToken}`
            }
        });

        if (!response.ok) throw new Error('Failed to get tips');

        const data = await response.json();
        displayTips(data.tips);
    } catch (err) {
        showMessage(err.message, 'danger');
    }
}

function displayTips(tips) {
    const container = document.getElementById('tipsContainer');
    container.innerHTML = '';

    tips.forEach((tip, index) => {
        const tipElement = document.createElement('div');
        tipElement.className = 'tip-item';
        tipElement.innerHTML = `<strong>Tip ${index + 1}:</strong> ${tip}`;
        container.appendChild(tipElement);
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