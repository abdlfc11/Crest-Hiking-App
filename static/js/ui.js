import {
  roundCoords,
  createManualPointStyle,
  formatDistance,
  calculateTotalDistance,
  calculateEta,
  moveMapToPosition,
  getRouteStrokeStyle
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
  getElevationRange
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

export const defaultCentre = [-357428, 7256794];

const searchForAreaButton = document.getElementById("search-for-area-button");
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

const mapElement = document.getElementById("map");
const searchEntry = document.getElementById("search-entry");
const startCoordEntry = document.getElementById("start-point-entry");
const endCoordEntry = document.getElementById("end-point-entry");
const routeNameEntry = document.getElementById("route-name");
const navBar = document.getElementById("the-sidenav");
const autoModeContent = document.getElementById("auto-mode-content");
const manualModeContent = document.getElementById("manual-mode-content");
const selectedRouteDisplay = document.getElementById("selected-route-display");
const selectedRouteName = document.getElementById("selected-route-name");
const selectedRouteType = document.getElementById("selected-route-type");
const saveRouteDiv = document.getElementById("save-route");
const deletePointConfirmationDialog = document.getElementById("delete-point-confirmation-dialog");
const pointDeleteModalNameDisplay = document.getElementById("point-name-display");
const pointDeleteDeleteButton = document.getElementById("point-delete-delete-button");
const pointDeleteExitButton = document.getElementById("point-delete-exit-button");
const dialogWrapper = deletePointConfirmationDialog?.querySelector(".wrapper");

const openSavedRoutesDashButton = document.getElementById('saved-routes-dash-open-button');
const closeSavedRoutesDashButton = document.getElementById('saved-routes-dash-go-back-button');
const savedRoutesDashContent = document.getElementById('saved-routes-dashboard');

const settingOpenButton = document.getElementById("settings-open-button");
const settingCloseButton = document.getElementById("settings-close-button");
const settingPanel = document.getElementById("settings-panel");

let clickMode = null;
let manualRouteLayer = null;
let selectedPoint = null;

export function getClickMode() {
  return clickMode;
}

// check if user is on mobile and take subsequent action to inform them of decision to make Crest desktop only for now
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

/**
 * 
 * @param {DOMElement} element 
 * @param {function} func 
 * @param {Event} type 
 */
export function addClickListener(element, func, type) {
  if (element) element.addEventListener(type, func);
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

function setStartCoord() {
  clickMode = "setStart";
  startCoordEntry.style.borderColor = "#5a76e7";
  startCoordEntry.placeholder = "Click a point on the map"
  updateCursor();
}

function setEndCoord() {
  clickMode = "setEnd";
  endCoordEntry.style.borderColor = "#5a76e7";
  endCoordEntry.placeholder = "Click a point on the map"
  updateCursor();
}

function setCoordEntry(entry, event) {
  const coordinate = event.coordinate;
  const rounded = roundCoords(coordinate, 0);
  entry.value = `${rounded[0]}, ${rounded[1]}`;
  entry.placeholder = "Coordinates"
  if (getTheme() === "dark") {
    entry.style.borderColor = "#4b5563";
  }
  else {
    entry.style.borderColor = "#e1cbcb"
  }
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

function openNav() {
  navBar.style.width = "17rem";
}

export function closeNav() {
  navBar.style.width = "0";
}

function openSavedRoutesDash() {
  savedRoutesDashContent.style.width = "100vw";
}

export function closeSavedRoutesDash() {
  savedRoutesDashContent.style.width = "0";
  // Re-assert the correct cursor now that the map is fully visible again.
  // forceApplyCursor ensures it happens even if no pointermove has fired yet.
  forceApplyCursor();
}

function openSettings() {
  settingPanel.style.width = "100vw";
}

export function closeSettings() {
  settingPanel.style.width = "0";
}

function handleToggles(event) {
  manualModeOption.classList.remove("active");
  autoModeOption.classList.remove("active");
  event.currentTarget.classList.add("active");
}

function manualRouteClickHandler(event) {
  const coordinate = event.coordinate;
  addManualPoint(coordinate[0], coordinate[1]);
}

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
}

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
}

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
  if (selectedRouteName) selectedRouteName.value = "";
  if (selectedRouteType) selectedRouteType.value = "";
  if (selectedRouteDisplay) selectedRouteDisplay.textContent = "Choose a route";
  if (routeNameEntry) routeNameEntry.value = "";
  if (saveRouteDiv) saveRouteDiv.style.display = "none";
  
}

export function clearManualRoute() {
  const map = getMap();
  if (!map) return;

  clearManualRouteState();

  if (manualRouteLayer) {
    map.removeLayer(manualRouteLayer);
    manualRouteLayer = null;
  }

  document.getElementById("route-stats")?.remove();

  if (saveRouteDiv && getCurrentMode() === "manual") {
    saveRouteDiv.style.display = "none";
  }

  clearPathState();
  getRouteLayer()?.getSource().clear();

  
}

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
  if (selectedRouteDisplay) selectedRouteDisplay.textContent = "Choose a route";
  if (selectedRouteName) selectedRouteName.value = "";
  if (selectedRouteType) selectedRouteType.value = "";
  document
    .querySelectorAll(".load-route-item")
    .forEach((item) => item.classList.remove("selected"));
  if (routeNameEntry) routeNameEntry.value = "";

  document
    .querySelectorAll("#load-message, #save-message")
    .forEach((el) => (el.innerHTML = ""));

  clearPathState();
  if (saveRouteDiv) saveRouteDiv.style.display = "none";
  
  loadAndDisplaySavedPoints();
  updateCursor();
}

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
}

