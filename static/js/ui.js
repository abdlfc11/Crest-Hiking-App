// ###########
// IMPORTS 
// ###########

import { roundCoords } from "./utils.js";
import { calculatePath } from "./routing.js";
import { getMap, onMapClick, onMapRenderComplete, initMap } from "./map.js";
import { loadAndDisplaySavedPoints } from "./saved_points/index.js";

initMap();

// ###########
// CONSTANTS / VARIABLES
// ###########

// map itself
const mapStyling = document.getElementById("map");

// map style
const mapContent = document.getElementById("map_content");

// setting start and end coordinates
const setStartCoordButton = document.getElementById('set-start-coord-button');
const setEndCoordButton = document.getElementById('set-end-coord-button');

const startCoordEntry = document.getElementById('start-point-entry');
const endCoordEntry = document.getElementById('end-point-entry');

let clickMode = null;

// nav bar

const openNavButton = document.getElementById('open-nav-button');
const closeNavButton = document.getElementById('close-nav-button')
const navBar = document.getElementById('the-sidenav')

// mode toggling

let currentMode = "auto";
const autoModeOption = document.getElementById("auto-mode-option");
const manualModeOption = document.getElementById("mode_manual"); 
const autoModeContent = document.getElementById("auto_mode_content");
const manualModeContent = document.getElementById("manual_mode_content");

// generating path btn

const generatePathButton = document.getElementById('generate-path-button')

// home button 
const autoHomeButton = document.getElementById('auto-home-button');
const manualHomeButton = document.getElementById('manual-home-button')


// ###########
// HELPER FUNCTIONS
// ###########

function addClickListner(DOMElement, func, type) {
    if (DOMElement) {
        DOMElement.addEventListener(type, func)
    }
}

function setStartCoord() {
    console.log('clicked start button');
    clickMode = "setStart";
    mapStyling.style.cursor = "crosshair";
}

function setEndCoord() {
    console.log('clicked end button');
    clickMode = "setEnd";
    mapStyling.style.cursor = "crosshair";
}

function setCoordEntry(DOMElement, event) {
    const coordinate = event.coordinate;
    const RoundedCoordinates = roundCoords(coordinate, 0);
    DOMElement.value = `${RoundedCoordinates[0]}, ${RoundedCoordinates[1]}`;
    clickMode = null;
    mapStyling.style.cursor = "default";
}

// ###########
// MAIN MAP CLICK FUNCTION
// ###########

export function mapClickHandler(event) {  

    if (clickMode === "setStart") {
        setCoordEntry(startCoordEntry, event)
    }

    if (clickMode === "setEnd") {
        setCoordEntry(endCoordEntry, event)
    }

    if (currentMode !== "auto") return;

    if (selectedPoint) {
        selectedPoint.setStyle(getSavedPointStyle(selectedPoint.get("name")));
        selectedPoint = null;
    }

    let featureClicked = false;
    let newSelection = null;

    map.forEachFeatureAtPixel(event.pixel, function (feature, layer) {
        if (
        layer === savedPointsLayer &&
        feature.getGeometry() instanceof ol.geom.Point
        ) {
        newSelection = feature;
        featureClicked = true;
        return true;
        }
    });

    if (newSelection) {
        selectedPoint = newSelection;
        const pointName = selectedPoint.get("name");

        selectedPoint.setStyle(getSelectedPointStyle(pointName));
        pointDeleteModalNameDisplay.textContent = pointName;

        showPointDeleteDialog(true)

    } else if (!featureClicked) {
        const coordinate = event.coordinate;
        const [lon, lat] = ol.proj.toLonLat(coordinate)
        const roundedLatLonCoords = roundCoords([lat, lon], 6);
        const pointName = prompt(
        `Do you want to save this coordinate: ${roundedLatLonCoords[0]}, ${roundedLatLonCoords[1]}? \nEnter a name to save it:`,
        );
        if (pointName) {
        saveNewPoint(coordinate, pointName);
        }
    }
};

