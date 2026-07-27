/**
 * This file is intended to hold all UI related helper functions
 * As of July 2026 this file hold the following functions:
 *      
 *      - moveMapToPosition(map, position = null, duration = 1200, zoom = 10.5)
 *      - showError(message, colour = "#ff4d4f")
 *      - addClickListener(element, func, type)
 *      - removeDOMElement(element)
 *      - createRouteCard(routeName, formattedDate, distanceInKm, ETA, elevDisplayValue)
 *      - createNoRouteCard()
 *      - createStatsPanel(distanceDisplay, etaDisplay, elevationGain)
 */      



// GENERAL 

/**
 * Function to move the map to a specific coordinate or the centre of the map via an animation
 * 
 * @param {} map OL map instance 
 * @param {Array} position The specific coordinate to move the map to, if not entered it defaults to the map centre  
 * @param {number} duration How long the animation to move the map takes
 * @param {number} zoom Zoom level used by open layers 
 * @returns {void}
 */
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
 * Function used to show an error popup containing the passed in string 
 * 
 * @param {string} message The error message to be shown 
 * @param {*} colour The colour of the error popup, defaults to red 
 */
export function showError(message, colour = "#ff4d4f") {
    const container = document.getElementById("error-toast-container");

    const toast = document.createElement("div");
    toast.className = "error-toast";
    toast.textContent = message;
    toast.style.background = colour;

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

// DOM RELATED 

/**
 * 
 * Used to quickly add an event listener to skip the if statement 
 * 
 * @param {DOMElement} element 
 * @param {function} func 
 * @param {Event} type 
 */
export function addClickListener(element, func, type) {
  if (element) element.addEventListener(type, func);
}

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


// ROUTE CARDS 

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
                                      <span class="stat-label">Elevation Gain:</span>
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

/**
 * This returns a stats panel showing key details of the currently-displayed route 
 * 
 * @returns {string} HTML string for the stats panel showing key route details 
 */
export function createStatsPanel(distanceDisplay, etaDisplay, elevationGain) {
  return `
      <div class="stats-header">
          <span class="stats-title">Route Information</span>
          <button id="toggle-elevation-chart" class="stats-button">Elevation Profile</button>
      </div>
      <div id="stat-content-and-chart-container">
          <div class="stats-content">
              <div class="stat-row">
                  <span class="stat-label">Distance:</span>
                  <span class="stat-value" id="route-distance-display">${distanceDisplay}</span>
              </div>
              <div class="stat-row">
                  <span class="stat-label">ETA:</span>
                  <span class="stat-value" id="route-eta-display">${etaDisplay}</span>
              </div>
              <div class="stat-row">
                  <span class="stat-label">Elevation Gain:</span>
                  <span class="stat-value" id="route-elevation-gain-display">${elevationGain}</span>
              </div>
          </div>

          <div class="chart-wrapper"> 
              <div id="elevation-chart-container">
                  <canvas id="elevation-chart"></canvas>
              </div>
          </div>
      </div>
  `
}