import { getSavedPointStyle } from "./style.js";
import { getMap } from "../map.js";

let savedPointsLayer = null;

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
    return fetch(apiGetSavedPointsUrl)
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