// ###########
// NAV BAR FUNCTIONS
// ###########

function openNav() {
  navBar.style.width = "250px";
}

function closeNav() {
  navBar.style.width = "0";
}

// ###########
// SWITCHING BETWEEN AUTO AND MANUAL MODE
// ###########

function handleToggles (event) {
    manualModeOption.classList.remove("active");
    autoModeOption.classList.remove("active");
    event.currentTarget.classList.add("active");
};

// ###########
// LoadRouteVisibility 
// ###########

function updateLoadRouteVisibility() {
  const loadRouteDiv = document.getElementById("load_route");
  if (!loadRouteDiv) return;

  if (currentMode === "manual") {
    loadRouteDiv.style.display = "none";
  } else if (currentMode === "auto") {
    const hasPath =
      displayedPath !== null ||
      (currentPathData && currentPathData.length > 0) ||
      (loadedRouteCoordinates && loadedRouteCoordinates.length > 0);
    loadRouteDiv.style.display = hasPath ? "none" : "block";
  }
}

// ###########
// HOME & CLEAR ROUTE BUTTONS
// ###########

function homeButtonFunction() {
  endCoordEntry.classList.remove('input-error');
  startCoordEntry.classList.remove('input-error');
  startCoordEntry.placeholder = "Coordinates";
  endCoordEntry.placeholder = "Coordinates";
  generatePathButton.classList.remove('loading');
  clearManualRoute();

  const layersToRemove = [];
  map.getLayers().forEach((layer) => {
    if (layer instanceof ol.layer.Vector) {
      layersToRemove.push(layer);
    }
  });
  layersToRemove.forEach((layer) => map.removeLayer(layer));

  routeLayer = new ol.layer.Vector({
    source: new ol.source.Vector(),
    style: new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: getPathColor(),
        width: 5,
      }),
    }),
  });
  map.addLayer(routeLayer);

  const existingStats = document.getElementById("route-stats");
  if (existingStats) existingStats.remove();

  const view = map.getView();
  view.animate({
    center: defaultCenter,
    zoom: 10,
    duration: 1000,
  });

  startCoordEntry.value = "";
  endCoordEntry.value = "";
  searchEntry.value = "";
  selectedRouteDisplay.textContent = "Choose a route";
  selectedRouteName.value = "";
  selectedRouteType.value = "";
  document.querySelectorAll(".load-route-item").forEach((item) => item.classList.remove("selected"));

  const routeNameInput = document.getElementById("route_name");
  if (routeNameInput) routeNameInput.value = "";

  const messageDivs = document.querySelectorAll("#load_message, #save_message");
  messageDivs.forEach((div) => (div.innerHTML = ""));

  loadedRouteCoordinates = null;
  currentPathData = null;
  displayedPath = null;

  const saveRouteDiv = document.getElementById("save_route");
  if (saveRouteDiv) saveRouteDiv.style.display = "none";

  updateLoadRouteVisibility();
}

// on map render complete
function mapRenderComplete() {
    loadAndDisplaySavedPoints();
    refreshRouteList();
    updateLoadRouteVisibility();
}

// ###########
// EVENT LISTENERS
// ###########

// setting stard and end points
addClickListner(setStartCoordButton, setStartCoord, "click");
addClickListner(setEndCoordButton, setEndCoord, "click");

// navbar clicks

addClickListner(openNavButton, openNav, "click");
addClickListner(closeNavButton, closeNav, "click")

// mode toggles

addClickListner(autoModeOption, handleToggles, "mousedown");
addClickListner(manualModeOption, handleToggles, "mousedown");

// calculating path

addClickListner(generatePathButton, calculatePath, "click");

// map click handler function

onMapClick(mapClickHandler);

// map render complete handlers

onMapRenderComplete(mapRenderComplete())

// home button function


autoHomeButton.addEventListener("click", homeButtonFunction)
manualHomeButton.addEventListener("click", homeButtonFunction)

// toggle handlers

document.addEventListener("DOMContentLoaded", toggleHandlers);