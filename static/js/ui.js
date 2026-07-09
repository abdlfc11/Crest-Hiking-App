//#region IMPORTS

import {
  roundCoords,
  createManualPointStyle,
  formatDistance,
  calculateTotalDistance,
  calculateEta,
  moveMapToPosition,
  getRouteStrokeStyle,
  showError,
  addClickListener,
  formatETA,
  removeDOMElement
} from "./utils.js";
import { calculatePath, addManualPoint } from "./routing/routing.js";
import {
  getMap,
  onMapClick,
  onMapRenderComplete,
  getRouteLayer,
  getPathColour,
  setRouteLayer,
} from "./map.js";
import {
  loadAndDisplaySavedPoints,
  getSavedPointsLayer,
  saveNewPoint,
} from "./saved_points/index.js";
import {
  getSavedPointStyle,
  getSelectedPointStyle,
} from "./saved_points/style.js";
import {
  initSaveRoute,
  loadRoute,
} from "./routes/index.js";
import {
  getCurrentMode,
  setCurrentMode,
  getCurrentPathData,
  setCurrentPathData,
  getLoadedRouteCoordinates,
  setLoadedRouteCoordinates,
  clearPathState,
  clearManualRouteState,
  manualRouteState,
  setLastKnownDistanceKm,
  getLastAutoRouteStats,
  setLastLoadedRouteStats,
  getLastLoadedRouteStats,
  setLastAutoRouteStats,
  clearLastAutoRouteStats,
  clearLastLoadedRouteStats,
  hasElevation, 
  extractElevation,
  extractElevationProfile,
  getElevationRange,
  calculateElevationChange
} from "./routes/routeState.js";
import {
  initCursorManager,
  updateCursor,
  setCursor,
  forceApplyCursor,
} from "./cursorManager.js";
import { setOnDistanceUnitChange } from "./settings.js";
import { getTheme } from "./settingsState.js";
import { displayLoadedRouteOnMap, displayLoadedRouteStats } from "./routes/loadRoute.js";
import { createElevationProfile, initChartToggleListener } from "./elevationChart.js";
import { displayImportedRouteCard, processImportedRouteFile } from "./importRoute.js";
import { createAutomaticRoutingTour, createImportRoutePanelTour, createManualRoutingTour, createSavedRouteDashboardTour, createSavingRoutesTour, createSettingsTour } from "./tours/tours.js";

//#endregion

//#region VAR / CONST DECLARATIONS

export const defaultCentre = Array.isArray(window.appConfig?.mapInitialCenter)
  ? window.appConfig.mapInitialCenter
  : [-211507, 7118524];

const autoModeOption = document.getElementById("auto-mode-option");
const manualModeOption = document.getElementById("manual-mode-option");

const setStartCoordButton = document.getElementById("set-start-coord-button");
const setEndCoordButton = document.getElementById("set-end-coord-button");

const autoOpenNavButton = document.getElementById("auto-open-nav-button");
const manualOpenNavButton = document.getElementById("manual-open-nav-button");
const closeNavButton = document.getElementById("close-nav-button");

const autoHomeButton = document.getElementById("auto-home-button");
const manualHomeButton = document.getElementById("manual-home-button");

const generatePathButton = document.getElementById("generate-path-button");

const clearAutoRouteButton = document.getElementById("clear-auto-route-button");
const clearManualRouteButton = document.getElementById("clear-manual-route");

const undoManualRouteButton = document.getElementById("undo-manual-route");
const redoManualRouteButton = document.getElementById("redo-manual-route");

const searchEntry = document.getElementById("search-entry");
const searchForAreaButton = document.getElementById("search-for-area-button");

const mapElement = document.getElementById("map");
const startCoordEntry = document.getElementById("start-point-entry");
const endCoordEntry = document.getElementById("end-point-entry");

const navBar = document.getElementById("the-sidenav");

// automatic mode + manual mode contents i.e mode-specific panels
const autoModeContent = document.getElementById("auto-mode-content");
const manualModeContent = document.getElementById("manual-mode-content");

// saved route div 
const saveRouteDiv = document.getElementById("save-route");
const routeNameEntry = document.getElementById("route-name");
const saveContainer = document.getElementById('save-route-container');
const saveRouteToggleButton = document.getElementById("save-route-toggle-button");
const saveRouteButtonContainer = document.getElementById('save-route-toggle-button');

// delete point modal
const deletePointConfirmationDialog = document.getElementById("delete-point-confirmation-dialog");
const pointDeleteModalNameDisplay = document.getElementById("point-name-display");
const pointDeleteDeleteButton = document.getElementById("point-delete-delete-button");
const pointDeleteExitButton = document.getElementById("point-delete-exit-button");
const dialogWrapper = deletePointConfirmationDialog?.querySelector(".wrapper");

