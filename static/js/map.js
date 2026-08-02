import {
  getRouteStrokeStyle
} from "./utils/style-utils.js"

export let map = null;
export let tileLayer = null;
export let routeLayer = null;

let mapInitialised = false;

export function getMap() {
  return map;
}

export function setRouteLayer(layer) {
  routeLayer = layer;
}

export function getRouteLayer() {
  return routeLayer;
}

export function routeLayerHasFeatures() {
  const source = getRouteLayer()?.getSource();
  return Boolean(source && source.getFeatures().length > 0);
}

export function getTileLayer() {
  return tileLayer;
}

export function setTileLayer(layer) {
  tileLayer = layer;
}

export function initMap() {
  if (mapInitialised) return;
  mapInitialised = true;
  createTileLayer();
  createMap();
  createRouteLayer();
}

function createMap() {
  const initialCentreLatLon = Array.isArray(window.appConfig?.mapInitialCentre)
    ? window.appConfig.mapInitialCentre
    : [-3.198308, 54.465458];
  const initialCentre = ol.proj.fromLonLat(initialCentreLatLon);
  const initialZoom = window.appConfig?.mapInitialZoom ?? 10.5;

  map = new ol.Map({
    layers: [tileLayer],
    target: "map",
    controls: ol.control.defaults.defaults({
      attributionOptions: {
        collapsible: false
      }
    }),
    view: new ol.View({
      projection: "EPSG:3857",
      maxZoom: 17,
      minZoom: 0,
      center: initialCentre,
      zoom: initialZoom,
    }),
  });
}

export function onMapClick(handler) {
  const m = getMap();
  if (m) m.on("click", handler);
}

export function onMapRenderComplete(handler) {
  const m = getMap();
  if (m && typeof handler === "function") {
    m.once("rendercomplete", handler);
  }
}

export function createTileLayer() {
  tileLayer = new ol.layer.Tile({
    source: new ol.source.XYZ({
      url: "https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png",
      attributions: `
      <a href="https://docs.crestr.co.uk/privacy-policy/privacy_policy/" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
      |
      Map data: © <a href="https://www.openstreetmap.org/copyright/">OpenStreetMap</a>,
      SRTM
      |
      Map style: © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)
      `,
      maxZoom: 17,
    }),
  });
}

export function createRouteLayer() {
  routeLayer = new ol.layer.Vector({
    source: new ol.source.Vector(),
    style: new ol.style.Style({
      stroke: new ol.style.Stroke(getRouteStrokeStyle()),
    }),
    zIndex: 999,
  });

  const m = getMap();
  if (m) m.addLayer(routeLayer);
  else console.error("Could not add routeLayer to the map");
}

export function getPathColour() {
  return "#2563eb";
}

async function initApp() {
  initMap();
  await import("./auth/auth.js");
  const { initSettings } = await import("./settings.js");
  initSettings();
  const { initUi } = await import("./ui.js");
  initUi();
}

document.addEventListener("DOMContentLoaded", initApp);
