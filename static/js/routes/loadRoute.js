import { getMap, getRouteLayer, getPathColour } from "../map.js";
import { formatDistance, getRouteStrokeStyle, showToast, createManualPointStyle } from "../utils.js";
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

  const coordinates = data.coordinates;

  const startCoord = coordinates[0];
  const endCoord = coordinates[coordinates.length - 1]


  const startFeature = new ol.Feature({
    geometry: new ol.geom.Point([startCoord[0], startCoord[1]])
  });
  startFeature.setStyle(createManualPointStyle("Start", "#8145d4"));

  const endFeature = new ol.Feature({
    geometry: new ol.geom.Point([endCoord[0], endCoord[1]])
  });
  endFeature.setStyle(createManualPointStyle("End", "#8145d4"));



  vectorSource.addFeatures(features);
  vectorSource.addFeature(startFeature);
  vectorSource.addFeature(endFeature);

  const view = map.getView();

  // if zoom is greater than 10.5 (zoomed in)
  if (view.getZoom() > 11) {

    // zoom out slightly 
    view.animate(
      { center: view.getCenter(),
        duration: 1000,
        zoom: 10.5 
      }, 
      
      // then zoom into the route
      function(complete) {
        if (complete) {
          view.fit(vectorSource.getExtent(), {
            size: map.getSize(),
            padding: [50, 100, 100, 430],
            duration: 1000
          })
        }
      }
    );
  } 
  
  // otherwise, zoom into the route immediately
  else {
    map.getView().fit(vectorSource.getExtent(), {
      size: map.getSize(),
      padding: [50, 100, 100, 430],
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