async function mapRenderComplete() {

  loadAndDisplaySavedPoints();  
}

async function handleAutoRouteGeneration() {
  const startPoint = startCoordEntry?.value ?? "";
  const endPoint = endCoordEntry?.value ?? "";

  if (validateInputCoords(startPoint, endPoint) !== true) return;

  generatePathButton.disabled = true;
  generatePathButton.classList.add("loading");

  try {
    const response = await calculatePath(startPoint, endPoint); // response.coordinates may return coordinates whereby each element has 3 values (x, y and elevation)
    const routeStats = displayPath(response);
    setLastKnownDistanceKm(routeStats.total_distance);
    setLastAutoRouteStats(routeStats);
    setAutoRouteStatDisplay(getLastAutoRouteStats());
    initChartToggleListener();
    createElevationProfile(response.coordinates);
    if (saveRouteDiv) saveRouteDiv.style.display = "block";
  } catch (error) {
    console.error(error);
  } finally {
    generatePathButton.classList.remove("loading");
    generatePathButton.disabled = false;
    
  }
}

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
}

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
  setCurrentPathData(data.coordinates); // data.coordinates may be either 2 elements (x and y) or 3 elements (x, y and elevation)


  setTimeout(() => {
    map.getView().fit(source.getExtent(), {
      padding: [80, 350, 80, 300],
      duration: 1200,
    });
    map.render();
  }, 100);

  return data.route_stats;
}

function setAutoRouteStatDisplay(routeStats) {
  const statsHtml = `
    <div id="route-stats">
      <div class="stats-header">
        <span class="stats-title">Route Information</span>
        <button id="toggle-elevation-chart" class="stats-button">Elevation Profile</button>
      </div>
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

      <div id="elevation-chart-container">
          <canvas id="elevation-chart" width="400" height="200"></canvas>
      </div>

    </div>
  `;

  document.getElementById("route-stats")?.remove();
  document.body.insertAdjacentHTML("beforeend", statsHtml);
}

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
}

function removeExistingStats() {
  if (manualRouteState.userClicks.length === 0) {
    document.getElementById("route-stats")?.remove();
    if (saveRouteDiv && getCurrentMode() === "manual") {
      saveRouteDiv.style.display = "none";
    }
    return false;
  }
  return true;
}

export function updateSavedRouteCards() {
  const statValues = document.querySelectorAll('[data-distance-km]');
  statValues.forEach(value => {
    const rawKm = parseFloat(value.dataset.distanceKm);
    if (isNaN(rawKm)) return;
    const formattedValue = formatDistance(rawKm);
    value.textContent = formattedValue;
  });
}

export function updateManualRoute() {
  const map = getMap();
  if (!map) return;

  if (manualRouteLayer) map.removeLayer(manualRouteLayer);
  if (!removeExistingStats()) return;

  if (saveRouteDiv) saveRouteDiv.style.display = "block";

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

      <div id="elevation-chart-container">
          <canvas id="elevation-chart" width="400" height="200"></canvas>
      </div>

    </div>
  `;
  initChartToggleListener();
  createElevationProfile(pathCoords);
}

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

// ##### LIGHT / DARK THEME #####
export function applyTheme(theme) {
  const effective = theme === "system" ? getTheme() : theme;
  document.documentElement.classList.toggle("dark", effective === "dark");
}

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
};


export function initUi() {
  // Initialise cursor manager this takes over all cursor control
  // so we beat OpenLayers' internal "pointer" on features.
  const map = getMap();
  if (map) {
    initCursorManager(map, getCurrentMode, getClickMode);
  }

  applyTheme(getTheme());

  initSaveRoute();
  initPointDeleteHandlers();

  updateSavedRouteCards();

  setOnDistanceUnitChange(() => handleDistanceUnitToggle());
  addClickListener(setStartCoordButton, setStartCoord, "click");
  addClickListener(setEndCoordButton, setEndCoord, "click");
  addClickListener(autoOpenNavButton, openNav, "click");
  addClickListener(manualOpenNavButton, openNav, "click");
  addClickListener(closeNavButton, closeNav, "click");
  addClickListener(openSavedRoutesDashButton, openSavedRoutesDash, "click");
  addClickListener(closeSavedRoutesDashButton, closeSavedRoutesDash, "click");
  addClickListener(settingOpenButton, openSettings, "click");
  addClickListener(settingCloseButton, closeSettings, "click");
  addClickListener(autoModeOption, handleToggles, "click");
  addClickListener(manualModeOption, handleToggles, "click");
  addClickListener(autoModeOption, switchToAutoMode, "click");
  addClickListener(manualModeOption, switchToManualMode, "click");
  addClickListener(generatePathButton, handleAutoRouteGeneration, "click");
  addClickListener(clearAutoRouteButton, clearAutoRoute, "click");
  addClickListener(clearManualRouteButton, clearManualRoute, "click");
  addClickListener(searchForAreaButton, searchArea, "click");
  window.addEventListener('load', checkIfMobile);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener("change", () => {
    applyTheme(getTheme())
  })

  onMapClick(mapClickHandler);
  onMapRenderComplete(mapRenderComplete);

  autoHomeButton?.addEventListener("click", homeButtonFunction);
  manualHomeButton?.addEventListener("click", homeButtonFunction);

  mapElement?.addEventListener("mouseup", () => {
    updateCursor();
  });
  mapElement?.addEventListener("mousedown", () => {
    if (getCurrentMode() === "manual") {
      // crosshair all the time due to creation of routes
      setCursor("crosshair");
      return;
    }
    setCursor("grabbing");
  });
}