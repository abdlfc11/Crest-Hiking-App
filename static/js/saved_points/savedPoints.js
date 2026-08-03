import { getSavedPointStyle } from "./style.js";
import { getMap } from "../map.js";
import { showLoginModal, showDeletePointModal } from "../ui.js";
import { showToast } from "../utils/ui-utils.js";
import { logError } from "../utils/logError-utils.js";

let savedPointsLayer = null;

export function getSavedPointsLayer() {
    return savedPointsLayer
}

function clearOldSavedPointsLayer() {
    if (savedPointsLayer) {
        
        const map = getMap();

        map.removeLayer(savedPointsLayer);
    } 
}

function convertPointsToFeatures(data) {
    return data.points.map(point => {

        // converts to Web Mercator (API sends coords in [Lon, Lat] format)
        const mercatorCoords = ol.proj.fromLonLat(point.coordinates);
        return new ol.Feature({
            geometry: new ol.geom.Point(mercatorCoords),
            name: point.name
        });
    });
};

function createSavedPointsLayer(features) {
    return new ol.layer.Vector({
        source: new ol.source.Vector({ features }),
        style: f => getSavedPointStyle(f.get("name")),
        zIndex: 1000
    });
};

function addLayerToMap(layer) {

    const map = getMap()

    map.addLayer(layer);
    savedPointsLayer = layer;
    return layer
}

async function getSavedPoints() {
    
    const url = window.appConfig.apiGetSavedPointsUrl;

    const response = await fetch(url);

    const data = await response.json();
    
    // e.g when FastAPI returns HTTPException, such as if authorisation failed 
    if (!response.ok) {
      throw new Error(data.message || "Failed to fetch points");
    }

    return data
}

export function loadAndDisplaySavedPoints() {

  // This is to ensure that no errors are thrown when a user is not logged in
  const isLoggedIn = window.appConfig.loggedIn
  if (!isLoggedIn) {
    return;
  }

  clearOldSavedPointsLayer();

  getSavedPoints()
      .then(convertPointsToFeatures)
      .then(createSavedPointsLayer)
      .then(addLayerToMap)
      .catch(err => {
        logError("Getting Saved Points", err.message, null, "GET_SAVED_POINT")
        showToast("Sorry, there was an unexpected error whilst displaying saved points.");
      })
}

export async function saveNewPoint(coordinate, name) {

  const isLoggedIn = window.appConfig.loggedIn
  if (!isLoggedIn) {
    showLoginModal(true);
    return;
  }

  const url = window.appConfig.apiSavePointUrl;

  // converts coordinates to lon lat if they aren't already in that projection
  const lonLat =
    Math.abs(coordinate[0]) <= 180 && Math.abs(coordinate[1]) <= 90
      ? [coordinate[0], coordinate[1]]
      : ol.proj.toLonLat([coordinate[0], coordinate[1]]);

  try {

    const response = await fetch(url, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          point_name: name,
          lon: lonLat[0],
          lat: lonLat[1],
        }),
      })
      
      const data = await response.json().catch(() => ({})); // .catch used to resolve errors safely, they are then caught later

      if (response.status === 401) {
        showLoginModal(true);
        return;
      }
      else if (!response.ok) {
        throw new Error(data.message || "No info to display")
      }

      if (data.success) {
          return loadAndDisplaySavedPoints();
        }
      throw new Error(data.message)
      return;
  }
  catch(error) {
    showToast(error.message || "There was an unexpected error whilst saving your point, try again later.");
    return false;
  }
}

export async function deleteSavedPoint(selectedPoint) {

  try { 
    if (!selectedPoint) {
      throw new Error("No point is currently selected for deletion.");
    }

    const pointName = selectedPoint.get("name");
    
    const response = await fetch(window.appConfig.apiDeletePointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ point_name: pointName }),
    });
    
    const data = await response.json();

    if (response.status === 401) {
      showDeletePointModal(false);
      showLoginModal(true);
      return;
    }
    else if (!response.ok) {
      showDeletePointModal(false);
      throw new Error(data.message || "There was an unexpected error whilst deleting your point, try again later.")
    }

    if (data.success) {
      showDeletePointModal(false);
      selectedPoint = null;
      loadAndDisplaySavedPoints();
      return;
    }
    else {
      showDeletePointModal(false);
      throw new Error(data.message || "There was an unexpected error whilst deleting your point, try again later.")
    }
  }
  catch(error) {
    logError("Deleting Point", error.message, null, "DELETE_POINT")
    showToast("There was an unexpected error whilst deleting your point, try again later.")
  }
}