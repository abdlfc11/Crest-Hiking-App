import { getDistance } from 'https://cdn.jsdelivr.net/npm/ol@v10.3.1/sphere.js';
import { toLonLat } from 'https://cdn.jsdelivr.net/npm/ol@v10.3.1/proj.js';
import { normaliseCoordLength } from './routes/routeState.js';
import { getTheme, getDistanceUnit } from './settingsState.js';

let elevationChart = null;
let currentCoordinates = null;
const toggleElevationChartButton = document.getElementById('toggle-elevation-chart');
const dimCheckbox = document.getElementById('toggle-chart-dim');
const chartCanvas = document.getElementById('elevation-chart');

export function createElevationProfile(coordinates) {

    coordinates = normaliseCoordLength(coordinates)

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
    const distanceUnit = getDistanceUnit();

    for (let i = 1; i < geoCoordinates.length; i++) {
        const p1 = geoCoordinates[i-1];
        const p2 = geoCoordinates[i];

         
        const segmentMeters = getDistance([p1[0], p1[1]], [p2[0], p2[1]]);
        const segmentKm = segmentMeters / 1000;

        if (distanceUnit == "km") {
            cumulativeDistance += segmentKm;
        }
        else if (distanceUnit == "miles") {
            cumulativeDistance += (segmentKm * 0.621371);
        }

        chartData.push({
            x: Math.round(cumulativeDistance * 100) / 100, // Math.round only rounds to integer, so we multiply by 100 and then divide by 100 to get value 2dp 
            y: p2[2]
        });
    }  

    // light / dark mode logic 


    const theme = getTheme(); // "light" | "dark"
    const isDark = theme === "dark";

    const text = isDark ? "#ffffff" : "#1f2937";
    const grid = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
    const border = isDark ? "#2563eb" : "#1d4ed8";
    const fill = isDark ? "rgba(37,99,235,0.25)" : "rgba(37,99,235,0.15)";

    // distance unit strings
    const distanceLabel = distanceUnit === "km" ? "Distance (km)" : "Distance (miles)";
    const distanceExtension = distanceUnit === "km" ? " km" : " miles";



    // this destroys the old chart if there is a new one present
    if (elevationChart) elevationChart.destroy();

    elevationChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Elevation (m)',
                data: chartData,
                borderColor: border,
                backgroundColor: fill,
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
                        title: (ctx) => ctx[0].raw.x + distanceExtension,
                        label: (ctx) => `${ctx.raw.y} m`
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    title: { 
                        display: true, 
                        text: distanceLabel, 
                        color: text,
                        font: { size: 13 }
                    },
                    ticks: {
                        color: text,
                        font: { size: 12 },
                        callback: function(value) {
                            return Math.round(value);
                        },
                        stepSize: 1,
                        maxTicksLimit: 12
                    },
                    grid: { color: grid }
                },
                y: {
                    title: { 
                        display: true, 
                        text: 'Elevation (m)', 
                        color: text,
                        font: { size: 13 }
                    },
                    ticks: { color: text },
                    grid: { grid }
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
    if (dimCheckbox && chartCanvas) {
        dimCheckbox.addEventListener('change', function() {
            // checked = hide chart || unchecked = show chart
            if (this.checked) {
                chartCanvas.classList.add('dimmed');
            } else {
                chartCanvas.classList.remove('dimmed');
            }
        });
    }
}