// saved route dash panel
const openSavedRoutesDashButton = document.getElementById('saved-routes-dash-open-button');
const closeSavedRoutesDashButton = document.getElementById('saved-routes-dash-go-back-button');
const savedRoutesDashContent = document.getElementById('saved-routes-dashboard');
const noRouteCreateButton = document.getElementById("no-route-create-button");
const noRouteCreateDiv = document.getElementById('no-routes-wrapper');

// setting panel
const settingOpenButton = document.getElementById("settings-open-button");
const settingCloseButton = document.getElementById("settings-close-button");
const settingPanel = document.getElementById("settings-panel");

// route import panel
const importRouteOpenButton = document.getElementById("import-route-open-button");
const importRouteCloseButton = document.getElementById("import-route-close-button");
const importRoutePanel = document.getElementById("import-route-panel");
const importRouteFileInput = document.getElementById('import-route-file-input');
const importRouteURLInput = document.getElementById('import-route-url-input');
const importRouteCancelButton = document.getElementById('import-route-cancel-button');
const importRouteNameEntry = document.getElementById('import-route-name-input');
const importRouteSubmitButton = document.getElementById('import-route-submit-button');
const routeInputTypes = document.querySelectorAll('input[name="import-route-method"]');
const fileInputType = document.getElementById('file-route-input-type');
const URLInputType = document.getElementById('url-route-input-type')

// driver.js tours
let savedRouteDashTourDriver;
let manualRoutingTourDriver;
let importRouteTourDriver;
let automaticRoutingTourDriver;
let savingRoutesTourDriver;


// this is an array of allowed file types for route import
const allowedFileTypes = ['.gpx', '.kml', '.geojson', '.fit'];

let clickMode = null;
let manualRouteLayer = null;
let selectedPoint = null;

//#endregion

// hides save route button + panel if there is no route
if (!window.appConfig.initialCurrentPath) {
    if (saveContainer) {
        saveContainer.style.display = 'none';
    }
}

export function getClickMode() {
  return clickMode;
}

// check if user is on mobile and take subsequent action to inform them of decision to make Crest desktop only on web
function checkIfMobile() {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 1024;   

  if (isMobile) {
      document.body.innerHTML = `
          <div style="height: 100vh; display: flex; align-items: center; justify-content: center; text-align: center; padding: 20px; font-family: system-ui;">
              <div>
                  <h1 style="font-size: 2.5rem; margin-bottom: 1rem;">Crest Hiking App</h1>
                  <p style="font-size: 1.3rem; margin-bottom: 2rem;">
                      This website is designed for desktop only.
                  </p>
                  <p style="max-width: 500px; margin: 0 auto 2rem;">
                      For the best experience on your phone, we’re building a dedicated mobile app.<br><br>
                      In the meantime, please visit us on a laptop or desktop computer.
                  </p>
                  <button onclick="window.location.reload()" 
                          style="padding: 14px 32px; font-size: 1.1rem; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer;">
                      Refresh Anyway
                  </button>
              </div>
          </div>
      `;
  }
}

// this is for the 'create route' button on the panel shown on the saved routes dashboard when the user has no saved routes
function noRouteCreateFunction() {
  closeNav()
  closeSavedRoutesDash()
}

function showCoordInputError(entry, message) {
  entry.placeholder = message;
  entry.classList.add("input-error");
  entry.addEventListener(
    "input",
    () => {
      entry.classList.remove("input-error");
      entry.placeholder = "Coordinates";
    },
    { once: true },
  );
}

function setCoordInputActiveState(entry, isActive) {
  entry.classList.toggle("is-active", isActive);
}

function setStartCoord() {
  clickMode = "setStart";
  setCoordInputActiveState(startCoordEntry, true);
  setCoordInputActiveState(endCoordEntry, false);
  startCoordEntry.placeholder = "Click a point on the map";
  updateCursor();
}

function setEndCoord() {
  clickMode = "setEnd";
  setCoordInputActiveState(startCoordEntry, false);
  setCoordInputActiveState(endCoordEntry, true);
  endCoordEntry.placeholder = "Click a point on the map";
  updateCursor();
}

function setCoordEntry(entry, event) {
  const coordinate = event.coordinate;
  const rounded = roundCoords(coordinate, 0);
  entry.value = `${rounded[0]}, ${rounded[1]}`;
  entry.placeholder = "Coordinates";
  entry.classList.remove("input-error");
  setCoordInputActiveState(startCoordEntry, false);
  setCoordInputActiveState(endCoordEntry, false);
  clickMode = null;
  updateCursor();
}

