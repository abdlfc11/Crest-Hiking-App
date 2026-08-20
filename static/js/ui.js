//#region IMPORTS

// Open Layers Imports
import { toLonLat, fromLonLat } from "ol/proj.js";
import { Point, LineString } from "ol/geom.js"
import VectorSource from "ol/source/Vector.js";
import VectorLayer from "ol/layer/Vector.js";
import Feature from "ol/Feature.js";
import GeoJSON from "ol/format/GeoJSON.js"
import { Translate } from "ol/interaction.js"

// constants
import { MAP_VIEW_PADDING } from "./constants.js";

// LocalForage
import localforage from "localforage";

// Local File Imports

import {
  calculateEta,
  calculateTotalDistance,
  formatLatLon
} from "./utils/routing-utils.js";

import {
  createManualPointStyle,
  getRouteStrokeStyle
} from "./utils/style-utils.js";

import {
  formatDistance,
  formatETA,
  formatElevation
} from "./utils/format-utils.js";

import {
  showToast,
  addClickListener,
  removeDOMElement,
  createStatsPanel,
  parseCoordString
} from "./utils/ui-utils.js";

import { moveMapToPosition } from "./utils/map-utils.js";

import { calculatePath, addManualPoint } from "./routing/index.js";

import {
  getMap,
  onMapClick,
  getRouteLayer,
  getPathColour,
  setRouteLayer,
  routeLayerHasFeatures
} from "./map.js";

