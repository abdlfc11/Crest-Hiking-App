import { getMap } from "./map.js";
import { routeLayer, setRouteLayer, getRouteLayer } from "./routing.js";

export let tileLayer = null;

// create tile layer

export function createTileLayer() {
  tileLayer = new ol.layer.Tile({
    source: new ol.source.XYZ({
      url: "https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png",
      attributions: `Map data: © <a href="https://www.openstreetmap.org/copyright/">OpenStreetMap</a>,
      SRTM 
      | 
      Map style: © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)`,
      maxZoom: 17,
    }),
  });
};

export function AddRouteLayer() {

  const map = getMap() // gets the map from the map.js file

  setRouteLayer(new ol.layer.Vector({
    source: new ol.source.Vector(),
    style: new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: getPathColor(),
        width: 5,
      }),
    }),
  }));
  map.addLayer(getRouteLayer());
}

function getPathColor() {
  return "#2563eb"; // blue
}