export function mapClickHandler(event) {
  const map = getMap();
  if (!map) return;

  if (clickMode) {
    updateCursor();
  }

  if (clickMode === "setStart") {
    setCoordEntry(startCoordEntry, event);
    return;
  }
  if (clickMode === "setEnd") {
    setCoordEntry(endCoordEntry, event);
    return;
  }

  if (getCurrentMode() !== "auto") return;

  if (selectedPoint) {
    selectedPoint.setStyle(getSavedPointStyle(selectedPoint.get("name")));
    selectedPoint = null;
  }

  let featureClicked = false;
  let newSelection = null;
  const savedPointsLayer = getSavedPointsLayer();

  map.forEachFeatureAtPixel(event.pixel, (feature, layer) => {
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
    showPointDeleteDialog(true);
  } else if (!featureClicked) {
    const coordinate = event.coordinate;
    const [lon, lat] = ol.proj.toLonLat(coordinate);
    const roundedLatLon = roundCoords([lat, lon], 6);
    const pointName = prompt(
      `Do you want to save this coordinate: ${roundedLatLon[0]}, ${roundedLatLon[1]}? \nEnter a name to save it:`,
    );
    if (pointName) saveNewPoint(coordinate, pointName);
  }
}

//#region OPEN/CLOSE PANEL FUNCTIONS

function openNav() {
  navBar.style.width = "17rem";
}

export function closeNav() {
  navBar.style.width = "0";
}

function openSavedRoutesDash() {
  savedRoutesDashContent.style.width = "100vw";

  if (!localStorage.getItem('seenSavedRouteDashTour')) {
    const savedRouteDashTourDriver = createSavedRouteDashboardTour();

    savedRouteDashTourDriver.drive();

    localStorage.setItem('seenSavedRouteDashTour', 'True')
    return;
  }
  return;
};

export function closeSavedRoutesDash() {
  savedRoutesDashContent.style.width = "0";
};

function openSettings() {
  settingPanel.style.width = "100vw";

  if (!localStorage.getItem('seenSettingsTour')) {
    const settingsTourDriver = createSettingsTour();

    settingsTourDriver.drive();

    localStorage.setItem('seenSettingsTour', 'True')
    return;
  }
  return;
};

export function closeSettings() {
  settingPanel.style.width = "0";
};

function openImportRoute() {
  importRoutePanel.style.width = "100vw";

  if (!localStorage.getItem('seenImportRouteTour')) {
    const importRouteTourDriver = createImportRoutePanelTour();

    importRouteTourDriver.drive();

    localStorage.setItem('seenImportRouteTour', 'True')
    return;
  }
  return;
};

export function  closeImportRoute() {
  importRoutePanel.style.width = "0";
};

export function updateSaveRouteContainer() {
  const isOpen = saveRouteToggleButton.classList.toggle("opened");

    if (isOpen) {
        saveRouteDiv.style.height = `${saveRouteDiv.scrollHeight}px`;
    } else {
        saveRouteDiv.style.height = "0px";
    }
};

//#endregion

//#region IMPORT ROUTE PANEL FUNCTIONS

async function handleRouteImport() {
  const selectedInputType = whichInputTypeSelected();
  let routeName;
  let data; // this will store the return value of the flask route 'import_route_file', it is initialised first as if done so in the try statement then the next try statement cannot use it

  if (selectedInputType === "file") {

    try {
      
      const file = importRouteFileInput.files[0];

      if (!file) {
        showError("Please select a file to import.");
        return false;
      }

      if (!validateFileInput()) {
        return false;
      }

      data = await processImportedRouteFile(file); 

      if (!data || !data.coords) {
        showError("There was an error on our end. Please try again later.");
        return false;
      }

      const today = new Date();
        
      const formattedToday = new Intl.DateTimeFormat('en-GB', {
      "day": "2-digit",
      "month": "2-digit",
      "year": "numeric"
      }).format(today);

      if (!importRouteNameEntry.value) {
        routeName = `${file.name} saved on ${formattedToday}`
      }
      else {
        routeName = importRouteNameEntry.value;
      };
    }
    catch (error) {
      showError("There was an error on our end. Please try again later.")
      console.error(`ERROR whilst importing route : ${error}`)
    }

    try {
      const response = await fetch('/save_route', {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coordinates: data.coords,
          type: "import",
          route_name: routeName 
        }),
      });

      if (!response.ok) {
        showError("There was an error on our end. Please try again later.");
        return false;
      }

      const result = await response.json(); 
      if (!result.success) {
        showError(result.message || "Failed to save route.");
        return false;
      }

      displayImportedRouteCard(result);
      removeDOMElement(noRouteCreateDiv);
      cancelRouteImport();
      return true;

    } catch (err) {
      showError("There was an error on our end. Please try again later.");
      console.error(`Error whilst trying to save imported route: ${err}`)
      return false;
    }
  }
  else if (selectedInputType === "url") {
    const url = importRouteURLInput.value.trim();

    if (!URL.canParse(url)) {
      showError("Please enter a valid URL to import.");
      return false;
    }

    clearImportRouteInput();
    console.log(`Importing route from URL: ${url}`);
    return url;
  }
}

/**
 * Function responsible for validating the import route input.
 * @returns {boolean} - True if the input is valid, false otherwise.
 */
