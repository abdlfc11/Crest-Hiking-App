import { getSavedPointStyle } from "./style.js";
import { getMap } from "../map.js";

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

function getSavedPoints() {
    
    const url = window.appConfig.apiGetSavedPointsUrl

    return fetch(url)
        .then(r => r.json());
}

export function loadAndDisplaySavedPoints() {
    clearOldSavedPointsLayer();

    getSavedPoints()
        .then(convertPointsToFeatures)
        .then(createSavedPointsLayer)
        .then(addLayerToMap)
        .catch(err => console.error("Error:", err))
}

export function saveNewPoint(coordinate, name) {
  const url = window.appConfig.apiSavePointUrl;
  const x = coordinate[0];
  const y = coordinate[1];

  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      point_name: name,
      web_mercator_x: x,
      web_mercator_y: y,
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
        alert(`Saved ${data.message}`);
        return loadAndDisplaySavedPoints();
      }
      alert(`Error saving point: ${data.message}`);
    })
    .catch((error) => {
      alert(`Could not save point: ${error.message}`);
      console.error("Fetch Error:", error);
    });
}