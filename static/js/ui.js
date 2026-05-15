// ###########
// IMPORTS 
// ###########

import { roundCoords } from "./utils.js";
import { calculatePath } from "./routing/routing.js";
import { routingStateObject } from "./routing/routingValues.js";
import { getMap, onMapClick, onMapRenderComplete, initMap, refreshRouteList } from "./map.js";
import { loadAndDisplaySavedPoints, getSavedPointsLayer } from "./saved_points/index.js";
import { getRouteLayer, getPathColour, routeLayer, setRouteLayer } from "./layers.js";

initMap();

// ###########
// CONSTANTS / VARIABLES
// ###########

// default centre
const defaultCentre = [-357428, 7256794]

// map variable
const map = getMap();

// map element
const mapStyling = document.getElementById("map");

// map style
const mapContent = document.getElementById("map_content");

// searching for areas 
const searchEntry = document.getElementById('search-entry');

// setting start and end coordinates
const setStartCoordButton = document.getElementById('set-start-coord-button');
const setEndCoordButton = document.getElementById('set-end-coord-button');

const startCoordEntry = document.getElementById('start-point-entry');
const endCoordEntry = document.getElementById('end-point-entry');

let clickMode = null;

// nav bar
const openNavButton = document.getElementById('open-nav-button');
const closeNavButton = document.getElementById('close-nav-button');
const navBar = document.getElementById('the-sidenav');

// mode toggling
const autoModeOption = document.getElementById("auto-mode-option");
const manualModeOption = document.getElementById("mode_manual"); 
const autoModeContent = document.getElementById("auto_mode_content");
const manualModeContent = document.getElementById("manual_mode_content");

// generating path btn
const generatePathButton = document.getElementById('generate-path-button');

// manual mode
let manualRouteClickHandler = null;

// home button 
const autoHomeButton = document.getElementById('auto-home-button');
const manualHomeButton = document.getElementById('manual-home-button');

// search for area button
const searchForAreaButton = document.getElementById('search-for-area-button');

// load route modal
const selectedRouteDisplay = document.getElementById('selected-route-display')
const selectedRouteName = document.getElementById('selected-route-name')
const selectedRouteType = document.getElementById('selected-route-type')

// ###########
// INITIAL SETTINGS
// ###########

mapStyling.style.cursor = "grab";


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
    mapStyling.style.cursor = "grab";
}

// ###########
// MAIN MAP CLICK FUNCTION
// ###########


function handleCursor() {
  if (clickMode === "setStart" || clickMode === "setEnd") {
    mapStyling.style.cursor = "crosshair"
  }
  mapStyling.style.cursor = "grab"
}