function validateFileInput() {

    // this retrieves the file from the file input element
    const file = importRouteFileInput.files[0];

    // this checks if a file is selected
    if (!file) {
        showError("Please select a file to import.");
        return false;
    }

    // this checks if the file is of the correct type
    if (!allowedFileTypes.some(type => file.name.endsWith(type))) {
        showError("Please select a valid file to import.");
        return false;
    }

    // this checks if the file size is too large (greater than 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showError("File size is too large. Please select a file smaller than 5MB.");
        return false;
    }

    return true;
}

/**
 * Returns the currently selected input type for route import.
 * @returns {string|null} - The selected input type or null if none is selected.
 */
function whichInputTypeSelected() {
    const selectedInputType = document.querySelector('input[name="import-route-method"]:checked');

    if (selectedInputType === fileInputType) {
        return "file";
    }
    else if (selectedInputType === URLInputType) {
        return "url";
    }
    else {
        return null;
    }
}

/**
 * Function responsible for clearing the import route input fields.
 */
function clearImportRouteInput() {
  importRouteFileInput.value = "";
  importRouteURLInput.value = "";
  importRouteNameEntry.value = "";
}

/**
 * Function responsible for closing the import route panel and the navigation panel when the cancel button is clicked.
 */
function cancelRouteImport() {
    clearImportRouteInput();
    closeImportRoute();
    closeNav();
};

/**
 * Function responsible for displaying the correct input type when the selected input type in the input type radio pill choices changes.
 */
function handleRouteImportType() {

    // this gets the content of the different input types
    const fileInputTypeContent = document.getElementById('import-route-file-row');
    const URLInputTypeContent = document.getElementById('import-route-url-row');

    // this gets the currently selected import type
    const selectedInputType = document.querySelector('input[name="import-route-method"]:checked');

    clearImportRouteInput();

    // this compares against one and displays the corresponding input type
    if (selectedInputType === fileInputType) {
        fileInputTypeContent.style.display = 'flex';
        URLInputTypeContent.style.display = 'none';
    }
    else {
        fileInputTypeContent.style.display = 'none';
        URLInputTypeContent.style.display = 'flex';
    }
}

//#endregion

function handleToggles(event) {
  manualModeOption.classList.remove("active");
  autoModeOption.classList.remove("active");
  event.currentTarget.classList.add("active");
};

function manualRouteClickHandler(event) {
  const coordinate = event.coordinate;
  addManualPoint(coordinate[0], coordinate[1]);
};

//#region MODE SWITCHING

function switchToAutoMode() {
  const map = getMap();
  if (!map) return;

  setCurrentMode("auto");
  updateCursor();
  autoModeOption.classList.add("active");
  manualModeOption.classList.remove("active");
  autoModeContent.style.display = "block";
  manualModeContent.style.display = "none";

  map.un("click", manualRouteClickHandler);
  map.on("click", mapClickHandler);

  clearManualRoute();
  clearAutoRoute();
};

function switchToManualMode() {
  const map = getMap();
  if (!map) return;
  
  setCurrentMode("manual");
  updateCursor();
  manualModeOption.classList.add("active");
  autoModeOption.classList.remove("active");
  autoModeContent.style.display = "none";
  manualModeContent.style.display = "block";

  map.un("click", mapClickHandler);
  map.on("click", manualRouteClickHandler);
  clearAutoRoute();

  if (!localStorage.getItem('seenManualRoutingTour')) {
    manualRoutingTourDriver = createManualRoutingTour();

    manualRoutingTourDriver.drive();

    localStorage.setItem('seenManualRoutingTour', 'True')
  }
  return;
};

//#endregion

//#region CLEARING INPUTS

export function clearAutoRoute() {
  const map = getMap();
  if (!map) return;

  clearPathState();

  const routeLayer = getRouteLayer();
  if (routeLayer) routeLayer.getSource().clear();

  if (getCurrentMode() === "manual") {
    clearManualRoute();
  }

  map
    .getLayers()
    .getArray()
    .slice()
    .forEach((layer) => {
      if (
        layer instanceof ol.layer.Vector &&
        layer !== getSavedPointsLayer() &&
        layer !== routeLayer
      ) {
        layer.getSource()?.clear();
      }
    });

  document.getElementById("route-stats")?.remove();

  clearLastAutoRouteStats();

  if (startCoordEntry) startCoordEntry.value = "";
  if (endCoordEntry) endCoordEntry.value = "";
  if (routeNameEntry) routeNameEntry.value = "";
  if (saveContainer) saveContainer.style.display = "none";
  closeSaveRouteContainer();
  
};

