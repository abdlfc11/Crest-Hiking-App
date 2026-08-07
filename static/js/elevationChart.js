// Local Imports 
import { normaliseCoordLength, getCurrentPathData } from './routes/routeState.js';
import { getRouteLayer } from './map.js';
import { getTheme, getDistanceUnit } from './settingsState.js';
import { createManualPointStyle } from './utils/style-utils.js';

// OpenLayers imports 
import { fromLonLat, toLonLat } from 'ol/proj.js';
import { Feature } from 'ol';
import { Point } from 'ol/geom.js';
import { getDistance } from 'ol/sphere.js'

// Chart.js imports 
import Chart from 'chart.js/auto';

/**
 * Returns true if the coord is in EPSG:4326 projection and false otherwise
 * 
 * @param {Array} coord The coordinate array in format [X, Y] or [Lon, Lat]
 * @returns {bool} True if the coordinate is in EPSG:4326 projection and false otherwise 
 */
function isLonLatCoord(coord) {
  return Array.isArray(coord) && coord.length >= 2 &&
    Math.abs(coord[0]) <= 180 && Math.abs(coord[1]) <= 90;
}

let elevationChart = null;
let currentCoordinates = null;
const toggleElevationChartButton = document.getElementById('toggle-elevation-chart');

// Feature which is created on the map corresponding to the point being hovered over on the elevation chart
let hoverPointFeature = null;

/**
 * Used to set the value of the hoverPointFeature
 * 
 * @param {any} value 
 * @returns {void}
 */
export function setHoverPointFeature(value) {
    hoverPointFeature = value;
}

/**
 * Updates or creates a temporary marker feature on the route map layer at the specified position.
 * Strips out extra dimensions (like elevation data) to pass clean 2D coordinates to OpenLayers.
 * 
 * @param {Array<number>} coordinate  An array containing map location coordinates, formatted as `[x, y]` or `[x, y, elevation]`
 * @returns {void}
 */
function updateMapHoverPoint(coordinate) {
  const routeLayer = getRouteLayer();
  if (!routeLayer) return;
  const source = routeLayer.getSource();

  // converts coordinates into web mercator to display the point feature on the map (which has projection of Web Mercator)
  let coord = [coordinate[0], coordinate[1]];
  if (isLonLatCoord(coord)) {
    coord = fromLonLat(coord);
  }

  if (!hoverPointFeature) {
    hoverPointFeature = new Feature({
      geometry: new Point(coord)
    });

    hoverPointFeature.setStyle(createManualPointStyle("", "#FFFFFF", 7.5, "#0a45e7"));
    source.addFeature(hoverPointFeature);
  } else {
    hoverPointFeature.getGeometry().setCoordinates(coord);
  }
}

/**
 * Removes the temporary hover marker feature from the route map layer and clears its internal memory reference.
 * Operates safely if the layer source or the feature reference do not exist.
 * 
 * @returns {void}
 */
function clearMapHoverPoint() {
  const routeLayer = getRouteLayer();
  if (!routeLayer || !hoverPointFeature) return;
  
  const source = routeLayer.getSource();
  source.removeFeature(hoverPointFeature);
  hoverPointFeature = null; // Reset reference
};

export function resetElevationChart() {
    const ctx = document.getElementById('elevation-chart');
    
    // this destroys the chart via reference or via Chart.js canvas registry
    const existingChart = elevationChart || (ctx ? Chart.getChart(ctx) : null);

    if (existingChart) {
        existingChart.destroy();
        elevationChart = null;
    }
    currentCoordinates = null;
}

