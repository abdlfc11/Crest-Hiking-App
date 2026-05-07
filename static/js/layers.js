export let tileLayer = null;
export let routeLayer = null; // layer for loaded routes

// helper functions 

export function setRouteLayer(layer) {
    routeLayer = layer;
};

export function getRouteLayer() {
    return routeLayer;
};

export function getTileLayer() {
  return tileLayer

};

export function setTileLayer(layer) {
  tileLayer = layer;
};

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

export function createRouteLayer() {

  setRouteLayer(new ol.layer.Vector({
    source: new ol.source.Vector(),
    style: new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: getPathColor(),
        width: 5,
      }),
    }),
  }));
}

function getPathColor() {
  return "#2563eb"; // blue
}