export function clearManualRoute() {
  const map = getMap();
  if (!map) return;

  clearManualRouteState();

  if (manualRouteLayer) {
    map.removeLayer(manualRouteLayer);
    manualRouteLayer = null;
  }

  document.getElementById("route-stats")?.remove();

  if (saveContainer) saveContainer.style.display = "none";
  closeSaveRouteContainer();

  clearPathState();
  getRouteLayer()?.getSource().clear();

  
};

export function homeButtonFunction() {
  const map = getMap();
  if (!map) return;

  endCoordEntry?.classList.remove("input-error");
  startCoordEntry?.classList.remove("input-error");
  if (startCoordEntry) startCoordEntry.placeholder = "Coordinates";
  if (endCoordEntry) endCoordEntry.placeholder = "Coordinates";
  generatePathButton?.classList.remove("loading");

  clearManualRoute();
  clearAutoRoute();
  clearLastLoadedRouteStats();
  closeSaveRouteContainer()

  const layersToRemove = [];
  map.getLayers().forEach((layer) => {
    if (layer instanceof ol.layer.Vector) layersToRemove.push(layer);
  });
  layersToRemove.forEach((layer) => map.removeLayer(layer));

  setRouteLayer(
    new ol.layer.Vector({
      source: new ol.source.Vector(),
      style: new ol.style.Style({
        stroke: new ol.style.Stroke(getRouteStrokeStyle()),
      }),
      zIndex: 999,
    }),
  );
  map.addLayer(getRouteLayer());

  document.getElementById("route-stats")?.remove();

  moveMapToPosition(map)
  if (startCoordEntry) startCoordEntry.value = "";
  if (endCoordEntry) endCoordEntry.value = "";
  if (searchEntry) searchEntry.value = "";
  if (routeNameEntry) routeNameEntry.value = "";

  clearPathState();
  if (saveContainer) saveContainer.style.display = "none";
  
  loadAndDisplaySavedPoints();
  updateCursor();
};

//#endregion

function searchArea() {
  const map = getMap();
  if (!map) return;

  fetch(window.appConfig.apiSearchAreaUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ search_input: searchEntry.value }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (!data.success) return;
      const view = map.getView();
      if (view.getZoom() >= 7) {
        view.animate(
          { center: view.getCenter(), duration: 1000, zoom: 10 },
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
    })
    .catch((error) => console.log("Error: ", error));
};

async function mapRenderComplete() {

  loadAndDisplaySavedPoints();  
};

//#region ROUTING

async function handleAutoRouteGeneration(start=null, end=null) {
  const startPoint = start || startCoordEntry?.value || "";
  const endPoint = end || endCoordEntry?.value || "";

  console.log(`startPoint is ${startPoint}`)

  if (validateInputCoords(startPoint, endPoint) !== true) return;

  generatePathButton.disabled = true;
  generatePathButton.classList.add("loading");

  try {
    const response = await calculatePath(startPoint, endPoint); // response.coordinates may return coordinates whereby each element has 3 values (x, y and elevation)
    const routeStats = displayPath(response);
    routeStats.eta_seconds = formatETA(routeStats.eta_seconds)
    setLastKnownDistanceKm(routeStats.total_distance);
    setLastAutoRouteStats(routeStats);
    setAutoRouteStatDisplay(getLastAutoRouteStats());
    initChartToggleListener();
    createElevationProfile(response.coordinates);
    if (saveContainer) saveContainer.style.display = "flex";
  } catch (error) {
    console.error(error);
  } finally {
    generatePathButton.classList.remove("loading");
    generatePathButton.disabled = false;
    
  }
};

