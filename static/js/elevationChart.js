import { getDistance } from 'https://cdn.jsdelivr.net/npm/ol@v10.3.1/sphere.js';
import { toLonLat } from 'https://cdn.jsdelivr.net/npm/ol@v10.3.1/proj.js';

let elevationChart = null;
let currentCoordinates = null;
const toggleElevationChartButton = document.getElementById('toggle-elevation-chart');

export function createElevationProfile(coordinates) {
    const ctx = document.getElementById('elevation-chart');
    if (!ctx) {
        console.warn("Elevation chart canvas not found");
        return;
    }

    if (!coordinates || coordinates.length < 2) {
        console.warn("Not enough coordinates for profile");
        return;
    }

    currentCoordinates = coordinates;

    // this transforms all coordinates from EPSG:3857 (Web Mercator) to standard Lat/Lon (wgs84)
    const geoCoordinates = coordinates.map(coord => {
        const lonLat = toLonLat([coord[0], coord[1]]);
        return [lonLat[0], lonLat[1], coord[2] || 0]; // Keep elevation at index 2
    });

    const chartData = []; // {x: distance, y: elevation}

    // start point using the transformed array
    chartData.push({ x: 0, y: geoCoordinates[0][2] });

    let cumulativeDistance = 0;

    for (let i = 1; i < geoCoordinates.length; i++) {
        const p1 = geoCoordinates[i-1];
        const p2 = geoCoordinates[i];

         
        const segmentMeters = getDistance([p1[0], p1[1]], [p2[0], p2[1]]);
        const segmentKm = segmentMeters / 1000;

        cumulativeDistance += segmentKm;

        chartData.push({
            x: parseFloat(cumulativeDistance.toFixed(2)),
            y: p2[2]
        });
    }

    // this destroys the old chart if there is a new one present
    if (elevationChart) {
        elevationChart.destroy();
    }

    elevationChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Elevation (m)',
                data: chartData,
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.15)',
                borderWidth: 1,
                tension: 0.3,
                fill: true,
                pointRadius: 4,
                pointHoverRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: (ctx) => ctx[0].raw.x + " km",
                        label: (ctx) => `${ctx.raw.y} m`
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    title: { 
                        display: true, 
                        text: 'Distance (km)', 
                        color: '#ffffff',
                        font: { size: 13 }
                    },
                    ticks: {
                        color: '#e0e0e0',
                        font: { size: 12 },
                        callback: function(value) {
                            return Math.round(value);
                        },
                        stepSize: 1,
                        maxTicksLimit: 12
                    },
                    grid: { color: 'rgba(255,255,255,0.08)' }
                },
                y: {
                    title: { 
                        display: true, 
                        text: 'Elevation (m)', 
                        color: '#ffffff',
                        font: { size: 13 }
                    },
                    ticks: { color: '#e0e0e0' },
                    grid: { color: 'rgba(255,255,255,0.08)' }
                }
            }
        }
    });
}

function toggleElevationChart() {
    const container = document.getElementById('elevation-chart-container');
    if (!container) return;

    
    const isActive = container.classList.toggle('active'); // adds class if it is missing and returns True if it is added and False if it is removed
    
    if (isActive) {
        if (currentCoordinates && currentCoordinates.length >= 2) {
            createElevationProfile(currentCoordinates);
        } else {
            console.log("Chart container visible, waiting for route coords");
        }
    }
}

export function initChartToggleListener() {
    const toggleButton = document.getElementById('toggle-elevation-chart');
    if (toggleButton) {
        toggleButton.onclick = toggleElevationChart;
    }
}


