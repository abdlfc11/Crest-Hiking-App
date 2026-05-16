// ###########
// IMPORTS 
// ###########

import { roundCoords, createManualPointStyle } from "./utils.js";
import { calculatePath } from "./routing/routing.js";
import { getMap, onMapClick, onMapRenderComplete, initMap, refreshRouteList } from "./map.js";
import { loadAndDisplaySavedPoints, getSavedPointsLayer } from "./saved_points/index.js";
import { getRouteLayer, getPathColour, routeLayer, setRouteLayer } from "./layers.js";

initMap();

// #region CONSTANTS / VARS

// #region VALUES 

// default centre
const defaultCentre = [-357428, 7256794]

// #endregion

// #region BUTTONS

// search for area button
const searchForAreaButton = document.getElementById('search-for-area-button');

// switching between auto and manual mode buttons
const autoModeOption = document.getElementById("auto-mode-option");
const manualModeOption = document.getElementById("mode_manual"); 

// setting start and end coordinates
const setStartCoordButton = document.getElementById('set-start-coord-button');
const setEndCoordButton = document.getElementById('set-end-coord-button');

// nav bar buttons
const openNavButton = document.getElementById('open-nav-button');
const closeNavButton = document.getElementById('close-nav-button');

// home buttons
const autoHomeButton = document.getElementById('auto-home-button');
const manualHomeButton = document.getElementById('manual-home-button');

// generating path btn
const generatePathButton = document.getElementById('generate-path-button');

// deleting points
const pointDeleteDeleteButton = document.getElementById("point-delete-delete-button");
const pointDeleteExitButton = document.getElementById("point-delete-exit-button");

// clearing route

const clearAutoRouteButton = document.getElementById('clear-auto-route-button')// auto mode


// #endregion

// #region MAP ITEMS

// map variable
const map = getMap();

// map element
const mapStyling = document.getElementById("map");

// map style
const mapContent = document.getElementById("map_content");

// #endregion

// #region ENTRIES

// searching for areas 
const searchEntry = document.getElementById('search-entry');

// start and end coordinate inputs
const startCoordEntry = document.getElementById('start-point-entry');
const endCoordEntry = document.getElementById('end-point-entry');

// route name entry
const routeNameEntry = document.getElementById("route_name");

// #endregion

//#region SETTINGS
let appSettings = loadSettings();
const settingsModal = document.getElementById("settings_modal");
const settingsButton = document.getElementById("settings_button");
const settingsModalElement = document.getElementById("settings_modal");
const settingsClose = document.getElementById("settings_close");
//#endregion

//#region NAVBAR ELEMENT
const navBar = document.getElementById('the-sidenav');
//#endregion

//#region ROUTING MODE TOGGLING
const autoModeContent = document.getElementById("auto_mode_content");
const manualModeContent = document.getElementById("manual_mode_content");
let clickMode = null;
//#endregion

// #region LOAD ROUTE ELEMENTS
const selectedRouteDisplay = document.getElementById('selected-route-display')
const selectedRouteName = document.getElementById('selected-route-name')
const selectedRouteType = document.getElementById('selected-route-type')
// #endregion

// #region ROUTING UI ELEMENTS

// arrays 
let userClicks = [];
let pathCoords = [];
let manualRoutePoints = [];

// route layers
let manualRouteLayer = null;

// strings / handlers / nums
let manualRouteClickHandler = null; 
let lastClickedPoint = null;
let loadedRouteCoordinates = null;
let currentPathData = null;
let displayedPath = null;

// current state
let currentMode = "auto";

// #endregion

//#region CLICKING-ASSOCIATED VALUES
let selectedPoint = null;
//#endregion

//#region DELETING POINT ELEMENTS
const deletePointConfirmationDialog = document.getElementById("delete-point-confirmation-dialog");
const pointDeleteModalNameDisplay = document.getElementById("point-name-display");
const wrapper = document.querySelector(".wrapper")
//#endregion

//#region SAVING AND LOADING DIVS
const saveRouteDiv = document.getElementById("save_route");
const loadRouteDiv = document.getElementById("load_route");
//#endregion