function validateInputCoords(startPoint, endPoint) {
  if (endPoint === "" && startPoint === "") {
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
  return true;
};

function displayPath(data) {
  const map = getMap();
  const routeLayer = getRouteLayer();
  if (!map || !routeLayer) return null;

  const source = routeLayer.getSource();
  source.clear();

  const feature = new ol.format.GeoJSON().readFeature(data.pathGeoJSON, {
    dataProjection: "EPSG:3857",
    featureProjection: "EPSG:3857",
  });

  source.addFeature(feature);

  const coordinates = data.coordinates;


  if (coordinates.length >= 2) {
    const startCoord = coordinates[0];
    const endCoord = coordinates[coordinates.length - 1];

    const startPointFeature = new ol.Feature({
      geometry: new ol.geom.Point([startCoord[0], startCoord[1]])
    });
    startPointFeature.setStyle(createManualPointStyle("Start", "#8145d4"));

    const endPointFeature = new ol.Feature({
      geometry: new ol.geom.Point([endCoord[0], endCoord[1]])
    });
    endPointFeature.setStyle(createManualPointStyle("End", "#8145d4"));

    source.addFeature(startPointFeature);
    source.addFeature(endPointFeature);

  }

  setCurrentPathData(data.coordinates); // data.coordinates may be either 2 elements (x and y) or 3 elements (x, y and elevation)


  setTimeout(() => {
    map.getView().fit(source.getExtent(), {
      padding: [50, 100, 100, 430],
      duration: 1200,
    });
    map.render();
  }, 100);

  return data.route_stats;
};

function setAutoRouteStatDisplay(routeStats) {
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
                  <span class="stat-value" id="route-eta-display">${routeStats.eta_seconds}</span>
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

  document.getElementById("route-stats")?.remove();
  document.body.insertAdjacentHTML("beforeend", statsHtml);
};

function checkIfCircularRoute() {
  const tolerance = 0.000001;
  const { userClicks } = manualRouteState;

  if (userClicks.length > 3) {
    const start = userClicks[0];
    const end = userClicks[userClicks.length - 1];
    if (
      Math.abs(start[0] - end[0]) < tolerance &&
      Math.abs(start[1] - end[1]) < tolerance
    ) {
      return true;
    }
  }
  return false;
};

function removeExistingStats() {
  if (manualRouteState.userClicks.length === 0) {
    document.getElementById("route-stats")?.remove();
    if (saveRouteDiv && getCurrentMode() === "manual") {
      saveRouteDiv.style.display = "none";
    }
    return false;
  }
  return true;
};

export function updateSavedRouteCards() {
  const statValues = document.querySelectorAll('[data-distance-km]');
  statValues.forEach(value => {
    const rawKm = parseFloat(value.dataset.distanceKm);
    if (isNaN(rawKm)) return;
    const formattedValue = formatDistance(rawKm);
    value.textContent = formattedValue;
  });
};

export function updateManualRoute() {
  const map = getMap();
  if (!map) return;

  if (manualRouteLayer) map.removeLayer(manualRouteLayer);
  if (!removeExistingStats()) return;

  if (saveContainer) saveContainer.style.display = "flex";

  const { userClicks, pathCoords } = manualRouteState;
  const totalDistanceKm = calculateTotalDistance(pathCoords) / 1000;
  const distanceDisplay = formatDistance(totalDistanceKm);
  const etaDisplay = calculateEta(totalDistanceKm);
  const isSnappedToEnd = checkIfCircularRoute();
  const features = [];
  let elevationDisplay = "N/A";
  const range = getElevationRange(pathCoords);
  if (range && typeof range.min === 'number' && typeof range.max === 'number') {
    const change = range.max - range.min;
    elevationDisplay = `${change >= 0 ? '+' : ''}${change}m`
  }

  setLastKnownDistanceKm(totalDistanceKm);

  userClicks.forEach((point, index) => {
    const feature = new ol.Feature({
      geometry: new ol.geom.Point(point),
      type: "point",
    });
    feature.set("index", index);
    features.push(feature);
  });

  if (pathCoords.length > 1) {
    features.push(
      new ol.Feature({
        geometry: new ol.geom.LineString(pathCoords),
        type: "line",
      }),
    );
  }

  manualRouteLayer = new ol.layer.Vector({
    source: new ol.source.Vector({ features }),
    style(feature) {
      const featureType = feature.get("type");
      if (featureType === "point") {
        const index = feature.get("index");
        const isStart = index === 0;
        const isEnd = index === userClicks.length - 1;

        if (isSnappedToEnd) {
          if (isStart) return createManualPointStyle("Start/End", "#8145d4");
          if (isEnd) return createManualPointStyle("", "#8145d4", 0);
        }
        if (isStart) return createManualPointStyle("Start", "#8145d4");
        if (isEnd) return createManualPointStyle("End", "#8145d4");
        return createManualPointStyle("", "#000", 6.5);
      }
      return new ol.style.Style({
        stroke: new ol.style.Stroke(getRouteStrokeStyle()),
      });
    },
  });

  map.addLayer(manualRouteLayer);

  let statsDiv = document.getElementById("route-stats");
  if (!statsDiv) {
    statsDiv = document.createElement("div");
    statsDiv.id = "route-stats";
    document.body.appendChild(statsDiv);
  }

  statsDiv.innerHTML = `
      <div class="stats-header">
          <span class="stats-title">Route Information</span>
          <button id="toggle-elevation-chart" class="stats-button">Elevation Profile</button>
      </div>
      <div id="stat-content-and-chart-container">
          <div class="stats-content">
              <div class="stat-row">
                  <span class="stat-label">Distance:</span>
                  <span class="stat-value" id="route-distance-display">${distanceDisplay}</span>
              </div>
              <div class="stat-row">
                  <span class="stat-label">ETA:</span>
                  <span class="stat-value" id="route-eta-display">${etaDisplay}</span>
              </div>
              <div class="stat-row">
                  <span class="stat-label">Elevation Change:</span>
                  <span class="stat-value" id="route-elevation-change-display">${elevationDisplay}</span>
              </div>
          </div>

          <div class="chart-wrapper"> 
              <div id="elevation-chart-container">
                  <canvas id="elevation-chart"></canvas>
              </div>
          </div>
      </div>
  `;
  initChartToggleListener();
  createElevationProfile(pathCoords);
};

export function undoManualRoutePoint() {

  const { userClicks, segmentCache } = manualRouteState;

  // this removes the last click
  const removed = userClicks.pop();

  // this adds the removed point to the redo stack
  manualRouteState.redoStack.push(removed);

  manualRouteState.pathCoords = []; // resets pathCoord array

  // this updates the UI and exits if there are no clicks
  if (userClicks.length === 0) {
    updateManualRoute();
    return;
  }

  // this pushes the first click
  manualRouteState.pathCoords.push(userClicks[0]);

  // this rebuilds the pathCoords array
  for (let i = 0; i < userClicks.length - 1; i++) {
    const A = userClicks[i];
    const B = userClicks[i + 1];

    const key = JSON.stringify([A, B]);
    const segment = manualRouteState.segmentCache[key]; // retrieves route segment already calculated from cache 

    if (!segment) {
      console.error("Missing cache segment for :", A, B)
      continue;
    }

    // this pushes everything except the first point to avoid duplication of points 
    manualRouteState.pathCoords.push(...segment.slice(1));
  }

  // this updates the UI
  updateManualRoute();
};

function redoManualRoutePoint() {
  const restoredPoint = manualRouteState.redoStack.pop();
  
  if (!restoredPoint) return;

  addManualPoint(restoredPoint[0], restoredPoint[1]);
};

function closeSaveRouteContainer() {
  const isOpen = saveRouteToggleButton.classList.contains('opened')

  if (!isOpen) {
    return true;
  };

  saveRouteToggleButton.classList.remove('opened')
  return true;
}

//#endregion

//#region DRIVER.JS

async function handleSaveRouteTour() {
  await handleAutoRouteGeneration('-209579, 7053648', '-202103, 7051314');

  setTimeout(() => {
    savingRoutesTourDriver = createSavingRoutesTour(homeButtonFunction);

    savingRoutesTourDriver.drive();
  }, 1500);
}



export function handleInitialTour() {

  if (!localStorage.getItem('seenInitialTour')) {
    automaticRoutingTourDriver = createAutomaticRoutingTour(handleSaveRouteTour);

    automaticRoutingTourDriver.drive();

    localStorage.setItem('seenInitialTour', "True")
    return;
  }
  return;
}


//#endregion

//#region DELETING POINTS

function showPointDeleteDialog(show) {
  if (!deletePointConfirmationDialog) return;
  show ? deletePointConfirmationDialog.showModal() : deletePointConfirmationDialog.close();
}

function initPointDeleteHandlers() {
  if (!deletePointConfirmationDialog) return;

  deletePointConfirmationDialog.addEventListener("click", (e) => {
    if (dialogWrapper && !dialogWrapper.contains(e.target)) {
      deletePointConfirmationDialog.close();
    }
  });

  deletePointConfirmationDialog.addEventListener("close", () => {
    if (selectedPoint) {
      selectedPoint.setStyle(getSavedPointStyle(selectedPoint.get("name")));
      selectedPoint = null;
    }
  });

  pointDeleteDeleteButton?.addEventListener("click", () => {
    if (!selectedPoint) {
      alert("Error: No point is currently selected for deletion.");
      showPointDeleteDialog(false);
      return;
    }

    const pointName = selectedPoint.get("name");
    fetch(window.appConfig.apiDeletePointUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ point_name: pointName }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          showPointDeleteDialog(false);
          selectedPoint = null;
          loadAndDisplaySavedPoints();
        } else {
          alert(`Error deleting point: ${data.message}`);
          showPointDeleteDialog(false);
        }
      })
      .catch((error) => {
        alert(`Network Error: Could not delete point: ${error.message}`);
        showPointDeleteDialog(false);
      });
  });

  pointDeleteExitButton?.addEventListener("click", () =>
    showPointDeleteDialog(false),
  );
}

