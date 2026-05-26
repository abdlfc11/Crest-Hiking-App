import { getMap, getRouteLayer, getPathColour } from "../map.js";
import { formatDistance, getRouteStrokeStyle, showToast } from "../utils.js";
import { clearLastLoadedRouteStats, getLastLoadedRouteStats, setCurrentPathData, setLastKnownDistanceKm, setLastLoadedRouteStats, setLoadedRouteCoordinates } from "./routeState.js";
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

  console.log(data.pathGeoJSON)

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

  console.log('First feature geometry:', features[0]?.getGeometry()?.getCoordinates().slice(0, 5));
  console.log('Extent:', vectorSource.getExtent());

  console.log(features)

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
  setLastLoadedRouteStats(data.route_stats)
  displayLoadedRouteStats(getLastLoadedRouteStats());
}

export function displayLoadedRouteStats(routeStats) {
  if (!routeStats) return;

  setLastKnownDistanceKm(routeStats.total_distance);

  const statsHtml = `
    <div id="route-stats">
      <div class="stats-header">
          <span class="stats-title">Route Information</span>
          <button id="toggle-elevation-chart" class="stats-button">Elevation Profile</button>
      </div>
      <div id="stat-content-and-chart-container">
          <div class="stats-content">
              <div class="stat-row">
                  <span class="stat-label">Distance:</span>
                  <span class="stat-value" id="route-distance-display">${formatDistance(parseFloat(routeStats.total_distance))}</span>
              </div>
              <div class="stat-row">
                  <span class="stat-label">ETA:</span>
                  <span class="stat-value" id="route-eta-display">${routeStats.eta}</span>
              </div>
              <div class="stat-row">
                  <span class="stat-label">Elevation Change:</span>
                  <span class="stat-value" id="route-elevation-change-display">${routeStats.elevation_change}</span>
              </div>
          </div>

          <div class="chart-wrapper"> 
              <div id="elevation-chart-container">
                  <canvas id="elevation-chart"></canvas>
              </div>
          </div>
      </div>
    </div>
  `;
  const existingStats = document.getElementById("route-stats");
  if (existingStats) existingStats.remove();
  document.body.insertAdjacentHTML("beforeend", statsHtml);
}