// #endregion

mapStyling.style.cursor = "grab";

// #region FUNCTIONS

// #region HELPER FUNCTIONS

// formating distance between different units
function formatDistance(distanceKm) {
  if (!appSettings) return `${distanceKm.toFixed(2)}km`;

  if (appSettings.distanceUnit === "miles") {
    const distanceMiles = distanceKm * 0.621371;
    return `${distanceMiles.toFixed(2)}mi`;
  }
  return `${distanceKm.toFixed(2)}km`;
}

// showing coordinate input errors 
function showCoordInputError(entry, message) {
  entry.placeholder = message;
  entry.classList.add('input-error');

  entry.addEventListener("input", () => {
    entry.classList.remove('input-error')
    entry.placeholder = "Coordinates";
  }, {once : true });
}

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

// #endregion

//#region SETTINGS

// loading settings upon running of app
function loadSettings() {
  const settings = {
    distanceUnit: localStorage.getItem("distanceUnit") || "km", // km is default
  };
  return settings;
}

// ================
// SETTINGS
// ================

function saveSettings(settings) {
  localStorage.setItem("distanceUnit", settings.distanceUnit);
  appSettings = settings;
}

function openSettingModal(e) {
  e.preventDefault();
  e.stopPropagation();
  if (settingsModalElement) {
    settingsModalElement.classList.add("active");
  }
}

function closeSettingModal(e) {
  e.preventDefault();
  e.stopPropagation();
  if (settingsModalElement) {
    settingsModalElement.classList.remove("active");
  }
}

function closeByClickingOutsideModal(e) {
  if (e.target === this) {
    this.classList.remove("active");
  }
}

function initSettingsModal() {

  settingsButton.addEventListener("click", openSettingModal);
  settingsClose.addEventListener("click", closeSettingModal); 

  if (settingsModalElement) {
    settingsModalElement.addEventListener("click", closeByClickingOutsideModal);

    const modalContent = settingsModalElement.querySelector(".settings-modal-content");

    if (modalContent) {
      modalContent.addEventListener("click", function (e) {
        e.stopPropagation();
      });
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSettingsModal);
} else {
  initSettingsModal();
}

function toggleDistanceUnit() {
  appSettings.distanceUnit = this.checked ? "miles" : "km";
  saveSettings(appSettings);
  updateManualRoute();

  const routeStatsDiv = document.getElementById("route-stats");
  if (routeStatsDiv) {
    const routeDistanceDisplay =
      routeStatsDiv.querySelector("#route_distance_display") ||
      routeStatsDiv.querySelector(".stat-value:first-of-type");
    if (routeDistanceDisplay) {
      console.log(
        "Distance unit changed, manual route updated. Initial auto route display requires server refresh to update.",
      );
    }
  }
}

function initSettingsHandlers() {
  const distanceUnitToggle = document.getElementById("distance_unit_toggle");
  if (distanceUnitToggle) {
    distanceUnitToggle.checked = appSettings.distanceUnit === "miles";
    distanceUnitToggle.addEventListener("change", toggleDistanceUnit);
  }

  const routeDistanceDisplay =
    document.getElementById("route_distance_display");
  if (routeDistanceDisplay) {
    const currentDistance = parseFloat(
      routeDistanceDisplay.textContent.replace(/[^\d.]/g, ""),
    );
    routeDistanceDisplay.textContent = formatDistance(currentDistance);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSettingsHandlers);
} else {
  initSettingsHandlers();
}

//#endregion

// #region MAIN MAP CLICK FUNCTION/S


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
        if (layer === savedPointsLayer && feature.getGeometry() instanceof ol.geom.Point) {
          newSelection = feature;
          featureClicked = true;
          return true;
        }
      }
    );

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

// #endregion

// #region NAV BAR FUNCTIONS

function openNav() {
  navBar.style.width = "250px";
}

function closeNav() {
  navBar.style.width = "0";
}

// #endregion

