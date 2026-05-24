import { getMap, getRouteLayer, getPathColour } from "../map.js";
import { formatDistance, getRouteStrokeStyle, showToast } from "../utils.js";
import { setCurrentPathData, setLastKnownDistanceKm, setLoadedRouteCoordinates } from "./routeState.js";
import { deleteRoute, loadRoute, fetchRoutes } from "./routeApi.js";


let routeList = null;
let selectedRouteDisplay = null;
let selectedRouteName = null;
let selectedRouteType = null;
let loadMessage = null;
let loadRouteButton = null;
let loadRouteDropdown = null;

let onRouteLoaded = null;
let updateLoadRouteVisibilityCallback = null;


export function displayLoadedRouteOnMap(data) {
  const map = getMap();
  const routeLayer = getRouteLayer();
  if (!map || !routeLayer) return;

  const vectorSource = routeLayer.getSource();
  vectorSource.clear();

  const format = new ol.format.GeoJSON();
  const features = format.readFeatures(data.pathGeoJSON, {
    dataProjection: "EPSG:3857",
    featureProjection: "EPSG:3857",
  });

  features.forEach((feature) => {
    feature.setStyle(
      new ol.style.Style({
        stroke: new ol.style.Stroke(getRouteStrokeStyle()),
      }),
    );
  });

  vectorSource.addFeatures(features);

  const view = map.getView();
  if (view.getZoom() >= 6) {
    view.animate(
      { center: view.getCenter(),
        duration: 1000,
        zoom: 10 
      },
      () => view.fit(vectorSource.getExtent(), {
              size: map.getSize(),
              padding: [50, 100, 100, 430],
              duration: 1000,
            }),
    );
  } else {
    map.getView().fit(vectorSource.getExtent(), {
      size: map.getSize(),
      padding: [50, 50, 50, 50],
      duration: 1000,
    });
  }

  if (!data.route_stats) return;

  setLastKnownDistanceKm(data.route_stats.total_distance);

  const statsHtml = `
    <div id="route-stats">
      <div class="stats-header">
        <span class="stats-title">Route Information</span>
      </div>
      <div class="stats-content">
        <div class="stat-row">
          <span class="stat-label">Distance:</span>
          <span class="stat-value">${formatDistance(parseFloat(data.route_stats.total_distance))}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">ETA:</span>
          <span class="stat-value">${data.route_stats.eta}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Elevation Change:</span>
          <span class="stat-value" id="route-elevation-change-display">${data.route_stats.elevation_change || "N/A"}</span>
        </div>
      </div>
    </div>
  `;

  const existingStats = document.getElementById("route-stats");
  if (existingStats) existingStats.remove();
  document.body.insertAdjacentHTML("beforeend", statsHtml);
}
