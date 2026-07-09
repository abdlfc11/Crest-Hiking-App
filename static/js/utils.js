import { getAppSettings } from "./settingsState.js";

/**
 * 
 * @param {DOMElement} element 
 * @param {function} func 
 * @param {Event} type 
 */
export function addClickListener(element, func, type) {
  if (element) element.addEventListener(type, func);
}

// function to round coordinates to a given decimal point
export function roundCoords (coordArray, decimals) {

    const [x, y] = coordArray;

    if (decimals === 0) {
        return [Math.round(x), Math.round(y)]
    }

    const multiplier = 10 ** decimals;

    const roundedX = Math.round(x * multiplier) / multiplier;
    const roundedY = Math.round(y * multiplier) / multiplier;


    return [roundedX, roundedY];
}

// function to set the styling for points that are added in manual routing mode
export function createManualPointStyle(label, colour, radius=7.5) {
  return new ol.style.Style({
    image : new ol.style.Circle({
      radius : radius,
      fill : new ol.style.Fill({
        color : colour
      }),
      stroke : new ol.style.Stroke({
        color : "white",
        width : 3
      })
    }),
    text : label ? new ol.style.Text({
      text : label,
      font : "bold 12px sans-serif",
      fill : new ol.style.Fill({
        color : "black"
      }),
      stroke : new ol.style.Stroke({
        color : "white",
        width : 3
      }),
      offsetY : -15
    }) : null
  })
}

export function getRouteStrokeStyle() {
  return {
    color: "#2563eb",
    width: 8,
    lineCap: "round",
    lineJoin: "round",
  }
}

// formating distance between different units
export function formatDistance(distanceKm) {
  const appSettings = getAppSettings(); // retrieves copy of app setting object from settingsState.js 
  const distanceUnit = appSettings?.distanceUnit;

  if (distanceUnit === "miles") {
    const distanceMiles = distanceKm * 0.621371; 
    return `${distanceMiles.toFixed(2)}mi`;
  }
  return `${distanceKm.toFixed(2)}km`;
}

export function calculateTotalDistance(points) {
  let totalDistance = 0;
  for (let i = 1; i < points.length; i++) {
    const previous = ol.proj.toLonLat(points[i - 1]);
    const current = ol.proj.toLonLat(points[i]);
    totalDistance += ol.sphere.getDistance(previous, current)
  }
  return totalDistance;
}

export function calculateEta(distanceKm) {
  const averageHikingSpeed = 4.0;
  const etaHours = distanceKm / averageHikingSpeed;
  const etaMinutes = Math.floor(etaHours * 60);
  const etaHoursInt = Math.floor(etaHours);
  const etaMinutesRemainder = etaMinutes % 60;

  if (etaHoursInt > 0) {
    console.log(`DEBUG: ETA CALCULATED IS ${etaHoursInt} + ${etaMinutes}`)
    return `${etaHoursInt}h ${etaMinutesRemainder}m`;
  }

  console.log(`DEBUG: ETA CALCULATED IS ${etaHoursInt} + ${etaMinutes}`)
  return `${etaMinutesRemainder}m`;
}