// #region SWITCHING BETWEEN AUTO AND MANUAL ROUTING MODES

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

  manualRouteClickHandler = function (event) {
    const coordinate = event.coordinate;
    addManualPoint(coordinate[0], coordinate[1]);
  };
  map.on("click", manualRouteClickHandler);

  clearAutoRoute();

  updateLoadRouteVisibility();
}

// #endregion

// #region UPDATING LOAD ROUTE DIV VISIBILITY

function updateLoadRouteVisibility() {
  const loadRouteDiv = document.getElementById("load_route");
  if (!loadRouteDiv) return;

  if (routingStateObject.currentMode === "manual") {
    loadRouteDiv.style.display = "none";
  } else if (routingStateObject.currentMode === "auto") {
    const hasPath =
      displayedPath !== null ||
      (routingStateObject.currentPathData && routingStateObject.currentPathData.length > 0) ||
      (routingStateObject.loadedRouteCoordinates && routingStateObject.loadedRouteCoordinates.length > 0);
    loadRouteDiv.style.display = hasPath ? "none" : "block";
  }
}
// #endregion

// #region CLEARING AUTO/MANUAL PATHS

function clearAutoRoute() {
  loadedRouteCoordinates = null;
  currentPathData = null;

  if (displayedPath) {
    map.removeLayer(displayedPath);
    displayedPath = null;
  }

  if (routeLayer) {
    routeLayer.getSource().clear();
  }

  if (currentMode === "manual") {
    clearManualRoute();
  }

  map.getLayers().getArray().slice().forEach((layer) => {
      if (layer instanceof ol.layer.Vector && layer !== savedPointsLayer) {
        if (layer.getSource()) {
          layer.getSource().clear();
        } 
      }
    } 
  );

  const existingStats = document.getElementById("route-stats");
  if (existingStats) existingStats.remove();

  startPointEntry.value = "";
  endPointEntry.value = "";
  selectedRouteName.value = "";
  selectedRouteType.value = "";
  selectedRouteDisplay.textContent = "Choose a route";

  
  if (routeNameEntry) routeNameEntry.value = "";
  if (saveRouteDiv) saveRouteDiv.style.display = "none";
  if (loadRouteDiv) loadRouteDiv.style.display = "block";

  updateLoadRouteVisibility();
}

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

  if (displayedPath) {
    map.removeLayer(displayedPath);
    displayedPath = null;
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

// #endregion

// #region HOME BUTTON FUNCTION

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

  const routeNameEntry = document.getElementById("route_name");
  if (routeNameEntry) routeNameEntry.value = "";

  const messageDivs = document.querySelectorAll("#load_message, #save_message");
  messageDivs.forEach((div) => (div.innerHTML = ""));

  routingStateObject.loadedRouteCoordinates = null;
  routingStateObject.currentPathData = null;
  displayedPath = null;

  const saveRouteDiv = document.getElementById("save_route");
  if (saveRouteDiv) saveRouteDiv.style.display = "none";

  updateLoadRouteVisibility();
}
// #endregion

// #region SEARCHING FOR AREA

