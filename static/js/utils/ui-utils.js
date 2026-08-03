/**
 * This file is intended to hold all UI related helper functions
 * As of August 2026 this file hold the following functions:
 *      
 *      - moveMapToPosition(map, position = null, duration = 1200, zoom = 10.5)
 *      - showToast(message, type = "error", modal = null)
 *      - addClickListener(element, func, type)
 *      - removeDOMElement(element)
 *      - createRouteCard(routeName, formattedDate, distanceInKm, ETA, elevDisplayValue)
 *      - createNoRouteCard()
 *      - createStatsPanel(distanceDisplay, etaDisplay, elevationGain)
 *      - parseCoordString(value)
 */      



// GENERAL 

/**
 * Parses a coordinate string in the form "X, Y" (or "X,Y").
 * Returns [x, y] as numbers or null if the format is invalid.
 * Never throws.
 */
export function parseCoordString(value) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(/\s*,\s*/);
  if (parts.length !== 2) return null;

  const x = Number(parts[0]);
  const y = Number(parts[1]);

  if (!x || !y) return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  return [x, y];
}

/**
 * Function to move the map to a specific coordinate or the centre of the map via an animation
 * 
 * Position is expected in EPSG:4326 ( [Lon, Lat] )
 * It is converted to Web Mercator before animating the map movement (OpenLayers map is in a Web Mercator projection)
 * 
 * @param {ol.Map} map OL map instance 
 * @param {Array} position The specific coordinate to move the map to in [Lon, Lat] format, if not entered it defaults to the map centre  
 * @param {number} duration How long the animation to move the map takes
 * @param {number} zoom Zoom level used by open layers 
 * @returns {void}
 */
export function moveMapToPosition(map, position = null, duration = 1200, zoom = 10.5) {
  if (!map) {
    console.warn("No map, returning");
    return;
  }

  const targetLatLon = Array.isArray(position) && position.length === 2
    ? position
    : (Array.isArray(window.appConfig?.mapInitialCentre) ? window.appConfig.mapInitialCentre : [-3.198308, 54.465458]);

  // this converts [Lon, Lat] coordinates into Web Mercator coordinates that the OpenLayers map can use 
  const targetPosition = ol.proj.fromLonLat(targetLatLon);

  map.getView().animate({
    center: targetPosition,
    zoom: zoom,
    duration: duration
  })
};

/**
 * Shows a toast notification 
 *
 * @param {string} message The message to be shown in the toast body
 * @param {("error"|"success"|"warning"|"info")} [type="error"] The toast type, controls the status icon and accent colour
 * @param {HTMLDialogElement|boolean|null} [modal=null] If a dialog element is passed, the toast is rendered inside it, otherwise, if `null`/`false`, the main app toast container is used.
 * @returns {void}
 */
export function showToast(message, type = "error", modal = null) {

    // this defines the status icons
    const icons = {
        error: "!",
        success: "\u2713",
        warning: "!",
        info: "i",
    };

    // this defines the titles per toast type 
    const titles = {
        error: "Error",
        success: "Success",
        warning: "Warning",
        info: "Info",
    };

    // this retrieves the modal element (if any) 
    let modalElement = null;

     if (modal instanceof HTMLElement) {
        modalElement = modal;
    }

    // this determines the container i.e within a modal or the main app
    let container;

    if (modalElement) {
        // this finds or creates the container 
        container = modalElement.querySelector(".toast-container--modal");

        if (!container) {
            container = document.createElement("div");
            container.className = "toast-container--modal";
            modalElement.appendChild(container);
        }
    } else {
        container = document.getElementById("error-toast-container");
    }

    if (!container) {
        console.warn("showToast: no toast container found");
        return;
    }

    // this builds the toast element 
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.setAttribute("data-type", type);
    toast.setAttribute("role", "alert");
    toast.setAttribute("aria-live", "assertive");

    // this defines the status icon
    const icon = document.createElement("span");
    icon.className = "toast-icon";
    icon.textContent = icons[type] || icons.error;
    icon.setAttribute("aria-hidden", "true");

    // this defines the content (title + message)
    const content = document.createElement("div");
    content.className = "toast-content";

    const titleElement = document.createElement("span");
    titleElement.className = "toast-title";
    titleElement.textContent = titles[type] || titles.error;

    const messageElement = document.createElement("span");
    messageElement.className = "toast-message";
    messageElement.textContent = message;

    content.appendChild(titleElement);
    content.appendChild(messageElement);

    // this defines the dismisses (X) button
    const closeButton = document.createElement("button");
    closeButton.className = "toast-close";
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Dismiss notification");
    closeButton.innerHTML = "&times;";

    // this defines the auto-dismiss progress bar
    const progress = document.createElement("div");
    progress.className = "toast-progress";

    toast.appendChild(icon);
    toast.appendChild(content);
    toast.appendChild(closeButton);
    toast.appendChild(progress);
    container.appendChild(toast);

    // this makes the popup hide after 3s
    const hideTimeout = setTimeout(removeToast, 3000);

    // Helper to remove the toast (used by both the timeout and the close button)
    function removeToast() {
        clearTimeout(hideTimeout);
        toast.classList.add("hide");
        toast.classList.remove("show");

        // this removes it from the DOM once the hide animation is done
        setTimeout(() => {
            toast.remove();
            // this cleans up a modal-scoped container if it is empty
            if (container.classList.contains("toast-container--modal") && container.childElementCount === 0) {
                container.remove();
            }
        }, 300);
    } 

    // this triggers the slide-in animation of the toast
    requestAnimationFrame(() => {
        toast.classList.add("show");
    });

    closeButton.addEventListener("click", removeToast);
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
 * Replaces any character within passed in string that interfere with HTML and returns the edited string
 * 
 * @param {string} value The string to be checked to ensure it does not interfere with HTML
 * @returns {string} The safe string which can be placed into 
 */
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&`#39`;"
  })[c]);
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
 * @param {string} formattedDistance: String showing formatted distance 
 * @param {string} ETA: Formatted estimated time to complete the route.
 * @param {string} elevDisplayValue: Pre-formatted elevation change string for display.
 * @returns {string} HTML string for the complete route card.
 */
export function createRouteCard(routeName, formattedDate, distanceInKm, formattedDistance, ETA, elevDisplayValue) {

    const safeRouteName = escapeHtml(routeName)

    return `<div class="route-card" data-route-name="${safeRouteName}">
                                <div class="route-card-header">
                                    <h3 class="route-card-name">${safeRouteName}</h3>
                                    <span class="route-card-date">Saved on ${formattedDate}</span>
                                </div>
                                <div class="route-card-stats">
                                    <div class="stat-item">
                                        <span class="stat-label">Distance:</span>
                                        <span class="stat-value" data-distance-km="${distanceInKm}">${formattedDistance}</span>
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