//#endregion

// ##### LIGHT / DARK THEME #####
export function applyTheme(theme) {
  const effective = theme === "system" ? getTheme() : theme;
  document.documentElement.classList.toggle("dark", effective === "dark");
}

// ##### KEYBOARD SHORTCUTS ##### 
function handleKeyboardShortcuts(e) {

  // this returns if the user is typing 
  if (document.activeElement.tagName === "INPUT" || 
      document.activeElement.tagName === "TEXTAREA") {
        return;
  };

  // this gets the key that is pressed
  const key = e.key.toLowerCase();
  const mode = getCurrentMode();

  // if ctrl / cmd key is pressed
  if (e.ctrlKey || e.metaKey) {
    
    // this switches to auto mode if ctrl/cmd + a is pressed
    if (key === 'a') {
      e.preventDefault();
      switchToAutoMode();
      return;
    };

    if (key === 'k') {
      e.preventDefault();
      searchEntry.focus();
    }
     
    // this switches to manual mode if ctrl/cmd + m is pressed
    if (key === 'm' && e.shiftKey) {
      e.preventDefault();
      switchToManualMode();
      return;
    };

    if (mode === "manual") {

      // this un-does the last point if ctrl/cmd + z is clicked
      if (key === "z") {
        e.preventDefault();
        undoManualRoutePoint();
        return;
      };
       
      
      // this re-does the last undone point if ctrl/cmd + y is clicked
      if (key === "y") {
        e.preventDefault();
        redoManualRoutePoint();
        return;
      };
       
    };

  };

};