export function formatETA(seconds) {
    if (isNaN(seconds)) {
      seconds = parseFloat(seconds)
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours === 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
}

export function showError(message) {
    const container = document.getElementById("error-toast-container");

    const toast = document.createElement("div");
    toast.className = "error-toast";
    toast.textContent = message;

    container.appendChild(toast);

    // this triggers the slide in animation of the error popup
    requestAnimationFrame(() => {
        toast.classList.add("show");
    });

    // this makes the popup hide after 3s
    setTimeout(() => {
        toast.classList.add("hide");

        // this removes it from the DOM once time is up
        setTimeout(() => {
            toast.remove();
        }, 250);
    }, 3000);
}

export function moveMapToPosition(map, position = null, duration = 1200, zoom = 10.5) {
  if (!map) {
    console.warn("No map, returning");
    return;
  }

  const targetPosition = Array.isArray(position) && position.length === 2
    ? position
    : (Array.isArray(window.appConfig?.mapInitialCenter) ? window.appConfig.mapInitialCenter : [-211507, 7118524]);

  map.getView().animate({
    center: targetPosition,
    zoom: zoom,
    duration: duration
  })
};

/**
 * Removes the passed in DOM element
 * Used in any feature which adds a route card to the saved routes dashboard as it is used to remove the <div>...</div> content which tells the user that they have not saved any routes
 * 
 * @param {HTMLElement}  
 * @returns {boolean} true: element has been removed, false: element has not been removed (is already not there)
 */
export function removeDOMElement(element) {
  if (element) {
    element.remove()
    return true;
  }
  else {
    return false;
  }
}

/**
 * 
 * @param {string|number} elevationChange usually this is a string such as "938.0" or "-329.0" however the possibility of an int / float being passed is accounted for
 * @returns {string} this is a string which has been formated to add a + or leave the string unchanged if it is negative 
 */
export function formatElevation(elevationChange) {
  const elevNum = isNaN(elevationChange) ? parseFloat(elevationChange) : elevationChange;
  const elevDisplayValue = isNaN(elevNum) ? "0m" : (elevNum >= 0 ? `+${elevNum}m` : `${elevNum}m`)

  return elevDisplayValue
}

/**
 * Generates the HTML string for a saved route card displayed in the UI.
 *
 * This function builds a self-contained route card element with header,
 * key statistics, and action buttons. The returned string is intended to
 * be inserted into the DOM (e.g., via `innerHTML` or a DOM builder).
 *
 * @param {string} routeName: The display name of the route.
 * @param {string} formattedDate: Human-readable date string (e.g. "Saved on 15 June 2026").
 * @param {number} distanceInKm: Route length in kilometers. Used both for the data attribute and for formatting.
 * @param {string} ETA: Formatted estimated time to complete the route.
 * @param {string} elevDisplayValue: Pre-formatted elevation change string for display.
 * @returns {string} HTML string for the complete route card.
 */
export function createRouteCard(routeName, formattedDate, distanceInKm, ETA, elevDisplayValue) {
  return `<div class="route-card" data-route-name="${routeName}">
                              <div class="route-card-header">
                                  <h3 class="route-card-name">${routeName}</h3>
                                  <span class="route-card-date">Saved on ${formattedDate}</span>
                              </div>
                              <div class="route-card-stats">
                                  <div class="stat-item">
                                      <span class="stat-label">Distance:</span>
                                      <span class="stat-value" data-distance-km="${distanceInKm}">${formatDistance(distanceInKm)}</span>
                                  </div>
                                  <div class="stat-item">
                                      <span class="stat-label">ETA:</span>
                                      <span class="stat-value">${ETA}</span>
                                  </div>
                                  <div class="stat-item">
                                      <span class="stat-label">Elevation Change:</span>
                                      <span class="stat-value">${elevDisplayValue}</span>
                                  </div>
                              </div>
                              <div class="route-card-actions">
                                  <button type="button" class="route-btn route-btn-delete">Delete</button>
                                  <button type="button" class="route-btn route-btn-download-gpx">GPX</button>
                                  <button type="button" class="route-btn route-btn-download-geojson">GeoJSON</button>
                                  <button type="button" class="route-btn route-btn-load">Load</button>
                              </div>
                          </div>
                          `;
}

/**
 * This returns a card showing users that there are no saved routes for both a clean UI and a UX
 * 
 * @returns {string} HTML string for the route card showing that there are no routes 
 */
export function createNoRouteCard() {
  return `<div id="no-routes-wrapper" class="no-routes-wrapper">
              <div class="no-routes-card">
                  <h2 class="no-routes-title">No routes saved yet</h2>
                  <p class="no-routes-description">
                      You haven’t created any routes. Start planning your next adventure below.
                  </p>
                  <button id="no-route-create-button" class="no-routes-create-btn generate-button">
                      Create a route
                  </button>
              </div>
          </div>`
}