function searchArea() {
  
  const area = searchEntry.value;

  const url = window.appConfig.apiSearchAreaUrl;

  fetch(url, {
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
// #endregion

// #region MAP RENDERING
function mapRenderComplete() {
    loadAndDisplaySavedPoints();
    refreshRouteList();
    updateLoadRouteVisibility();
}
// #endregion

// #region PATH GENERATION

// handler for the generate route pipeline
async function handleAutoRouteGeneration() {

  // retrieving input
  const startPoint = startCoordEntry.value
  const endPoint = endCoordEntry.value

  // validating coords
  const validationResult = validateInputCoords(startPoint, endPoint)

  // breaking if validation is not successful
  if (validationResult !== true) {
    return;
  }

  // disabling and adding loader animation to the generate path button
  generatePathButton.disabled = true;
  generatePathButton.classList.add("loading");

  // calculating the path

  try {
    const response = await calculatePath(startPoint, endPoint)
    const routeStats = displayPath(response)
    setStatDisplay(routeStats)
  }
  catch(error) {
    throw error
  }
  finally {
    generatePathButton.classList.remove("loading");
    generatePathButton.disabled = false;
    updateLoadRouteVisibility();
  }
}

// validating coords
function validateInputCoords(startPoint, endPoint) {
   if(endPoint === "" && startPoint === "") {
    showCoordInputError(startCoordEntry, "Please enter coordinates");
    showCoordInputError(endCoordEntry, "Please enter coordinates");
    return false;
  }
  if (startPoint === "") {
    showCoordInputError(startCoordEntry, "Please enter coordinates");
    return false;
  }
  if (endPoint === "") {
    showCoordInputError(endCoordEntry, "Please enter coordinates");
    return false;
  }
}

// function to display the generated path from the calculatePath() func in routing.js
function displayPath(data) {

  const map = getMap();

  // removing any path if present
  if (displayedPath) {
    map.removeLayer(displayedPath);
    displayedPath = null;
  }

  // creating the new path layer
  displayedPath = new ol.layer.Vector({
    source: new ol.source.Vector({
      features: new ol.format.GeoJSON().readFeatures(data.pathGeoJSON),
    }),
    style: new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: getPathColour(),
        width: 5,
      }),
    }),
  });

  // adding the new path layer to the map
  map.addLayer(displayedPath);
  currentPathData = data.coordinates;

  // moving to the path
  const pathSource = displayedPath.getSource();
  const view = map.getView();

  setTimeout(() => {
    view.fit(pathSource.getExtent(), {
      padding: [50, 350, 50, 300],
      duration: 1200,
    });
  }, 100);

  return data.route_stats
}

// function to set the route stat display in the ui
function setStatDisplay(routeStats) {
  const statsHtml = `
    <div id="route-stats">
      <div class="stats-header">
        <span class="stats-title">Route Information</span>
      </div>
      <div class="stats-content">
        <div class="stat-row">
          <span class="stat-label" >Distance:</span>
          <span class="stat-value" id="route_distance_display">${formatDistance(parseFloat(routeStats.total_distance))}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">ETA:</span>
          <span class="stat-value" id="route_eta_display">${routeStats.eta}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Elevation Change:</span>
          <span class="stat-value" id="route_elevation_change_display">${routeStats.elevation_change}</span>
        </div>
      </div>
    </div>
  `;

  // removing any stats on display already
  const existingStats = document.getElementById("route-stats");
  if (existingStats) existingStats.remove();

  // adding the stats into the HTML
  document.body.insertAdjacentHTML("beforeend", statsHtml);
}

// #endregion

// #endregion

// #region EVENT LISTENERS

// #region map grabs
mapStyling.addEventListener("mouseup", () => {mapStyling.style.cursor = "grab"})
mapStyling.addEventListener("mousedown", () => {mapStyling.style.cursor = "grabbing"});
// #endregion

// #region setting stard and end points
addClickListner(setStartCoordButton, setStartCoord, "click");
addClickListner(setEndCoordButton, setEndCoord, "click");
// #endregion

// #region navbar clicks
addClickListner(openNavButton, openNav, "click");
addClickListner(closeNavButton, closeNav, "click")
// #endregion

// #region mode toggles
addClickListner(autoModeOption, handleToggles, "click");
addClickListner(manualModeOption, handleToggles, "click");
// #endregion

// #region calculating path
addClickListner(generatePathButton, handleAutoRouteGeneration, "click");
// #endregion

// #region map click handler function
onMapClick(mapClickHandler);
// #endregion

// #region map render complete handlers
onMapRenderComplete(mapRenderComplete)
// #endregion

// #region home button function
autoHomeButton.addEventListener("click", homeButtonFunction)
manualHomeButton.addEventListener("click", homeButtonFunction)
// #endregion

// #region routing mode toggle handlers
document.addEventListener("DOMContentLoaded", handleToggles);
// #endregion

//#region CLEARING ROUTES
clearAutoRouteButton.addEventListener("click", clearAutoRoute);
//#endregion

// #endregion