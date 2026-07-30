import { getSavedPointStyle } from "./style.js";
import { getMap } from "../map.js";
import { showLoginModal, showDeletePointModal } from "../ui.js";
import { showError } from "../utils/ui-utils.js";

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
        return new ol.Feature({
            geometry: new ol.geom.Point(point.coordinates),
            name: point.name
        });
    });
};

function createSavedPointsLayer(features) {
    return new ol.layer.Vector({
        source: new ol.source.Vector({ features }),
        style: f => getSavedPointStyle(f.get("name"))
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

    const response = await fetch(url)
    
    // e.g when FastAPI returns HTTPException, such as if authorisation failed 
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail?.message || "Failed to fetch points");
    }

    return await response.json();
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
      .catch(err => showError(err.message || "Sorry, there was an unexpected error displaying saved points."))
}

export async function saveNewPoint(coordinate, name) {

  const isLoggedIn = window.appConfig.loggedIn
  if (!isLoggedIn) {
    showLoginModal(true);
    return;
  }

  const url = window.appConfig.apiSavePointUrl;
  const x = coordinate[0];
  const y = coordinate[1];

  try {

    const response = await fetch(url, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          point_name: name,
          web_mercator_x: x,
          web_mercator_y: y,
        }),
      })
      
      const data = await response.json();

      if (response.status === 401) {
        showLoginModal(true);
        return;
      }
      else if (!response.ok) {
        throw new Error(data.detail.message || "There was an unexpected error whilst saving your point, try again later.")
        return;
      }

      if (data.success) {
          return loadAndDisplaySavedPoints();
        }
      showError(data.message || "There was an error on our end, please try again later.");
      return;
  }
  catch(error) {
    console.log(error)
    showError(error.message);
    return false;
  }
}

export async function deleteSavedPoint(selectedPoint) {
  if (!selectedPoint) {
    showError("Error: No point is currently selected for deletion.");
    return;
  }

  try { 

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
      throw new Error(data.detail.message || "There was an unexpected error whilst deleting your point, try again later.")
      return;
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
    showError(error.message)
  }
}