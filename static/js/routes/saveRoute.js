import { getCurrentMode, 
  getCurrentPathData, 
  getLastKnownDistanceKm, 
  getLoadedRouteCoordinates, 
  hasElevation, 
  manualRouteState,
  extractElevation,
  extractElevationProfile,
  getElevationRange,
  setCurrentPathData, 
  normaliseCoordLength
 } from "./routeState.js";
import { defaultCentre, homeButtonFunction, updateSaveRouteContainer } from "../ui.js";
import { getMap } from "../map.js";
import { initSavedRoutesDashboard } from "./savedRoutesDashboard.js";
import { formatDistance } from "../utils.js";

let saveRouteForm = null;
const allRoutesContainer = document.getElementById("all-routes-container");


export function initSaveRoute() {
  saveRouteForm = document.getElementById("save-route-form");
  if (saveRouteForm) {
    saveRouteForm.addEventListener("submit", handleSaveRoute);
  }
}

function closeMessageDiv(messageDiv) {
  setTimeout(() => {
    messageDiv.style.display = 'none';
  }, 3000);
};

function handleSaveRoute(e) {
  e.preventDefault();

  const map = getMap();
  const routeName = document.getElementById("route-name")?.value;
  const format = document.getElementById("route-format")?.value;
  const messageDiv = document.getElementById("save-message");
  const eta = document.getElementById("route-eta-display")?.textContent;
  const elevationChange = document.getElementById("route-elevation-change-display")?.textContent;
  const allRoutesContainer = document.getElementById("all-routes-container");


  if (!messageDiv) return;

  messageDiv.innerHTML = '<span style="color: blue;">Saving route...</span>';

  let pathCoordinates = [];
  const mode = getCurrentMode();
  if (mode === "manual" && manualRouteState.pathCoords.length > 0) {
    pathCoordinates = manualRouteState.pathCoords;
  } else {
    pathCoordinates = getCurrentPathData() || getLoadedRouteCoordinates() || []; // coords in these arrays may now have elevation data
  }

  console.log("Before normalisation:", pathCoordinates.slice(0, 3)); // debug

  pathCoordinates = normaliseCoordLength(pathCoordinates);

  console.log("After normalisation:", pathCoordinates.slice(0, 3)); // debug

  if (pathCoordinates.length === 0) {
    messageDiv.innerHTML =
      '<span style="color: red;">No route data to save. Please create or load a route first.</span>';
    return;
  }

  const rawDistanceKm = getLastKnownDistanceKm();

  if (rawDistanceKm === null || isNaN(rawDistanceKm)) {
    messageDiv.innerHTML = '<span style="color: red;">No valid route distance to save.</span>';
  }

  const url = window.appConfig.apiSaveRouteUrl;

  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      route_name: routeName,
      format: format,
      coordinates: pathCoordinates,
      route_distance_km: rawDistanceKm,
      route_ETA: eta,
      elevation_change: elevationChange,
    }),
  })
    .then((response) => {
      if (!response.ok) {
        return response.json().then((errorData) => {
          throw new Error(
            errorData.message ||
              `Server responded with status ${response.status}`,
          );
        });
      }
      return response.json();
    })
    .then((data) => {
      if (data.success) {
        messageDiv.innerHTML = `<span style="color: green;">✓ ${data.message}</span>`;
        const routeNameInput = document.getElementById("route-name");
        if (routeNameInput) routeNameInput.value = "";

        const today = new Date();

        const formattedToday = new Intl.DateTimeFormat('en-GB', {
          "day": "2-digit",
          "month": "2-digit",
          "year": "2-digit"
        }).format(today);

        const routeCard = `<div class="route-card" data-route-name="${routeName}">
                              <div class="route-card-header">
                                  <h3 class="route-card-name">${routeName}</h3>
                                  <span class="route-card-date">Saved on ${formattedToday}</span>
                              </div>
                              <div class="route-card-stats">
                                  <div class="stat-item">
                                      <span class="stat-label">Distance:</span>
                                      <span class="stat-value" data-distance-km="${rawDistanceKm}">${formatDistance(rawDistanceKm)}</span>
                                  </div>
                                  <div class="stat-item">
                                      <span class="stat-label">ETA:</span>
                                      <span class="stat-value">${eta}</span>
                                  </div>
                                  <div class="stat-item">
                                      <span class="stat-label">Elevation Change:</span>
                                      <span class="stat-value">${elevationChange}</span>
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
        if (allRoutesContainer) allRoutesContainer.insertAdjacentHTML("beforeend", routeCard);
        homeButtonFunction();
      } else {
        messageDiv.innerHTML = `<span style="color: red;">${data.message}</span>`;
      }
    })
    .catch((error) => {
      messageDiv.innerHTML = `<span style="color: red;">Error saving route: ${error.message}</span>`;
      console.error("Error saving route:", error);
    })
    .finally(() => {
      closeMessageDiv(messageDiv);
      updateSaveRouteContainer();
    }) 
}