import {
  loadAndDisplaySavedPoints,
  getSavedPointsLayer,
  saveNewPoint,
  deleteSavedPoint
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
  calculateElevationGain,
  isPointInPolygon
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

import { createElevationProfile, initChartToggleListener, resetElevationChart, setHoverPointFeature, toggleElevationChart } from "./elevationChart.js";

import { displayImportedRouteCard, processImportedRouteFile } from "./importRoute.js";

import { 
  createAutomaticRoutingTour,
  createImportRoutePanelTour,
  createManualRoutingTour,
  createSavedRouteDashboardTour,
  createSavingRoutesTour,
  createSettingsTour
} from "./tours/tours.js";

import { logout } from "./auth/auth.js";
import { logError } from "./utils/logError-utils.js";
import { Vector } from "ol/source.js";
import Style from "ol/style/Style.js";
import Stroke from "ol/style/Stroke.js";

//#endregion

//#region VAR / CONST DECLARATIONS

export const defaultCentre = Array.isArray(window.appConfig?.mapInitialCentre)
  ? window.appConfig.mapInitialCentre
  : [-3.198308, 54.465458];

const autoModeOption = document.getElementById("auto-mode-option");
const manualModeOption = document.getElementById("manual-mode-option");

const setStartCoordButton = document.getElementById("set-start-coord-button");
const setEndCoordButton = document.getElementById("set-end-coord-button");

const startCoordEntry = document.getElementById("start-point-entry");
const endCoordEntry = document.getElementById("end-point-entry");

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

const reportIssueOpenButton = document.getElementById('report-issues-open-button')
const loginNavBarButton = document.getElementById('sidenav-login-button');
const logoutNavBarButton = document.getElementById('sidenav-logout-button');

// automatic mode + manual mode contents i.e mode-specific panels
const autoModeContent = document.getElementById("auto-mode-content");
const manualModeContent = document.getElementById("manual-mode-content");

// saved route div 
const saveRouteDiv = document.getElementById("save-route");
const routeNameEntry = document.getElementById("route-name");
const saveContainer = document.getElementById('save-route-container');
const saveRouteToggleButton = document.getElementById("save-route-toggle-button");
const saveRouteContainer = document.getElementById('save-route-container');

// delete point modal
const deletePointModal = document.getElementById("delete-point-confirmation-dialog");
const deletePointModalNameDisplay = document.getElementById("point-name-display");
const deletePointModalDeleteButton = document.getElementById("point-delete-delete-button");
const deletePointModalExitButton = document.getElementById("point-delete-exit-button");
const deletePointModalContent = deletePointModal.querySelector('.modal-content');

// login modal
const loginModal = document.getElementById('login-dialog');
const loginModalLoginButton = document.getElementById('login-dialog-login');
const loginModalExitButton = document.getElementById('login-dialog-exit');
const loginModalContent = loginModal.querySelector('.modal-content');

// report issue modal
const reportIssueModal = document.getElementById('report-issue-dialog');
const reportIssueModalSubmit = document.getElementById('report-issue-dialog-submit');
const reportIssueModalExit = document.getElementById('report-issue-dialog-exit');
const reportIssueModalContent = reportIssueModal.querySelector('.modal-content');
const reportIssueResultLabel = document.getElementById('report-issue-result-label');
const reportIssueTitleInput = document.getElementById("report-issue-title");
const reportIssueTextAreaInput = document.getElementById("report-issue-description");

// donate modal
const donateButton = document.getElementById('donate-button');

const donateModal = document.getElementById('donate-modal');
const donateModalContent = document.getElementById('donate-modal-content');
const donateModalCloseButton = document.getElementById('donate-modal-close-button');
const donateModalMaybeLaterButton = document.getElementById('donate-modal-maybe-later-button')

// load last route modal
const loadLastRouteModal = document.getElementById('load-last-route-dialog');
const loadLastRouteModalContent = loadLastRouteModal.querySelector('.modal-content');
const loadLastRouteModalLoadButton = document.getElementById('load-last-route-dialog-load-button');
const loadLastRouteModalDismissButton = document.getElementById('load-last-route-dialog-dismiss-button');
const loadLastRouteModalRouteName = document.getElementById('load-last-route-modal-route-name');
const loadLastRouteModalRouteDistance = document.getElementById('load-last-route-modal-route-distance');
const loadLastRouteModalRouteElevationGain = document.getElementById('load-last-route-modal-route-elevation-gain');


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

// Start and End points 

let interactivePointLayerInteraction = null; // holds the OpenLayer interaction for the start and end points 
let interactivePointLayer = null; // stores the vector layer which holds the point features 

//#endregion

// hides save route button + panel if there is no route

export function getClickMode() {
  return clickMode;
}

//#region MOBILE CHECK

/**
 * Checks if user is on mobile device and advices to use Crestr on desktop / laptop instead 
 * 
 * @param {void}
 * @returns {void}
 */
function checkIfMobile() {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 1024;   
  if (isMobile) {
      document.body.innerHTML = `
          <div style="height: 100vh; display: flex; align-items: center; justify-content: center; text-align: center; padding: 20px; font-family: system-ui;">
              <div>
                  <h1 style="font-size: 2.5rem; margin-bottom: 1rem;">Crestr Hiking App</h1>
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
//#endregion

//#region DONATE MODAL

//#region GENERAL MODAL

/**
 * Function used to catch clicks outside of a modal in order to close the modal upon these clicks. 
 * 
 * @param {Event} e 
 * @param {HTMLDivElement} modalContent 
 * @param {HTMLDialogElement} modal 
 * @returns {void}
 */
function closeModalUponOutsideClick(e, modalContent, modal) {
  if (modalContent && !modalContent.contains(e.target)) {
      modal.close()
    }
};

/**
 * Toggles the provided modal
 * @param {boolean} show true if you want to show the modal, false if you want to hide the modal
 * @param {HTMLDialogElement} modal The modal you want to open/close
 * @returns {void} 
 */
export function showModal(show, modal) {
  if (show) {
    modal.showModal();
  } 
  else {
    modal.close();
  }
};

//#endregion

//#region LOGIN MODAL

/**
 * Toggles the login modal display and sets the action context
 * @param {boolean} show true if you want to show the modal, false if you want to hide the modal
 * @param {string} [actionName='perform this action'] the specific action that is being performed when showing the modal e.g save routes 
 * @returns {void}
 */
export function showLoginModal(show, actionName = 'perform this action') {
  const messageElement = loginModal.querySelector('.modal-body p');

  if (show) {

    // This updates the message dynamically
    messageElement.textContent = `An account is required to ${actionName}.`;
    loginModal.showModal();
  } 
  else {
    loginModal.close();
  }
};

/**
 * Function used to transition to the login page from the login modal
 * @returns {void}
 */
function loginModalLogin() {
  showLoginModal(false);
  window.location.href = '/login-page';
  return;
};

//#endregion

//#region LOAD LAST ROUTE MODAL

function discardLastLoadedRoute() {
  showModal(false, loadLastRouteModal);
  localforage.clear();
}

function populateLastLoadedRouteModal(routeStats, routeName) {
  loadLastRouteModalRouteName.textContent = routeName || 'Untitled route';
  loadLastRouteModalRouteDistance.textContent = formatDistance(routeStats.total_distance)
  loadLastRouteModalRouteElevationGain.textContent = `${routeStats.elevation_gain} m`
}


async function handleInitialLoadCachedRoute() { 
  const hasPreviousSaveAttempt = await localforage.getItem('unauthenticated-save-route-attempt')
  const routeName = await localforage.getItem('cachedRouteName'); 
  const lastRoutingMode = await localforage.getItem('lastRoutingMode');

  if (!hasPreviousSaveAttempt || !window.appConfig.loggedIn) return;

  if (lastRoutingMode === "auto") {
    const routeStats = await localforage.getItem('cachedAutoRouteStats');

    populateLastLoadedRouteModal(routeStats, routeName);
    showModal(true, loadLastRouteModal);
  }
  else {
    const routeStats = await localforage.getItem('cachedManualRouteStats');

    populateLastLoadedRouteModal(routeStats, routeName);
    showModal(true, loadLastRouteModal);
  }
}

//#endregion

//#region REPORT ISSUE MODAL

/**
 * Opens the modal if the input is truthy and closes the modal if the input is falsy
 * 
 * @param {Boolean} show True to show the modal, false to hide the modal
 */
function showReportIssueModal(show) {
  if (!reportIssueModal) return;
  if (show) {
    reportIssueModal.showModal();
  } else {
    reportIssueModal.close();
  }
}

/**
 * This function validates the input fields for the report issue form.
 * @param {string} title 
 * @param {string} description 
 * @returns {boolean} Returns true if the input is valid, false otherwise.
 */
function validateReportIssueInput(title, description) {
    if (!title || !description) {
        showToast("Please fill in both the title and description fields.", "error", reportIssueModal);
        return false;
    }

    if (title.length > 100) {
        showToast("Title cannot exceed 100 characters.", "error", reportIssueModal);
        return false;
    }

    if (description.length > 1000) {
        showToast("Description cannot exceed 1000 characters.", "error", reportIssueModal);
        return false;
    }

    return true;
}

/**
 * 
 * Handles the submission of the report issue form.
 * It validates the input fields and sends a POST request to the server with the title and description of the issue. 
 * 
 * @param {string} title
 * @param {string} description
 * @returns {void}
 */
export async function handleReportIssueSubmission(title, description) {

    if (!validateReportIssueInput(title, description)) {
        return;
    }

    // This disables the submit button to prevent multiple submissions
    reportIssueModalSubmit.disabled = true;

    try {
      const response = await fetch(window.appConfig.apiReportIssueUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: title,
          description: description
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
          throw new Error("There was an unexpected error whilst submitting the issue report.")
          return;
      }

      if (!data.success) {
          throw new Error("There was an unexpected error whilst submitting the issue report.");
          return;
      }

      showToast("Thank you, the issue was reported successfully. ", "success")
      
      // UI cleanup
      reportIssueTitleInput.value = '';
      reportIssueTextAreaInput.value = '';
      showReportIssueModal(false);

    } catch (error) {
      showToast("There was an unexpected error whilst submitting the issue report.", "error", reportIssueModal);
    } finally {
      reportIssueModalSubmit.disabled = false;
    }
}


//#endregion

//#region COORDINATE INPUT FUNCTIONS

/**
 * @param {string} startPoint
 * @param {string} endPoint
 * @returns {boolean} True if the parameters are empty and false if otherwise
 */
function isCoordInputEmpty(startPoint, endPoint) {
  
  if (endPoint === "" && startPoint === "") {
    showCoordInputError(startCoordEntry, "Please enter coordinates");
    showCoordInputError(endCoordEntry, "Please enter coordinates");
    return true;
  }

  if (startPoint === "") {
    showCoordInputError(startCoordEntry, "Please enter coordinates");
    return true;
  }

  if (endPoint === "") {
    showCoordInputError(endCoordEntry, "Please enter coordinates");
    return true;
  }

  return false;
};

/**
 * 
 * @param {string} startPoint 
 * @param {string} endPoint 
 * @returns {boolean} True if the coordinates are correctly formatted and false if otherwise
 */
function validateInputCoords(startPoint, endPoint) {

  if (isCoordInputEmpty(startPoint, endPoint)) {
    return false;
  }

  // This splits the string via commas
  const startParts = startPoint.split(",");
  const endParts = endPoint.split(",");

  // This ensures there are two coordinates
  if (startParts.length < 2 || endParts.length < 2) {
    showToast("Invalid coordinate format. Please Use Lat, Lon");
    return false;
  }

  // this parses the full string into numbers
  const startLat = parseFloat(startParts[0].trim());
  const startLon = parseFloat(startParts[1].trim());
  const endLat = parseFloat(endParts[0].trim());
  const endLon = parseFloat(endParts[1].trim());

  // this re-orders coordinates to [lon, lat] for the Cumbria ray-casting check (array of Cumbria boundary has coords in [lon, lat] format)
  const startLonLat = [startLon, startLat];
  const endLonLat = [endLon, endLat];

  if ( !isPointInPolygon(startLonLat)) {
    showToast("Please select a starting location within Cumbria.")
    startCoordEntry.value = '';
    showCoordInputError(startCoordEntry, "Please select a starting location within Cumbria.");
    return false
  }

  if (!isPointInPolygon(endLonLat)) {
    showToast("Please select a destination within Cumbria.");
    endCoordEntry.value = ''
    showCoordInputError(endCoordEntry, "Please select a destination within Cumbria.");
    return false;
  }

  return true;
};

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
  // event.coordinate is in Web Mercator
  // this means conversion to lat/lon is required for display
  const lonLat = toLonLat(event.coordinate);
  entry.value = formatLatLon(lonLat, 6);
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

    // adding start point
    const pointFeature = createPoint(event.coordinate, getSavedPointStyle("Start", "#00A86B"), "start", "Start");
    addStartEndPoint(pointFeature, interactivePointLayer, "start");
    setUpPointInteraction([interactivePointLayer]);

    if (interactivePointLayer.getSource().getFeatures().length > 1) {
      handleAutoRouteGeneration(startCoordEntry.value, endCoordEntry.value);
    };

    return;
  }
  if (clickMode === "setEnd") {
    setCoordEntry(endCoordEntry, event);

    // adding end point 
    const pointFeature = createPoint(event.coordinate, getSavedPointStyle("End", "#D32F2F"), "end", "End")
    addStartEndPoint(pointFeature, interactivePointLayer, "end");
    setUpPointInteraction([interactivePointLayer]);

    if (interactivePointLayer.getSource().getFeatures().length > 1) {
      handleAutoRouteGeneration(startCoordEntry.value, endCoordEntry.value);
    };

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
      feature.getGeometry() instanceof Point
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
    deletePointModalNameDisplay.textContent = pointName;
    showModal(true, deletePointModal);
  } 
  else if (!featureClicked) {
    const coordinate = event.coordinate;
    const lonLat = toLonLat(coordinate);

    // TO BE CHANGED TO CUSTOM MODAL 
    const pointName = prompt(
      `Do you want to save this coordinate: ${formatLatLon(lonLat, 6)}? \nEnter a name to save it:`,
    );

    if (pointName) saveNewPoint(coordinate, pointName);
  }
}

//#endregion

//#region OPEN/CLOSE PANEL FUNCTIONS

// this is for the 'create route' button on the panel shown on the saved routes dashboard when the user has no saved routes
function noRouteCreateFunction() {
  closeSavedRoutesDash()
}

function openSavedRoutesDash() {

  // This prevents non-logged in and registered users from opening the save route panel
  if (!window.appConfig.loggedIn) {
    showLoginModal(true, "save routes");
    return;
  };

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

  // This prevents non-logged in and registered users from opening the save route panel
  if (!window.appConfig.loggedIn) {
    showLoginModal(true, "import routes");
    return;
  };

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

export function toggleSaveRouteContainer() {
  const isOpen = saveRouteToggleButton.classList.toggle("opened");

    if (isOpen) {
        saveRouteDiv.style.height = `${saveRouteDiv.scrollHeight}px`;
    } else {
        saveRouteDiv.style.height = "0px";
    }
};

function collapseSaveRouteContainer() {
  if (saveRouteToggleButton) {
    saveRouteToggleButton.classList.remove("opened");
  }

  if (saveRouteDiv) {
    saveRouteDiv.style.height = "0px";
  }
}

//#endregion

//#region IMPORT ROUTE PANEL FUNCTIONS

async function handleRouteImport() {
  const selectedInputType = whichInputTypeSelected();
  let routeName;
  let data; 

  if (selectedInputType === "file") {

    try {
      
      const file = importRouteFileInput.files[0];

      if (!validateFileInput(file)) {
        return false;
      }

      data = await processImportedRouteFile(file); 

      if (!data || !data.coords) {
        throw new Error(`(IMPORT ROUTE) HTTP Error: ${data}`, {cause: "Sorry, there was an error importing your route."})
      }

      const today = new Date();
        
      const formattedToday = new Intl.DateTimeFormat('en-GB', {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      }).format(today);

      if (!importRouteNameEntry.value) {
        routeName = `${file.name} saved on ${formattedToday}`
      }
      else {
        routeName = importRouteNameEntry.value;
      };
    }
    catch (error) {
      showToast(error.cause)
      return;
    }

    try {
      const response = await fetch(window.appConfig.apiSaveRouteUrl, {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coordinates: data.coords,
          type: "import",
          route_name: routeName 
        }),
      });

      const result = await response.json(); 

      if (response.status === 422) {
        throw new Error(`(IMPORT ROUTE) Incorrect Imput Error : ${result}`, { cause: result.user_message || result.message || "Sorry, there was an error importing your route."})
      }

      if (!response.ok) {
        throw new Error(`(IMPORT ROUTE) HTTP Error: ${result}`, {cause: result.user_message || result.message || "Sorry, there was an error importing your route."})
      }

      if (!result.success) {
        throw new Error(`(IMPORT ROUTE) Error: ${result}`, {cause: result.user_message || result.message || "Sorry, there was an error importing your route."})
      }

      displayImportedRouteCard(result);
      removeDOMElement(noRouteCreateDiv);
      cancelRouteImport();
      return true;

    } catch (err) {
      showToast(err.cause);
    }
  }
  else if (selectedInputType === "url") {
    const url = importRouteURLInput.value.trim();

    if (!URL.canParse(url)) {
      showToast("Please enter a valid URL to import.");
      return false;
    }

    clearImportRouteInput();
    return url;
  }
}

/**
 * Function responsible for validating the import route input.
 * @returns {boolean} - True if the input is valid, false otherwise.
 */
function validateFileInput(file) {

  try {

    const fileName = file?.name;

    // this checks if a file is selected
    if (!file) {
      throw new Error("Validation Error", {cause : "Please select a file to import."});
    }

    // this checks if the file is of the correct type
    if (!allowedFileTypes.some(type => fileName.endsWith(type))) {
      throw new Error("Validation Error", {cause : "Please select a valid file to import."});
    }

    // this checks if the file size is too large (greater than 5MB)
    if (file.size > 5 * 1024 * 1024) {
      throw new Error("Validation Error", {cause : "File is too large. Please select a file smaller than 5MB."});
    }

    // this checks if the file is empty or not
    if (file.size === 0) {
      throw new Error("Validation Error", {cause : "The chosen file is empty, please choose a different file."});
    }

    return true;
  }
  catch (error) {
    throw new Error(error.message, {cause: "There was an error validating your file, please try again or import a different file. "})
  }
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
 * Function responsible for clearing and closing the import route panel when the cancel button is clicked.
 */
function cancelRouteImport() {
    clearImportRouteInput();
    closeImportRoute();
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

//#region MODE SWITCHING

function handleToggles(event) {
  manualModeOption.classList.remove("active");
  autoModeOption.classList.remove("active");
  event.currentTarget.classList.add("active");
};

async function switchToAutoMode() {
  const map = getMap();
  if (!map) return;

  await localforage.setItem("lastRoutingMode", "auto");

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

async function switchToManualMode() {
  const map = getMap();
  if (!map) return;

  await localforage.setItem("lastRoutingMode", "manual");
  
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
  clearLastAutoRouteStats();

  // this clears the permanent route layer
  getRouteLayer()?.getSource()?.clear();

  // this clears start / end markers from the interactive layer
  if (interactivePointLayer) {
    const source = interactivePointLayer.getSource();
    source.getFeatures()
      .filter(f => f.get("type") === "start" || f.get("type") === "end")
      .forEach(f => source.removeFeature(f));
  }

  // this clears any other temporary vector layers (but leaves saved-points + interactive + route alone)
  map.getLayers().getArray().slice().forEach((layer) => {
    if (
      layer instanceof VectorLayer &&
      layer !== getSavedPointsLayer() &&
      layer !== getRouteLayer() &&
      layer !== interactivePointLayer
    ) {
      layer.getSource()?.clear();
    }
  });

  // this cleans up the UI
  document.getElementById("route-stats")?.remove();
  if (startCoordEntry) startCoordEntry.value = "";
  if (endCoordEntry) endCoordEntry.value = "";
  if (routeNameEntry) routeNameEntry.value = "";
  if (saveContainer) saveContainer.style.display = "none";
  updateSaveRouteContainer();

  // this also wipes the manual route if the user is in manual mode 
  if (getCurrentMode() === "manual") {
    clearManualRoute();
  }
}

export function clearManualRoute() {
  const map = getMap();
  if (!map) return;

  clearManualRouteState();

  // this removes the temporary manual route layer
  if (manualRouteLayer) {
    map.removeLayer(manualRouteLayer);
    manualRouteLayer = null;
  }

  // this also clears the permanent route layer (in case anything was drawn there)
  getRouteLayer()?.getSource()?.clear();

  document.getElementById("route-stats")?.remove();
  if (saveContainer) saveContainer.style.display = "none";
  updateSaveRouteContainer();
  resetElevationChart();
}

export function homeButtonFunction() {
  const map = getMap();
  if (!map) return;

  // this resets the coordinate input UI state
  if (startCoordEntry) {
    startCoordEntry.classList.remove("input-error", "is-active");
    startCoordEntry.placeholder = "Coordinates";
    startCoordEntry.value = "";
  }
  if (endCoordEntry) {
    endCoordEntry.classList.remove("input-error", "is-active");
    endCoordEntry.placeholder = "Coordinates";
    endCoordEntry.value = "";
  }

  clickMode = null;
  generatePathButton?.classList.remove("loading");

  // this wipes all route-related state
  clearManualRoute();
  clearAutoRoute();
  clearLastLoadedRouteStats();
  clearPathState();

  // Remove only temporary vector layers.
  // Keep: routeLayer, interactivePointLayer, saved-points layer
  map.getLayers().getArray().slice().forEach((layer) => {
    if (
      layer instanceof VectorLayer &&
      layer !== getRouteLayer() &&
      layer !== interactivePointLayer &&
      layer !== getSavedPointsLayer()
    ) {
      map.removeLayer(layer);
    }
  });

  // this cleans up the UI
  document.getElementById("route-stats")?.remove();
  if (searchEntry) searchEntry.value = "";
  if (routeNameEntry) routeNameEntry.value = "";
  if (saveContainer) saveContainer.style.display = "none";
  updateSaveRouteContainer();

  // this resets the map view and re-shows saved points
  loadAndDisplaySavedPoints();
  map.renderSync(); // this is to ensure that the map renders the deletion of the routeLayer features before the moving of the map view 

  moveMapToPosition(map);
  updateCursor();
}

//#endregion

//#region SEARCHING FUNCTION
function searchArea() {

  if (!searchEntry) {
    showToast("Search entry not found.");
    return;
  }


  const searchValue = searchEntry.value;
  searchEntry.value = "";

  const map = getMap();
  if (!map) return;

  fetch(window.appConfig.apiSearchAreaUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ search_input: searchValue }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (!data.success) return;

      const view = map.getView();

      // this converts the received coordinates into web mercator (as search API sends coords in [lon, lat] format)
      const searchCenter = fromLonLat(data.coordinates);
      if (view.getZoom() >= 7) {
        view.animate(
          { center: view.getCenter(), duration: 1000, zoom: 10 },
          () =>
            view.animate({
              center: searchCenter,
              duration: 1000,
              zoom: 14,
            }),
        );
      } else {
        view.animate({
          center: searchCenter,
          duration: 1000,
          zoom: 14,
        });
      }
    })
    .catch((error) => showToast("There was an unexpected error, please try again later."));
};
//#endregion

//#region AUTOMATIC ROUTING

async function handleAutoRouteGeneration(start=null, end=null) {
  const startPoint = start || startCoordEntry?.value || "";
  const endPoint = end || endCoordEntry?.value || "";

  if (await localforage.getItem('lastRoutingMode') !== "auto") localforage.setItem('lastRoutingMode', "auto");

  if (validateInputCoords(startPoint, endPoint) !== true) return;

  generatePathButton.disabled = true;
  generatePathButton.classList.add("loading");

  try {
    const response = await calculatePath(startPoint, endPoint); // response.coordinates may return coordinates whereby each element has 3 values (x, y and elevation)

    const routeStats = await displayPath(response);

    setLastKnownDistanceKm(routeStats.total_distance);
    setLastAutoRouteStats(routeStats);

    console.log(`AUTO ROUTE STATS : ${routeStats}`);

    displayAutoRouteStats(getLastAutoRouteStats());
    
    resetElevationChart();
    initChartToggleListener();
    createElevationProfile(response.coordinates);

    if (saveContainer) saveContainer.style.display = "flex";

  } catch (error) {
    console.log(error);
    console.log(error.cause);
    const allKeys = Reflect.ownKeys(error); 
    console.log(allKeys); 
    showToast(error.cause);
  } finally {
    generatePathButton.classList.remove("loading");
    generatePathButton.disabled = false;   
  }
};

async function displayPath(data) {

  try { 
  const map = getMap();
  const routeLayer = getRouteLayer();
  if (!map || !routeLayer) return null;

  const routeLayerSource = routeLayer.getSource();
  const interactivePointLayerSource = interactivePointLayer.getSource();

  routeLayerSource.clear();
  
  interactivePointLayerSource.getFeatures()
  .filter(feature => feature.get('type') === 'start' || feature.get('type') === 'end')
  .forEach(feature => interactivePointLayerSource.removeFeature(feature))

  // this clears the hovered point feature to prevent the preserving of stale OL point features
  setHoverPointFeature(null);

  const pathFeature = new GeoJSON().readFeature(data.pathGeoJSON, {
    dataProjection: "EPSG:4326",
    featureProjection: "EPSG:3857",
  });

  await routeLayerSource.addFeature(pathFeature);

  const coordinates = data.coordinates;


  if (coordinates.length >= 2) {
    const startCoord = coordinates[0];
    const endCoord = coordinates[coordinates.length - 1];

    // this converts coordinates into Web Mercator format, as the backend sends the path back in [Lon, Lat] format (Web Mercator is the OpenLayers map projection)
    const startMercatorCoord = fromLonLat([startCoord[0], startCoord[1]]);
    const endMercatorCoord = fromLonLat([endCoord[0], endCoord[1]]);

    // this creates and then displays (by adding them to the interactivePointLayerSource) the start and end point features
    const startPointFeature = createPoint(startMercatorCoord, getSavedPointStyle("Start", "#00A86B"), "start", "Start")
    const endPointFeature = createPoint(endMercatorCoord, getSavedPointStyle("End", "#D32F2F"), "end", "End")

    interactivePointLayerSource.addFeature(startPointFeature)
    interactivePointLayerSource.addFeature(endPointFeature)

    // only caches routes if user is not logged in
    if (!window.appConfig.loggedIn) {
      await localforage.setItem("cachedAutoRouteCoordinates", data.pathGeoJSON);
      await localforage.setItem("cachedAutoRouteStartPointCoords", startMercatorCoord);
      await localforage.setItem("cachedAutoRouteEndPointCoords", endMercatorCoord);
      await localforage.setItem("cachedAutoRouteStats", data.route_stats);
      console.log(data.route_stats);
    }
  }

  setCurrentPathData(data.coordinates); // data.coordinates are [lon, lat, elev] (EPSG:4326)


  setTimeout(() => {
    map.getView().fit(routeLayerSource.getExtent(), {
      padding: [300, 300, 300, 430],
      duration: 1200,
    });
    map.render();
  }, 100);

  return data.route_stats;
  } 
  catch(error) {
    console.log(error.message);
    showToast('Sorry, there was an unexpected error when calculating your route, please try again later.')
  }
};

async function displayAutoRouteStats(routeStats) {

  let statsDiv = document.getElementById("route-stats");

  if (statsDiv) {
    statsDiv.remove();
  };

  statsDiv = document.createElement("div");
  statsDiv.id = "route-stats";
  document.body.appendChild(statsDiv);

  statsDiv.innerHTML = createStatsPanel(formatDistance(parseFloat(routeStats.total_distance)), formatETA(routeStats.eta_seconds), formatElevation(routeStats.elevation_gain))
};

//#endregion

//#region CACHED ROUTES

async function handleLoadCachedRoute() {
  const routeType = await localforage.getItem("lastRoutingMode"); // needed to differentiate between cached auto routes / cached manual routes
  if (loadLastRouteModal) showModal(false, loadLastRouteModal); // hides modal 

  try {
    if (routeType === "auto") {
      handleLoadAutoCachedRoute();
    }
    else if (routeType === "manual") {
      switchToManualMode();
      handleLoadManualCachedRoute();
    }
    else {
      throw new Error("Invalid route type given")
    }
  }
  catch(error) {
    console.log(error.message)
    showToast("There was an error loading you last route", "error", null);
  }
  finally {
    localforage.clear();
  }
}

async function handleLoadAutoCachedRoute() {
  try {
      await displayAutoCachedRoute();

      const [cachedCoords, cachedRouteStats, startWebMercator, endWebMercator] = await Promise.all([
        await localforage.getItem("cachedAutoRouteCoordinates"),
        await localforage.getItem('cachedAutoRouteStats'),
        await localforage.getItem('cachedAutoRouteStartPointCoords'),
        await localforage.getItem('cachedAutoRouteEndPointCoords')
      ])

      const parsedStats = typeof cachedRouteStats === "string" ? JSON.parse(cachedRouteStats) : cachedRouteStats;
      setLastAutoRouteStats(parsedStats)

      setLastKnownDistanceKm(parsedStats.total_distance);
      startCoordEntry.value = formatLatLon(toLonLat(startWebMercator))
      endCoordEntry.value = formatLatLon(toLonLat(endWebMercator))

      await displayAutoCachedRouteStats(parsedStats);

      resetElevationChart();
      initChartToggleListener();
      createElevationProfile(cachedCoords.geometry.coordinates);

      setCurrentPathData(cachedCoords.geometry.coordinates);

      if (saveContainer) saveContainer.style.display = "flex";
  }
  catch(error) {
    throw new Error(error.message);
  }
}
    
/**
 * Loads the last cached route, automatically determines if route is manual / auto generated and retrieves the appropriate cached data 
 * makes use of localforage as opposed to localstorage due to high volume data 
 * @param {void}
 * @returns {void}
 */
async function displayAutoCachedRoute() {
  const map = getMap(); 

  // if (await localforage.getItem('unauthenticated-save-route-attempt')) localforage.setItem('unauthenticated-save-route-attempt', false);

  try {  

    const routeLayer = getRouteLayer();

    const routeLayerSource = routeLayer.getSource();
    const interactivePointLayerSource = interactivePointLayer.getSource();

    // clears all current features if present (unlikely given this occurs upon app load)
    routeLayerSource.clear();
    interactivePointLayerSource.getFeatures()
    .filter(feature => feature.get('type') === 'start' || feature.get('type') === 'end')
    .forEach(feature => interactivePointLayerSource.removeFeature(feature))

    // clears the hovered point feature to prevent the preserving of stale OL point features
    setHoverPointFeature(null);

    // retrieves cached data in parallel 
    const [cachedCoords, cachedStartCoords, cachedEndCoords] = await Promise.all([
      localforage.getItem("cachedAutoRouteCoordinates"),
      localforage.getItem("cachedAutoRouteStartPointCoords"),
      localforage.getItem("cachedAutoRouteEndPointCoords")
    ]);

    // recreates the path, start point and end point features 
    const pathFeature = new GeoJSON().readFeature(cachedCoords, {
      dataProjection: "EPSG:4326",
      featureProjection: "EPSG:3857",
    });

    const startPointFeature = createPoint(
      cachedStartCoords,
      getSavedPointStyle("Start", "#00A86B"),
      "start",
      "Start"
    )

    const endPointFeature = createPoint(
      cachedEndCoords,
      getSavedPointStyle("End", "#D32F2F"),
      "end", 
      "End"
    )

    // adds the features to the sources of the vector layers on the map --> displays the features on the map 
    routeLayerSource.addFeature(pathFeature);
    addStartEndPoint(startPointFeature, interactivePointLayer, "start");
    addStartEndPoint(endPointFeature, interactivePointLayer, "end");
    setUpPointInteraction([interactivePointLayer]);

    setTimeout(() => {
      map.getView().fit(routeLayerSource.getExtent(), {
        padding: MAP_VIEW_PADDING,
        duration: 1200,
      });
      map.render();
    }, 100);
  }
  catch (error) {
    throw new Error(error.message);
  }
}

async function displayAutoCachedRouteStats(routeStats) {
  try {

    let statsDiv = document.getElementById("route-stats");

    if (statsDiv) {
      statsDiv.remove();
    };
    
    console.log(`LAST AUTO ROUTE STATS : ${JSON.stringify(getLastAutoRouteStats())}`)
    console.log(`AUTO CACHED ROUTES : ${JSON.stringify(routeStats)}`)
    console.log(`LAST AUTO ROUTE STATS : ${JSON.stringify(getLastAutoRouteStats())}`)

    statsDiv = document.createElement("div");
    statsDiv.id = "route-stats";
    document.body.appendChild(statsDiv);

    statsDiv.innerHTML = createStatsPanel(formatDistance(parseFloat(routeStats.total_distance)), formatETA(routeStats.eta_seconds), formatElevation(routeStats.elevation_gain));
  }
  catch (error) {
    throw new Error(error.message)
  }
}

async function handleLoadManualCachedRoute() {

  console.log('updating route state')
  const updateManualRouteState = (newUserClicks, newPathCoords, newSegmentCache) => {
    manualRouteState.userClicks = newUserClicks;
    manualRouteState.pathCoords = newPathCoords;
    manualRouteState.segmentCache = newSegmentCache;
  }

  const newUserClicks = await localforage.getItem('cachedUserClicks');
  const newPathCoords = await localforage.getItem('cachedPathCoords');
  const newSegmentCache = await localforage.getItem('cachedSegmentCache');

  await updateManualRouteState(newUserClicks, newPathCoords, newSegmentCache)

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
  const elevationGainDisplay = formatElevation(calculateElevationGain(pathCoords));

  localforage.setItem('cachedUserClicks', userClicks)
  localforage.setItem('cachedPathCoords', pathCoords)
  
  setLastKnownDistanceKm(totalDistanceKm);

  userClicks.forEach((point, index) => {
    const feature = new Feature({
      geometry: new Point(point),
      type: "point",
    });
    feature.set("index", index);
    features.push(feature);
  });

  if (pathCoords.length > 1) {
    features.push(
      new Feature({
        geometry: new LineString(pathCoords),
        type: "line",
      }),
    );
  }

  manualRouteLayer = new VectorLayer({
    source: new VectorSource({ features }),
    style(feature) {
      const featureType = feature.get("type");
      if (featureType === "point") {
        const index = feature.get("index");
        const isStart = index === 0;
        const isEnd = index === userClicks.length - 1;

        if (isSnappedToEnd) {
          if (isStart) return getSavedPointStyle("Start/End", "#00A86B");
          if (isEnd) return getSavedPointStyle("", "#00A86B");
        }
        if (isStart) return getSavedPointStyle("Start", "#00A86B");
        if (isEnd) return getSavedPointStyle("End", "#D32F2F");
        return createManualPointStyle("", "#000", 6.5);
      }
      return new Style({
        stroke: new Stroke(getRouteStrokeStyle()),
      });
    },
  });

  map.addLayer(manualRouteLayer);

  const isOnePoint = pathCoords.length === 1;

  updateManualRouteStats(isOnePoint, distanceDisplay, etaDisplay, elevationGainDisplay, pathCoords);
  createElevationProfile(pathCoords);

  setTimeout(() => {
    map.getView().fit(manualRouteLayer.getSource().getExtent(), {
      padding: MAP_VIEW_PADDING,
      duration: 1200,
    });
    map.render();
  }, 100);
}

//#endregion

//#region MANUAL ROUTING

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
    resetElevationChart();
    if (saveRouteContainer && getCurrentMode() === "manual") {
      saveRouteContainer.style.display = "none";
      collapseSaveRouteContainer();
    }
    return false;
  }
  return true;
};

export async function updateManualRoute() {
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
  const elevationGainDisplay = formatElevation(calculateElevationGain(pathCoords));

  if (!window.appConfig.loggedIn) {
    await localforage.setItem('cachedUserClicks', userClicks);
    await localforage.setItem('cachedPathCoords', pathCoords);
    await localforage.setItem('cachedManualRouteStats', {"total_distance": totalDistanceKm, "elevation_gain": calculateElevationGain(pathCoords)});
  }
  setLastKnownDistanceKm(totalDistanceKm);

  userClicks.forEach((point, index) => {
    const feature = new Feature({
      geometry: new Point(point),
      type: "point",
    });
    feature.set("index", index);
    features.push(feature);
  });

  if (pathCoords.length > 1) {
    features.push(
      new Feature({
        geometry: new LineString(pathCoords),
        type: "line",
      }),
    );
  }

  manualRouteLayer = new VectorLayer({
    source: new VectorSource({ features }),
    style(feature) {
      const featureType = feature.get("type");
      if (featureType === "point") {
        const index = feature.get("index");
        const isStart = index === 0;
        const isEnd = index === userClicks.length - 1;

        if (isSnappedToEnd) {
          if (isStart) return getSavedPointStyle("Start/End", "#00A86B");
          if (isEnd) return getSavedPointStyle("", "#00A86B");
        }
        if (isStart) return getSavedPointStyle("Start", "#00A86B");
        if (isEnd) return getSavedPointStyle("End", "#D32F2F");
        return createManualPointStyle("", "#000", 6.5);
      }
      return new Style({
        stroke: new Stroke(getRouteStrokeStyle()),
      });
    },
  });

  map.addLayer(manualRouteLayer);

  const isOnePoint = pathCoords.length === 1;

  updateManualRouteStats(isOnePoint, distanceDisplay, etaDisplay, elevationGainDisplay, pathCoords);
  createElevationProfile(pathCoords);
};

function updateManualRouteStats(isOnePoint, distanceDisplay, etaDisplay, elevationGainDisplay, pathCoords) {
  let statsDiv = document.getElementById("route-stats");
  let firstRender = !statsDiv

  if (firstRender) {

    statsDiv = document.createElement("div");
    statsDiv.id = "route-stats";
    document.body.appendChild(statsDiv);

    statsDiv.innerHTML = createStatsPanel(distanceDisplay, etaDisplay, elevationGainDisplay);

    initChartToggleListener();   
  }
  else {
    document.getElementById("route-distance-display").textContent = distanceDisplay;
    document.getElementById("route-eta-display").textContent = etaDisplay;
    document.getElementById("route-elevation-gain-display").textContent = elevationGainDisplay;
  }

  const toggleChartButton = document.getElementById('toggle-elevation-chart');

  if (toggleChartButton) {
    toggleChartButton.classList.toggle('one-point-only', isOnePoint);
    toggleChartButton.disabled = isOnePoint;
  }
}

export function undoManualRoutePoint() {

  const { userClicks, segmentCache } = manualRouteState;

  // guard clause to prevent redundant running of code if userClicks is none / has no coords
  if (!userClicks || userClicks.length === 0) {
    if (saveContainer) saveContainer.style.display = 'none';
    document.getElementById('route-stats')?.remove();
    resetElevationChart();
    collapseSaveRouteContainer();
    return;
  }

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

async function manualRouteClickHandler(event) {

  try { 
    const coordinate = event.coordinate;

    const response = await addManualPoint(coordinate[0], coordinate[1]);

    // This checks success status
    if (!response || !response.success) {

      throw new Error(response?.message || "Sorry, there was an error whilst creating the path. ")
    }
  } catch (error) {
    if (error.cause) {
      showToast(error.cause, "error", null);
    }
    else {
      showToast("Sorry, there was an error whilst creating the path", "error", null);
      logError("Calculating Path", error.message || "Manual Route", null, "NO_PATH_FOUND");
    }
    return;
  }
}
//#endregion

//#region SAVE ROUTE PANEL

if (!window.appConfig.initialCurrentPath) {
    if (saveContainer) {
        saveContainer.style.display = 'none';
    }
}

export function updateSaveRouteContainer() {
  collapseSaveRouteContainer();
  return true;
}

//#endregion

//#region DRIVER.JS

async function handleSaveRouteTour() {
  await handleAutoRouteGeneration('54.454722, -3.267793', '54.454195, -3.211540');

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

//#region POINT INTERACTION

/**
 * Converts a human-entered [latitude, longitude] pair into Web Mercator (EPSG: 3857)
 * coordinates for OpenLayers.
 *
 * @param {[number, number]} latLon - An array containing latitude and longitude as [lat, lon].
 * @returns {ol.coordinate.Coordinate | null} The converted Web Mercator coordinate [x, y], or null if invalid.
 */
function toWebMercator(latLon) {
  if (!latLon || latLon.length < 2) return null;

  // OpenLayers expects [longitude, latitude]
  return fromLonLat([latLon[1], latLon[0]]);
}

/**
 * Handles a change on either the start or end coordinate input.
 */
function handleCoordEntryChange(entry, type) {
  const raw = entry?.value?.trim() ?? "";
  const parsed = parseCoordString(raw);

  // this returns if the string is in an invalid format
  if (!parsed) return;

  // this converts coords to Web Mercator when the value is lon/lat
  const mercatorCoords = toWebMercator(parsed);
  if (!mercatorCoords) return;

  const style = getSavedPointStyle(
    type === "start" ? "Start" : "End",
    "#074df0"
  );

  // returning prematurely if the point is not in Cumbria 
  if (!isPointInPolygon(toLonLat(mercatorCoords))) {
    showToast("Please choose a point within Cumbria.")
    return;
  }

  // this creates the point feature 
  const pointFeature = createPoint(
    mercatorCoords,
    style,
    type,
    type === "start" ? "Start" : "End"
  );

  // this adds the point feature and adds the OpenLayers interaction to it
  addStartEndPoint(pointFeature, interactivePointLayer, type);
  setUpPointInteraction([interactivePointLayer]);

  const map = getMap();
  map.renderSync();

  const startVal = startCoordEntry?.value?.trim();
  const endVal = endCoordEntry?.value?.trim();

  if (startVal && endVal) {
    handleAutoRouteGeneration(startVal, endVal);
  }
  else {
    moveMapToPosition(map, [parsed[1], parsed[0]], 1200, 12); // reversed order as moveMap expects coords in [Lon, Lat format], whereas parsed is in [Lat, Lon] format
  }
}

/**
 * Adds a start/end point feature to a vector layer, removing any existing feature of the same type first
 *
 * @param {ol.Feature} pointFeature The point feature to add
 * @param {ol.layer.Vector} vectorLayer The vector layer that will contain the feature
 * @param {string} type Feature type identifier (e.g. `"start"` or `"end"`)
 * @returns {void}
 */
function addStartEndPoint(pointFeature, vectorLayer, type) {
  const vectorLayerSource = vectorLayer.getSource();

  // this removes any existing features which are of the same type 
  vectorLayerSource.getFeatures()
  .filter(feature => feature.get('type') === type)
  .forEach(feature => vectorLayerSource.removeFeature(feature))

  vectorLayerSource.addFeature(pointFeature)
}

/**
 * Creates an OpenLayers point feature.
 *
 * @param {Array<number>} coordinates Coordinates in EPSG:3857.
 * @param {ol.style.Style} style Style to apply to the feature.
 * @param {string} type Logical point type (e.g. "start", "end", "waypoint").
 * @param {string} [label] Display label for the point.
 * @returns {ol.Feature}
 */
export function createPoint(coordinates, style, type, label) {

    const point = new Feature({
        geometry: new Point(coordinates)
    });

    point.set("type", type);
    point.set("label", label);
    point.setStyle(style);

    return point;
}

/**
 * Adds a translate interaction to start / end OpenLayers points
 * 
 * @param {Array} layers The layers that the interaction is to be applied upon 
 * @returns {void}
 */
export function setUpPointInteraction(layers) {
  const map = getMap();
  if (!map || !layers) return;

  const interactivePointLayerSource = interactivePointLayer.getSource();

  // this removes any previous interaction
  if (interactivePointLayerInteraction) {
    map.removeInteraction(interactivePointLayerInteraction);
  }

  // this makes the OpenLayers interaction
  interactivePointLayerInteraction = new Translate({
    layers: layers,
    filter: (feature) => feature.getGeometry() instanceof Point // (only accounts for points)
  });
  
  map.addInteraction(interactivePointLayerInteraction); 

  interactivePointLayerInteraction.on('translateend', (event) => {
    const movedFeature = event.features.item(0);
    if (!movedFeature) return;

    const newCoordinates = movedFeature.getGeometry().getCoordinates();
    const pointType = movedFeature.get("type");
    const newLonLatCoordinate = toLonLat(newCoordinates);
    const coordinateString = formatLatLon(newLonLatCoordinate, 6);

    // this updates the correct input
    if (pointType === "start") {
      startCoordEntry.value = coordinateString;
    } else if (pointType === "end") {
      endCoordEntry.value = coordinateString;
    }

    const startVal = startCoordEntry?.value?.trim();
    const endVal = endCoordEntry?.value?.trim();

    // this ensures routes are only recalculated if both points are present
    if (startVal && endVal) {
      handleAutoRouteGeneration(startVal, endVal);
    }

  });
}

//#endregion

//#region DELETING POINTS

function deselectSelectedPoint() {
  if (selectedPoint) {
    selectedPoint.setStyle(getSavedPointStyle(selectedPoint.get("name")));

    return null;
  }
  return
};

//#endregion

//#region SETTINGS

// ##### LIGHT / DARK THEME #####
export function applyTheme(theme) {
  const effective = theme === "system" ? getTheme() : theme;
  document.documentElement.classList.toggle("dark", effective === "dark");

  const currentCoordinates =  getCurrentMode() === "auto" ? getCurrentPathData() : manualRouteState.pathCoords

  resetElevationChart();
  if (currentCoordinates) {
    createElevationProfile(currentCoordinates);
    initChartToggleListener();
  };
}

// ##### HANDLING TOGGLING OF DISTANCE UNITS #####
function handleDistanceUnitToggle() {

  resetElevationChart();

  // if there is a manual route present
  if (manualRouteState.pathCoords.length > 0) {
    updateManualRoute();
  }
  else if (getLastAutoRouteStats()) {
    displayAutoRouteStats(getLastAutoRouteStats());
    toggleElevationChart();
  }
  else if (getLastLoadedRouteStats) {
    displayLoadedRouteStats(getLastLoadedRouteStats());
    toggleElevationChart();
  }
  initChartToggleListener();

  const coords =
    manualRouteState.pathCoords.length > 1
      ? manualRouteState.pathCoords
      : (getCurrentPathData() || getLoadedRouteCoordinates());

  if (coords && coords.length > 1) createElevationProfile(coords);
};

//#endregion

//#region KEYBOARD SHORTCUTS

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
    if ((e.metaKey && key === 'm' && e.shiftKey) || (e.ctrlKey && key === 'm')) {
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

//#endregion


//#region EVENT LISTENERS / INIT

function initInteractivePointLayer(map) {
  interactivePointLayer = new VectorLayer({
    source: new VectorSource(),
    zIndex: 1100 // above the route layer + saved points layer 
  });

  map.addLayer(interactivePointLayer);
}

function initPointDeleteHandlers() {
  if (!deletePointModal) return;

  // for hiding if clicking anywhere outside the modal
  deletePointModal.addEventListener("click", (e) => {
    closeModalUponOutsideClick(e, deletePointModalContent, deletePointModal)
  });

  // for deselecting the currently-selected point when the modal is closed 
  deletePointModal.addEventListener("close", deselectSelectedPoint);

  // for when the user clicks the 'exit' button on the modal
  deletePointModalExitButton?.addEventListener("click", () => {
    showModal(false, deletePointModal)
  });

  // for when the user clicks 'delete point' on the modal
  deletePointModalDeleteButton?.addEventListener("click", () => {
    deleteSavedPoint(selectedPoint)
  });
}

export function initUi() {
  const map = getMap();
  if (map) {
    initCursorManager(map, getCurrentMode, getClickMode);
  }

  applyTheme(getTheme());

  initSaveRoute();
  initPointDeleteHandlers();

  initInteractivePointLayer(map);


  // initial tour (automatic routing and saving the first route)
  handleInitialTour();

  // shows modal to load previous route if prompted to login after attempted save route
  handleInitialLoadCachedRoute()

  // These event listeners are for settings and preferences.
  setOnDistanceUnitChange(() => handleDistanceUnitToggle());

  // This ensures mobile users are warned about the poor design of the mobile web UI
  window.addEventListener("load", checkIfMobile);

  // This ensures that points are loaded near instantly 
  window.addEventListener('DOMContentLoaded', loadAndDisplaySavedPoints);

  // This ensures that the theme of the app changes if system settings switch to dark mode after sunset 
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    applyTheme(getTheme());
  });

  // These event listeners are for navigation panels.
  addClickListener(openSavedRoutesDashButton, openSavedRoutesDash, "click");
  addClickListener(closeSavedRoutesDashButton, closeSavedRoutesDash, "click");

  addClickListener(settingOpenButton, openSettings, "click");
  addClickListener(settingCloseButton, closeSettings, "click");

  addClickListener(importRouteOpenButton, openImportRoute, "click");
  addClickListener(importRouteCloseButton, closeImportRoute, "click");
  addClickListener(importRouteCancelButton, cancelRouteImport, "click");

  addClickListener(loginNavBarButton, () => window.location.href = "/login-page", 'click')
  addClickListener(logoutNavBarButton, logout, 'click')

  addClickListener(reportIssueOpenButton, () => showReportIssueModal(true), "click");


  // These event listeners are for route import.
  importRouteFileInput.addEventListener("change", (e) => {
    const file = event.target.files[0];
    validateFileInput(file);
  });


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
  addClickListener(startCoordEntry, () => handleCoordEntryChange(startCoordEntry, "start"), 'change')
  addClickListener(endCoordEntry, () => handleCoordEntryChange(endCoordEntry, "end"), 'change')

  // These event listeners are for manual route creation.
  addClickListener(clearManualRouteButton, clearManualRoute, "click");
  addClickListener(undoManualRouteButton, undoManualRoutePoint, "click");
  addClickListener(redoManualRouteButton, redoManualRoutePoint, "click");
  addClickListener(noRouteCreateButton, noRouteCreateFunction, "click");

  // These event listeners are for route saving.
  addClickListener(saveRouteToggleButton, toggleSaveRouteContainer, "click");

  // These event listeners are for keyboard shortcuts.
  addClickListener(document, handleKeyboardShortcuts, "keydown");

  // These event listeners are for the login modal
  addClickListener(loginModalExitButton, () => showModal(false, loginModal), 'click');
  addClickListener(loginModalLoginButton, loginModalLogin, 'click');
  addClickListener(loginModal, (e) => closeModalUponOutsideClick(e, loginModalContent, loginModal), 'click');

  // These event listeners are for the report issue modal
  addClickListener(reportIssueModalExit, () => showReportIssueModal(false), "click");
  addClickListener(reportIssueModalSubmit, () => handleReportIssueSubmission(reportIssueTitleInput.value.trim(), reportIssueTextAreaInput.value.trim()), "click");

  // These event listeners are for the donate modal
  addClickListener(donateModalCloseButton, () => showModal(false, donateModal), "click");
  addClickListener(donateModalMaybeLaterButton, () => showModal(false, donateModal), "click");
  addClickListener(donateButton, () => showModal(true, donateModal), "click");
  addClickListener(donateModal, (e) => closeModalUponOutsideClick(e, donateModalContent, donateModal), "click");

  // These event listeners are for the load last route modal
  addClickListener(loadLastRouteModalDismissButton, discardLastLoadedRoute, "click");
  addClickListener(loadLastRouteModalLoadButton, handleLoadCachedRoute, "click");
  addClickListener(loadLastRouteModal, (e) => closeModalUponOutsideClick(e, loadLastRouteModalContent, loadLastRouteModal), "click");

  onMapClick(mapClickHandler);

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