// ##### HANDLING TOGGLING OF DISTANCE UNITS #####
function handleDistanceUnitToggle() {

  // if there is a manual route present
  if (manualRouteState.pathCoords.length > 0) {
    updateManualRoute();
  }
  else if (getLastAutoRouteStats()) {
    setAutoRouteStatDisplay(getLastAutoRouteStats());
  }
  else if (getLastLoadedRouteStats) {
    displayLoadedRouteStats(getLastLoadedRouteStats());
  }
  initChartToggleListener();

  const coords =
    manualRouteState.pathCoords.length > 1
      ? manualRouteState.pathCoords
      : (getCurrentPathData() || getLoadedRouteCoordinates());

  if (coords && coords.length > 1) createElevationProfile(coords);
};


//#region EVENT LISTENERS

export function initUi() {
  const map = getMap();
  if (map) {
    initCursorManager(map, getCurrentMode, getClickMode);
  }

  applyTheme(getTheme());

  initSaveRoute();
  initPointDeleteHandlers();

  updateSavedRouteCards();


  // initial tour (automatic routing and saving the first route)
  handleInitialTour();

  // These event listeners are for settings and preferences.
  setOnDistanceUnitChange(() => handleDistanceUnitToggle());
  window.addEventListener("load", checkIfMobile);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    applyTheme(getTheme());
  });

  // These event listeners are for navigation panels.
  addClickListener(autoOpenNavButton, openNav, "click");
  addClickListener(manualOpenNavButton, openNav, "click");
  addClickListener(closeNavButton, closeNav, "click");
  addClickListener(openSavedRoutesDashButton, openSavedRoutesDash, "click");
  addClickListener(closeSavedRoutesDashButton, closeSavedRoutesDash, "click");
  addClickListener(settingOpenButton, openSettings, "click");
  addClickListener(settingCloseButton, closeSettings, "click");
  addClickListener(importRouteOpenButton, openImportRoute, "click");
  addClickListener(importRouteCloseButton, closeImportRoute, "click");
  addClickListener(importRouteCancelButton, cancelRouteImport, "click");

  // These event listeners are for route import.
  addClickListener(importRouteFileInput, validateFileInput, "change");
  addClickListener(importRouteSubmitButton, handleRouteImport, "click");
  routeInputTypes.forEach(radio => {
    radio.addEventListener('change', handleRouteImportType);
  });

  // These event listeners are for route mode selection.
  addClickListener(autoModeOption, handleToggles, "click");
  addClickListener(manualModeOption, handleToggles, "click");
  addClickListener(autoModeOption, switchToAutoMode, "click");
  addClickListener(manualModeOption, switchToManualMode, "click");

  // These event listeners are for automatic route generation.
  generatePathButton.addEventListener("click", () => handleAutoRouteGeneration());
  addClickListener(clearAutoRouteButton, clearAutoRoute, "click");
  addClickListener(searchForAreaButton, searchArea, "click");
  addClickListener(setStartCoordButton, setStartCoord, "click");
  addClickListener(setEndCoordButton, setEndCoord, "click");

  // These event listeners are for manual route creation.
  addClickListener(clearManualRouteButton, clearManualRoute, "click");
  addClickListener(undoManualRouteButton, undoManualRoutePoint, "click");
  addClickListener(redoManualRouteButton, redoManualRoutePoint, "click");
  addClickListener(noRouteCreateButton, noRouteCreateFunction, "click");

  // These event listeners are for route saving.
  addClickListener(saveRouteToggleButton, updateSaveRouteContainer, "click");

  // These event listeners are for keyboard shortcuts.
  addClickListener(document, handleKeyboardShortcuts, "keydown");

  onMapClick(mapClickHandler);
  onMapRenderComplete(mapRenderComplete);

  // These event listeners are for returning the map to the Lake District + clearing inputs
  autoHomeButton?.addEventListener("click", homeButtonFunction);
  manualHomeButton?.addEventListener("click", homeButtonFunction);

  // These event listeners are for updating the map cursor.
  mapElement?.addEventListener("mouseup", () => {
    updateCursor();
  });

  mapElement?.addEventListener("mousedown", () => {
    if (getCurrentMode() === "manual") {
      // Crosshair all the time due to creation of routes.
      setCursor("crosshair");
      return;
    }

    setCursor("grabbing");
  });
}


//#endregion