export function createElevationProfile(coordinates) {

    coordinates = normaliseCoordLength(coordinates)

    const container = document.getElementById('elevation-chart-container');
    const ctx = document.getElementById('elevation-chart');

    if (!ctx) {
        console.warn("Elevation chart canvas not found");
        return;
    }

    if (!coordinates || coordinates.length < 2) {
        resetElevationChart();
        ctx.style.display = 'none';

        if (!document.getElementById('chart-placeholder-message')) {
            const placeholder = document.createElement('div');
            placeholder.id = 'chart-placeholder-message';

            // Put whatever custom HTML/CSS classes you want here!
            placeholder.innerHTML = `
                <div class="empty-chart-state">
                    <p>Plot at least two points to generate an elevation profile.</p>
                </div>
            `;
            container.appendChild(placeholder);
        }

        return;
    }

    const placeholder = document.getElementById('chart-placeholder-message');

    if (placeholder) {
        placeholder.remove()
    }
    ctx.style.display = 'block'

    currentCoordinates = coordinates;

    // converts manually plotted coordinates to lon lat (auto routing uses lat lon already) 
    const geoCoordinates = coordinates.map(coord => {
        let lonLat;
        if (isLonLatCoord(coord)) {
          lonLat = [coord[0], coord[1]];
        } else {
          lonLat = toLonLat([coord[0], coord[1]]);
        }
        return [lonLat[0], lonLat[1], coord[2] || 0];
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

        if (distanceUnit === "miles") {
            cumulativeDistance += segmentKm * 0.621371;
        } else {
            cumulativeDistance += segmentKm; // default: km
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
    const border = isDark ? '#60a5fa' : '#1d4ed8';
    const fill = isDark ? 'rgba(96, 165, 250, 0.2)' : 'rgba(29, 78, 216, 0.12)';
    
    const white = '#FFFFFF'

    const verticalLineStrokeColor = isDark ? white : "#1d4ed8e6"; // white for dark mode and strong blue for light mode

    // distance unit strings
    const distanceLabel = distanceUnit === "km" ? "Distance (km)" : "Distance (miles)";
    const distanceExtension = distanceUnit === "km" ? " km" : " miles";


    // Vertical Line plugin to allow a vertical line to be shown upon the hovering over of the elevation chart
    const verticalLinePlugin = {
        id: 'verticalLine',
        beforeDatasetsDraw: (chart) => {
            const { ctx, tooltip, chartArea } = chart;
            if (!tooltip || !tooltip._active || tooltip._active.length === 0) return;

            const activePoint = tooltip._active[0];
            const x = activePoint.element.x;

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(x, chartArea.top);
            ctx.lineTo(x, chartArea.bottom);
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = verticalLineStrokeColor;
            ctx.setLineDash([3, 2]); 
            ctx.stroke();
            ctx.restore();
        }
    };


    // this destroys the old chart if there is a new one present
    if (elevationChart) {
        elevationChart.data.datasets[0].data = chartData;

        // 2. Dynamic style updates 
        elevationChart.data.datasets[0].borderColor = border;
        elevationChart.data.datasets[0].backgroundColor = fill;
        
        elevationChart.options.scales.x.title.text = distanceLabel;
        elevationChart.options.scales.x.title.color = text;
        elevationChart.options.scales.x.ticks.color = text;
        elevationChart.options.scales.x.grid.color = grid;
        
        elevationChart.options.scales.y.title.color = text;
        elevationChart.options.scales.y.ticks.color = text;
        elevationChart.options.scales.y.grid.color = grid;
        
        elevationChart.options.plugins.tooltip.callbacks.title = (ctx) => ctx[0].raw.x + distanceExtension;

        elevationChart.update();
    }
    else {
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
                    pointRadius: 0,
                    pointHoverRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                    axis: 'x'
                },
                onHover: (event, activeElements) => {
                    if (activeElements && activeElements.length > 0 && currentCoordinates) {
                        const hoveredIndex = activeElements[0].index;
                        const matchingCoordinate = currentCoordinates[hoveredIndex];
                        
                        if (matchingCoordinate) {
                            updateMapHoverPoint(matchingCoordinate);
                        }
                    } else {
                        clearMapHoverPoint();
                    }
                },
                plugins: {
                    verticalLine: {},
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
                        grid: { color: grid }
                    }
                }
            },
            plugins: [verticalLinePlugin]
        });

        // This clears the point when the user stops hovering over the chart 
        ctx.addEventListener('mouseleave', () => {
            clearMapHoverPoint();
        });
    };
};

export function toggleElevationChart() {
    const container = document.getElementById('elevation-chart-container');
    if (!container) return;

    
    const isActive = container.classList.toggle('active'); // adds class if it is missing and returns True if it is added and False if it is removed
    
    if (isActive) {
        if (currentCoordinates && currentCoordinates.length >= 2) {
            createElevationProfile(currentCoordinates);
        };
    };
};

export function initChartToggleListener() {
    const toggleButton = document.getElementById('toggle-elevation-chart');
    if (toggleButton) {
        toggleButton.onclick = toggleElevationChart;
    }
};


