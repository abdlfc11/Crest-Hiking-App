import { getMap, getRouteLayer, getPathColour } from "../map.js";

import {
  formatDistance,
  formatElevation,
  formatETA
} from "../utils/format-utils.js"

import {
  getRouteStrokeStyle,
  createManualPointStyle
} from "../utils/style-utils.js"

import {
  createStatsPanel
} from "../utils/ui-utils.js"

import { clearLastLoadedRouteStats, getLastLoadedRouteStats, setCurrentPathData, setLastKnownDistanceKm, setLastLoadedRouteStats, setLoadedRouteCoordinates } from "./routeState.js";

import { deleteRoute, loadRoute } from "./routeApi.js";

import { initChartToggleListener } from "../elevationChart.js";
import { getSavedPointStyle } from "../saved_points/style.js";


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
    dataProjection: "EPSG:4326",
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

  // converts lon lat to Web Mercator to display features on OpenLayer map (which has Web Mercator projection) 
  const startMercator = ol.proj.fromLonLat([startCoord[0], startCoord[1]]);
  const endMercator = ol.proj.fromLonLat([endCoord[0], endCoord[1]]);

  const startFeature = new ol.Feature({
    geometry: new ol.geom.Point(startMercator)
  });
  startFeature.setStyle(getSavedPointStyle("Start", "#00A86B"));

  const endFeature = new ol.Feature({
    geometry: new ol.geom.Point(endMercator)
  });
  endFeature.setStyle(getSavedPointStyle("End", "#D32F2F"));



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

  let statsDiv = document.getElementById("route-stats");

  if (statsDiv) {
    statsDiv.remove();
  };

  statsDiv = document.createElement("div");
  statsDiv.id = "route-stats";
  document.body.appendChild(statsDiv);

  statsDiv.innerHTML = createStatsPanel(formatDistance(parseFloat(routeStats.total_distance)), formatETA(routeStats.eta_seconds), formatElevation(routeStats.elevation_change))
}