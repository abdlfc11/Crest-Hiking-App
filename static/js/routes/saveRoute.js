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
import { createRouteCard, formatDistance, formatElevation, formatETA, removeDOMElement, showError } from "../utils.js";

let saveRouteForm = null;
const allRoutesContainer = document.getElementById("all-routes-container");
const routeNameEntry = document.getElementById("route-name");
const routeETADisplay = document.getElementById("route-eta-display");
const routeElevationDisplay = document.getElementById("route-elevation-change-display");
const noRouteCreateDiv = document.getElementById('no-routes-wrapper');



export function initSaveRoute() {
  saveRouteForm = document.getElementById("save-route-form");
  if (saveRouteForm) {
    saveRouteForm.addEventListener("submit", handleSaveRoute);
  }
}

function handleSaveRoute(e) {
  e.preventDefault();

  let elevDisplayValue; 
  let routeName = "";
  let eta = "";
  let elevationChange = "";
  let pathCoordinates = [];
  let rawDistanceKm;

  try {
    const map = getMap();
    routeName = routeNameEntry.value;
    eta = routeETADisplay?.textContent;
    elevationChange = routeElevationDisplay?.textContent


    const mode = getCurrentMode();
    if (mode === "manual" && manualRouteState.pathCoords.length > 0) {
      pathCoordinates = manualRouteState.pathCoords;
    } else {
      pathCoordinates = getCurrentPathData() || getLoadedRouteCoordinates() || []; // coords in these arrays may now have elevation data
    }

    pathCoordinates = normaliseCoordLength(pathCoordinates);

    if (pathCoordinates.length === 0) {
      console.error("No coordinates found in pathCoords array")
      showError("There was an error saving your route. Please try again later.");
      return false;
    }

    rawDistanceKm = getLastKnownDistanceKm();

    if (rawDistanceKm === null || isNaN(rawDistanceKm)) {
      console.error("No valid route distance to save");
      showError("There was an error saving your route. Please try again later.");
      return false;
    }
  }
  catch (e) {
    console.error(`Error whilst saving route: ${e}`)
    showError("There was an error saving your route. Please try again later.");
    return false;
  }

  const url = window.appConfig.apiSaveRouteUrl;

  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      route_name: routeName,
      coordinates: pathCoordinates,
      type: "route-generation"
    }),
  })
    .then((response) => {
      if (!response.ok) {
        showError("There was an error saving your route. Please try again later.")
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
        const routeNameInput = document.getElementById("route-name");
        if (routeNameInput) routeNameInput.value = "";

        const routeInfo = data.route_info;

        const today = new Date();

        const formattedToday = new Intl.DateTimeFormat('en-GB', {
          "day": "2-digit",
          "month": "2-digit",
          "year": "2-digit"
        }).format(today);
        
        elevDisplayValue = formatElevation(elevationChange);

        eta = formatETA(routeInfo.eta_seconds);

        if (noRouteCreateDiv) removeDOMElement(noRouteCreateDiv);        

        const routeCard = createRouteCard(routeName, formattedToday, rawDistanceKm, eta, elevDisplayValue)

        if (allRoutesContainer) allRoutesContainer.insertAdjacentHTML("beforeend", routeCard);
        homeButtonFunction();
        updateSaveRouteContainer();
      } else {
        showError("There was an error saving your route. Please try again later.")
        console.error(data.message)
        return false;
      }
    })
    .catch((error) => {
      showError("There was an error saving your route. Please try again later.")
      console.error("Error saving route:", error);
      return false;
    })
}
