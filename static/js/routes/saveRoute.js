import {
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

import {
  defaultCentre,
  homeButtonFunction,
  updateSaveRouteContainer,
  showLoginModal
} from "../ui/ui.js";

import { getMap } from "../map.js";

import { initSavedRoutesDashboard } from "./savedRoutesDashboard.js";

import {
  createRouteCard,
  removeDOMElement,
  showToast
} from "../utils/ui-utils.js"

import {
  formatDistance,
  formatElevation,
  formatETA
} from "../utils/format-utils.js"

import { toLonLat } from "ol/proj.js";

import localforage from "localforage";
import { logError } from "../utils/logError-utils.js";

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

async function handleSaveRoute(e) {
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

    if (! await handleUnauthenticatedUser(routeName)) return;

    pathCoordinates = getPathCoordinates();

    if (pathCoordinates.length === 0) {
      logError('Saving Route', "No coordinates found in pathCoords array", null, 'SAVE_ROUTE');
      throw new Error("No coords in pathCoords array", {cause : "Sorry, there was an error saving your route, please try again later."});
    }

    rawDistanceKm = getLastKnownDistanceKm();

    if (rawDistanceKm === null || isNaN(rawDistanceKm)) {
      logError('Saving Route', "No distance value / distance value is NaN", null, 'SAVE_ROUTE');
      throw new Error("No distance value", {cause : "Sorry, there was an error saving your route, please try again later."});
    }
  }
  catch (e) {
    logError('Saving Route', e.message || 'None', null, 'SAVE_ROUTE')
    showToast(e.cause || "Sorry, there was an error saving your route, please try again later.");
    return false;
  }

  try { 

    const url = window.appConfig.apiSaveRouteUrl;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        route_name: routeName,
        coordinates: pathCoordinates,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || response.status, {cause : data.user_message || "Sorry, there was an error saving your route, please try again later."});
    };

    if (!data.success) {
      throw new Error(data.message || response.status, {cause : data.user_message || "Sorry, there was an error saving your route, please try again later."});
    };

    if (routeNameEntry) routeNameEntry.value = "";

    const routeInfo = data.route_info;

    const today = new Date();

    const formattedToday = new Intl.DateTimeFormat('en-GB', {
      "day": "2-digit",
      "month": "2-digit",
      "year": "numeric"
    }).format(today);
    
    elevDisplayValue = routeInfo.elevation_gain_metres === 0 ? "No Data" : formatElevation(routeInfo.elevation_gain_metres);

    eta = formatETA(routeInfo.eta_seconds);
    
    if (noRouteCreateDiv) removeDOMElement(noRouteCreateDiv);   
    
    const formattedDistance = formatDistance(rawDistanceKm)

    const routeCard = createRouteCard(routeName, formattedToday, rawDistanceKm, formattedDistance, eta, elevDisplayValue);

    if (allRoutesContainer) allRoutesContainer.insertAdjacentHTML("beforeend", routeCard);
    homeButtonFunction();
    updateSaveRouteContainer();

  }
  catch (error) {
    showToast( error.cause || "Sorry, there was an error saving your route, please try again later.")
  }
};

/**
 * Retrieves and formats coordinates of a present path
 * 
 * @returns {Array<Array<number>>}
 */
function getPathCoordinates() {
  let pathCoordinates = [];
  
  if (manualRouteState.pathCoords.length > 0) {
    const webMercatorCoords = manualRouteState.pathCoords;

    pathCoordinates = webMercatorCoords.map(coord => {
      const lonLat = toLonLat([coord[0], coord[1]]);
      return coord.length >= 3 ? [lonLat[0], lonLat[1], coord[2]] : lonLat;
    });
  } else {
    pathCoordinates = getCurrentPathData() || getLoadedRouteCoordinates() || [];
  }

  return normaliseCoordLength(pathCoordinates);
}

/**
 * 
 * 
 * @returns {Boolean}
 */
async function handleUnauthenticatedUser(routeName) {
  if (!window.appConfig.loggedIn) {
    showLoginModal(true, 'save routes');
    await localforage.setItem("unauthenticated-save-route-attempt", true);
    await localforage.setItem("cachedRouteName", routeName);
    if (! await localforage.getItem('lastRoutingMode')) await localforage.setItem("lastRoutingMode", "manual");
    return false
  }
  return true
}