export function mapClickHandler(event) {  

    if (clickMode === "setStart") {
        setCoordEntry(startCoordEntry, event)
    }

    if (clickMode === "setEnd") {
        setCoordEntry(endCoordEntry, event)
    }

    if (routingStateObject.currentMode !== "auto") return;

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

// switch to automatic mode

function switchToAutoMode() {

  mapStyling.style.cursor = "grab";
  routingStateObject.currentMode = "auto";
  autoModeOption.classList.add("active");
  manualModeOption.classList.remove("active");

  autoModeContent.style.display = "block";
  manualModeContent.style.display = "none";

  if (manualRouteClickHandler) {
    map.un("click", manualRouteClickHandler);
    manualRouteClickHandler = null;
  }

  map.on("click", mapClickHandler);

  

  clearManualRoute();
  clearAutoRoute();

  updateLoadRouteVisibility();
}

// switch to manual mode

function switchToManualMode() {
  mapStyling.style.cursor = "crosshair"
  routingStateObject.currentMode = "manual";
  manualModeOption.classList.add("active");
  autoModeOption.classList.remove("active");

  autoModeContent.style.display = "none";
  manualModeContent.style.display = "block";

  map.un("click", mapClickHandler);

  routingStateObject.manualRouteClickHandler = function (event) {
    const coordinate = event.coordinate;
    addManualPoint(coordinate[0], coordinate[1]);
  };
  map.on("click", manualRouteClickHandler);

  clearAutoRoute();

  updateLoadRouteVisibility();
}

// ###########
// LoadRouteVisibility 
// ###########

function updateLoadRouteVisibility() {
  const loadRouteDiv = document.getElementById("load_route");
  if (!loadRouteDiv) return;

  if (routingStateObject.currentMode === "manual") {
    loadRouteDiv.style.display = "none";
  } else if (routingStateObject.currentMode === "auto") {
    const hasPath =
      routingStateObject.displayedPath !== null ||
      (routingStateObject.currentPathData && routingStateObject.currentPathData.length > 0) ||
      (routingStateObject.loadedRouteCoordinates && routingStateObject.loadedRouteCoordinates.length > 0);
    loadRouteDiv.style.display = hasPath ? "none" : "block";
  }
}

// ###########
// HOME & CLEAR ROUTE BUTTONS
// ###########

function clearManualRoute() {
  routingStateObject.userClicks = [];
  routingStateObject.pathCoords = [];
  routingStateObject.manualRoutePoints = [];
  if (routingStateObject.manualRouteLayer) {
    map.removeLayer(routingStateObject.manualRouteLayer);
    routingStateObject.manualRouteLayer = null;
  }

  const existingStats = document.getElementById("route-stats");
  if (existingStats) {
    existingStats.remove();
  }

  const saveRouteDiv = document.getElementById("save_route");
  if (saveRouteDiv && routingStateObject.currentMode === "manual") {
    saveRouteDiv.style.display = "none";
  }

  routingStateObject.loadedRouteCoordinates = null;
  routingStateObject.currentPathData = null;

  if (routingStateObject.displayedPath) {
    map.removeLayer(routingStateObject.displayedPath);
    routingStateObject.displayedPath = null;
  }

  if (getRouteLayer()) {
    const routeLayer = getRouteLayer()
    routeLayer.getSource().clear();
  }

  map.getLayers().getArray().slice().forEach((layer) => {
      if (layer instanceof ol.layer.Vector && layer !== getSavedPointsLayer()) {
        if (layer.getSource()) {
          layer.getSource().clear();
        }
      }
    }
  );

  updateLoadRouteVisibility();
}

function homeButtonFunction() {

  console.log("map variable set")

  endCoordEntry.classList.remove('input-error');
  startCoordEntry.classList.remove('input-error');
  startCoordEntry.placeholder = "Coordinates";
  endCoordEntry.placeholder = "Coordinates";
  generatePathButton.classList.remove('loading');
  clearManualRoute();

  console.log("emptied inputs")

  const layersToRemove = [];
  map.getLayers().forEach((layer) => {
    if (layer instanceof ol.layer.Vector) {
      layersToRemove.push(layer);
    }
  });
  layersToRemove.forEach((layer) => map.removeLayer(layer));

  console.log("removed map layers")

  setRouteLayer(new ol.layer.Vector({
    source: new ol.source.Vector(),
    style: new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: getPathColour(),
        width: 5,
      }),
    }),
  }));
  map.addLayer(routeLayer);

  console.log("added the new route layer")

  const existingStats = document.getElementById("route-stats");
  if (existingStats) {existingStats.remove()};

  console.log("removed stats pop up")

  const view = map.getView();
  view.animate({
    center: defaultCentre,
    zoom: 10,
    duration: 1000,
  });

  console.log("moved map to centre")

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

  routingStateObject.loadedRouteCoordinates = null;
  routingStateObject.currentPathData = null;
  routingStateObject.displayedPath = null;

  const saveRouteDiv = document.getElementById("save_route");
  if (saveRouteDiv) saveRouteDiv.style.display = "none";

  updateLoadRouteVisibility();
}

// ###########
// SEARCHING FOR AN AREA
// ###########

function searchArea() {
  
  const area = searchEntry.value;

  fetch(apiSearchAreaUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ search_input: area }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        const view = map.getView();
        if (view.getZoom() >= 7) {
          view.animate(
            {
              center: view.getCenter(),
              duration: 1000,
              zoom: 10,
            },
            () =>
              view.animate({
                center: data.coordinates,
                duration: 1000,
                zoom: 14,
              }),
          );
        } else {
          view.animate({
            center: data.coordinates,
            duration: 1000,
            zoom: 14,
          });
        }
      }
    })
    .catch((error) => {
      console.log("Error: ", error);
    });
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

// map grabs
mapStyling.addEventListener("mouseup", () => {mapStyling.style.cursor = "grab"})
mapStyling.addEventListener("mousedown", () => {mapStyling.style.cursor = "grabbing"});

// setting stard and end points
addClickListner(setStartCoordButton, setStartCoord, "click");
addClickListner(setEndCoordButton, setEndCoord, "click");

// navbar clicks

addClickListner(openNavButton, openNav, "click");
addClickListner(closeNavButton, closeNav, "click")

// mode toggles

addClickListner(autoModeOption, handleToggles, "click");
addClickListner(manualModeOption, handleToggles, "click");

// calculating path

addClickListner(generatePathButton, calculatePath, "click");

// map click handler function

onMapClick(mapClickHandler);

// map render complete handlers

onMapRenderComplete(mapRenderComplete)

// home button function


autoHomeButton.addEventListener("click", homeButtonFunction)
manualHomeButton.addEventListener("click", homeButtonFunction)

// toggle handlers

document.addEventListener("DOMContentLoaded", handleToggles);