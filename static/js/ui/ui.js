//#region IMPORTS

// Open Layers Imports
import { toLonLat, fromLonLat } from "ol/proj.js";
import { Point, LineString } from "ol/geom.js"
import VectorSource from "ol/source/Vector.js";
import VectorLayer from "ol/layer/Vector.js";
import Feature from "ol/Feature.js";
import { Translate } from "ol/interaction.js"

// constants
import { MAP_VIEW_PADDING } from "../constants.js";

// LocalForage
import localforage from "localforage";

// Local File Imports

import { formatLatLon } from "../utils/routing-utils.js";

import {
  createManualPointStyle
} from "../utils/style-utils.js";

import {
  formatDistance,
  formatETA,
  formatElevation
} from "../utils/format-utils.js";

import {
  showToast,
  addClickListener,
  removeDOMElement,
  createStatsPanel,
  parseCoordString,
  showModal,
  closeModals,
  closeModalUponOutsideClick
} from "../utils/ui-utils.js";

import { moveMapToPosition } from "../utils/map-utils.js";

import { addManualPoint, replaceIntermediaryPoint } from "../routing/index.js";

import {
  getMap,
  onMapClick,
  getRouteLayer,
  getManualRouteLayer,
  removeManualRouteLayer
} from "../map.js";

import {
  loadAndDisplaySavedPoints,
  getSavedPointsLayer,
  saveNewPoint,
  deleteSavedPoint
} from "../saved_points/index.js";

import {
  getSavedPointStyle,
  getSelectedPointStyle,
} from "../saved_points/style.js";

import {
  initSaveRoute
} from "../routes/index.js";

import {
  getCurrentMode,
  getCurrentPathData,
  setCurrentPathData,
  getLoadedRouteCoordinates,
  clearPathState,
  clearManualRouteState,
  manualRouteState,
  setLastKnownDistanceKm,
  getLastAutoRouteStats,
  getLastLoadedRouteStats,
  clearLastAutoRouteStats,
  clearLastLoadedRouteStats,
  isPointInPolygon,
} from "../routes/routeState.js";

import {
  initCursorManager,
  updateCursor,
  setCursor
} from "../cursorManager.js";

import { setOnDistanceUnitChange } from "../settings.js";

import { getTheme } from "../settingsState.js";

import { displayLoadedRouteStats } from "../routes/loadRoute.js";

import { createElevationProfile, initChartToggleListener, resetElevationChart, setHoverPointFeature, toggleElevationChart } from "../elevationChart.js";

import { displayImportedRouteCard, processImportedRouteFile } from "../importRoute.js";

import { 
  createAutomaticRoutingTour,
  createImportRoutePanelTour,
  createSavedRouteDashboardTour,
  createSavingRoutesTour,
  createSettingsTour
} from "../tours/tours.js";

import { logout } from "../auth/auth.js";
import { logError } from "../utils/logError-utils.js";
import { ERROR_MESSAGES } from "../utils/error-contants.js";

//#endregion

//#region VAR / CONST DECLARATIONS

export const defaultCentre = Array.isArray(window.appConfig?.mapInitialCentre)
  ? window.appConfig.mapInitialCentre
  : [-3.198308, 54.465458];

const setStartCoordButton = document.getElementById("set-start-coord-button");
const setEndCoordButton = document.getElementById("set-end-coord-button");

const startCoordEntry = document.getElementById("start-point-entry");
const endCoordEntry = document.getElementById("end-point-entry");

const homeButton = document.getElementById("home-button");

const generatePathButton = document.getElementById("generate-path-button");

const clearRouteButton = document.getElementById('clear-route-button');

const undoManualRouteButton = document.getElementById("undo-manual-route");
const redoManualRouteButton = document.getElementById("redo-manual-route");

const searchEntry = document.getElementById("search-entry");
const searchForAreaButton = document.getElementById("search-for-area-button");

const mapElement = document.getElementById("map");


// saved route div 
const saveRouteDiv = document.getElementById("save-route");
const routeNameEntry = document.getElementById("route-name");
const saveContainer = document.getElementById('save-route-container');
const saveRouteToggleButton = document.getElementById("save-route-toggle-button");
const saveRouteContainer = document.getElementById('save-route-container');

// Navigation Rail Buttons 
const donateModalOpenButton = document.getElementById('donate-button');
const reportIssueOpenButton = document.getElementById('report-issues-open-button')
const shortcutsModalOpenButton = document.getElementById('sidenav-shortcuts-button');
const loginNavBarButton = document.getElementById('sidenav-login-button');
const logoutNavBarButton = document.getElementById('sidenav-logout-button');

// delete point modal
const deletePointModal = document.getElementById("delete-point-confirmation-dialog");
const deletePointModalNameDisplay = document.getElementById("point-name-display");
const deletePointModalDeleteButton = document.getElementById("point-delete-delete-button");
const deletePointModalExitButton = document.getElementById("point-delete-exit-button");
const deletePointModalContent = deletePointModal.querySelector('.modal-content');

// save point modal
const savePointModal = document.getElementById('save-point-dialog');
const savePointModalContent = savePointModal.querySelector('.modal-content');
const savePointModalInput = document.getElementById('save-point-dialog-name-input');
const savePointModalCloseButton = document.getElementById('save-point-dialog-close');
const savePointModalSaveButton = document.getElementById('save-point-dialog-save');

// login modal
const loginModal = document.getElementById('login-dialog');
const loginModalLoginButton = document.getElementById('login-dialog-login');
const loginModalExitButton = document.getElementById('login-dialog-exit');
const loginModalContent = loginModal.querySelector('.modal-content');

// report issue modal
const reportIssueModal = document.getElementById('report-issue-dialog');
const reportIssueModalSubmit = document.getElementById('report-issue-dialog-submit');
const reportIssueModalExit = document.getElementById('report-issue-dialog-exit');
const reportIssueTitleInput = document.getElementById("report-issue-title");
const reportIssueTextAreaInput = document.getElementById("report-issue-description");

// donate modal
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

// Keyboard Shortcuts Modal
const shortcutsModal = document.getElementById('shortcuts-dialog');
const shortcutsModalContent = shortcutsModal.querySelector('.modal-content');
const shortcutsModalCloseButton = document.getElementById('shortcuts-dialog-close-button');

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
let automaticRoutingTourDriver;
let savingRoutesTourDriver;


// grouped elements
const allowedFileTypes = ['.gpx', '.kml', '.geojson', '.fit'];

let clickMode = null;
let selectedPoint = null;
let manualRouteFeature = null;

// Start and End points 

let interactivePointLayerInteraction = null; // holds the OpenLayer interaction for the start and end points 
let interactivePointLayer = null; // stores the vector layer which holds the point features 

//#endregion

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
 * @param {Boolean} show True to show the modal, false to hide the modal
 */
function showReportIssueModal(show) {
  if (!reportIssueModal) return;
  if (show) {
    reportIssueModal.showModal();
  } else {
    reportIssueModal.close();
    reportIssueTitleInput.value = "";
    reportIssueTextAreaInput.value = "";
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

/**
 * 
 * @param {HTMLInputElement} entry 
 * @param {number[]} coordinate In Web Mercator projection
 */
function setCoordEntry(entry, coordinate) {
  const lonLat = toLonLat(coordinate);

  entry.value = formatLatLon(lonLat, 6);
  entry.placeholder = "Coordinates";
  entry.classList.remove("input-error");
  entry.classList.remove('is-active')

  clickMode = null;
  updateCursor();
}

/**
 * Updates the start and end point entries relative to manualRouteState.userClicks
 * 
 * @returns {void}
 */
function syncCoordinateInputs() {
  const { userClicks } = manualRouteState;

  startCoordEntry.value = userClicks.length > 0 ? formatLatLon(toLonLat(userClicks[0]), 6) : "";
  endCoordEntry.value = userClicks.length > 1 ? formatLatLon(toLonLat(userClicks[userClicks.length - 1]), 6) : "";
}

//#endregion

//#region OPEN/CLOSE PANEL FUNCTIONS

// this is for the 'create route' button on the panel shown on the saved routes dashboard when the user has no saved routes
function noRouteCreateFunction() {
  closeSavedRoutesDash()
}

/**
 * Closes all panels accessible from the navigation raile
 * @returns {void}
 */
function closePanels() {
  const panels = [savedRoutesDashContent, importRoutePanel, settingPanel];

  panels.forEach(panel => {
    if (panel.style.width)
    panel.style.width = "0";
  });
};

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
      showToast(error.cause || "Sorry, there was an error importing your route, please try again later.")
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
      showToast(err.cause || "Sorry, there was an error importing your route, please try again later.");
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
    throw new Error(error.message, {cause: error.cause || "Sorry, there was an error validating your file, please try again later."})
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

//#region MAP CLICK HANDLERS

async function manualRouteClickHandler(event) {

  if (handleSelectSavedPoint(event)) return;

  generatePathButton.disabled = true;
  generatePathButton.classList.add('loading');

  setCoordInputActiveState(startCoordEntry, false);
  setCoordInputActiveState(endCoordEntry, false);

  try { 
    const coordinate = event.coordinate;
    const type = clickMode === "setStart"
      ? "start"
      : clickMode === "setEnd"
        ? "end"
        : "normal";

    if (type === "end" && manualRouteState.userClicks.length === 0) {
      throw new Error("Start point required", { cause: "Set a start point before setting the end point." });
    }

    if (manualRouteState.userClicks.length === 0) clearAutoRoute();

    const response = await addManualPoint(coordinate[0], coordinate[1], type);

    // This checks success status
    if (!response || !response.success) {

      throw new Error(response?.message || "Error : manualRouteClickHandler()")
    }

    clickMode = null;
    syncCoordinateInputs();
    updateCursor();
  } catch (error) {
    if (error.cause) {
      console.error(error);
      showToast(error.cause, "error", null);
    }
    else {
      showToast(ERROR_MESSAGES.ROUTING.NO_PATH_FOUND, "error", null);
      logError("Calculating Path", error.message || "Manual Route", null, "NO_PATH_FOUND");
    }
    return;
  }
  finally {
    generatePathButton.disabled = false;
    generatePathButton.classList.remove('loading');
  }
}

export function getClickMode() {
  return clickMode;
}

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

}

export function clearManualRoute() {
  const map = getMap();
  if (!map) return;

  clearManualRouteState();
  removeManualRouteLayer();
  manualRouteFeature = null;

  if (interactivePointLayer) {
    interactivePointLayer.getSource().clear();
  }

  // this also clears the permanent route layer (in case anything was drawn there)
  getRouteLayer()?.getSource()?.clear();

  document.getElementById("route-stats")?.remove();
  if (saveContainer) saveContainer.style.display = "none";
  if (startCoordEntry) startCoordEntry.value = "";
  if (endCoordEntry) endCoordEntry.value = "";
  updateSaveRouteContainer();
  resetElevationChart();
}

export function homeButtonFunction() {
  const map = getMap();
  if (!map) return;

  // closes any modals / panels to return to the map view 
  closeModals();
  closePanels();

  if (map.getView().getAnimating()) {
    return;
  }

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

//#region CACHED ROUTES

async function handleLoadCachedRoute() {
  if (loadLastRouteModal) showModal(false, loadLastRouteModal); // hides modal 

  try {
    handleLoadManualCachedRoute()
  }
  catch(error) {
    showToast("There was an error loading your last route", "error", null);
    throw new Error(error.message)
  }
  finally {
    // localforage.clear();
  }
}

async function handleLoadManualCachedRoute() {

  const map = getMap();

  const [userClicks, pathCoords, segmentCache] = await Promise.all([
    localforage.getItem("cachedUserClicks"),
    localforage.getItem("cachedPathCoords"),
    localforage.getItem("cachedSegmentCache")
  ]);

  if (!Array.isArray(userClicks) || !Array.isArray(pathCoords) || !segmentCache || typeof segmentCache !== "object") {
    throw new Error("Cached manual route is incomplete");
  }

  manualRouteState.userClicks = userClicks;
  manualRouteState.pathCoords = pathCoords;
  manualRouteState.segmentCache = segmentCache;
  manualRouteState.redoStack = [];
  manualRouteFeature = null;
  removeManualRouteLayer();
  await updateManualRoute();
  syncCoordinateInputs();

  const manualRouteLayer = getManualRouteLayer();
  if (pathCoords.length > 0) {
    setTimeout(() => {
      getMap()?.getView().fit(manualRouteLayer.getSource().getExtent(), {
        padding: MAP_VIEW_PADDING,
        duration: 1200,
      });
    }, 50);

    map.renderSync();
  }
}

//#endregion

//#region MANUAL ROUTING

/**
 * Creates a manual route with a given start and end point 
 * 
 * @param {number} [start] 
 * @param {number} [end] 
 * @returns {void}
 */
async function handleManualRouteGeneration(start = null, end = null) {

  const startPoint = start || startCoordEntry?.value || "";
  const endPoint = end || endCoordEntry?.value || "";

  if (!validateInputCoords(startPoint, endPoint)) return;

  const parsedStart = parseCoordString(startPoint);
  const parsedEnd = parseCoordString(endPoint);
  const startMercator = toWebMercator(parsedStart);
  const endMercator = toWebMercator(parsedEnd);

  if (!startMercator || !endMercator) return;

  generatePathButton.disabled = true;
  generatePathButton.classList.add("loading");

  try {
    clearManualRoute();
    await localforage.setItem("lastRoutingMode", "manual");

    await addManualPoint(startMercator[0], startMercator[1]);
    await addManualPoint(endMercator[0], endMercator[1]);

    syncCoordinateInputs();
  } 
  catch (error) {
    clearManualRoute();
    showToast(error.cause || ERROR_MESSAGES.ROUTING.PATH_CREATION_FAILED, "error");
  } 
  finally {
    generatePathButton.disabled = false;
    generatePathButton.classList.remove("loading");
  }
}

/**
 * Handles the clearing of route stats and save button if there are no current coordinates
 *
 * @returns {void}
 */
function cleanRouteUI() {
  document.getElementById("route-stats")?.remove();
  resetElevationChart();
  if (saveRouteContainer && getCurrentMode() === "manual") {
    saveRouteContainer.style.display = "none";
    collapseSaveRouteContainer();
  }
};

/**
 * Updates key point features, such as start, end and intermediary points 
 * 
 * @param {number[][]} userClicks 
 * @returns {void}
 */
function syncManualEndpointMarkers(userClicks) {
  if (!interactivePointLayer) return;
  const source = interactivePointLayer.getSource();

  source.clear();

  if (userClicks.length === 0) return;

  const isClosed = manualRouteState.isSnapped


  const startPointFeature = createPoint(
    userClicks[0],
    getSavedPointStyle(isClosed ? "Start/End" : "Start", "#00A86B"),
    isClosed ? "start-end" : "start",
    isClosed ? "Start/End" : "Start"
  );
  
  addStartEndPoint(
    startPointFeature,
    interactivePointLayer,
    isClosed ? "start-end" : "start"
  );

  
  if (userClicks.length >= 2 && !isClosed) {

    const endPointFeature = createPoint(
      userClicks[userClicks.length - 1], 
      getSavedPointStyle("End", "#D32F2F"),
      "end",
      "End"
    )

    addStartEndPoint(
      endPointFeature,
      interactivePointLayer,
      "end"
    );
  }

  // This adds intermediary points (if there are any)
  for (let i = 1; i < userClicks.length - 1; i++) {

    const intermediaryPointFeature = createPoint(
      userClicks[i],
      createManualPointStyle(),
      "route-waypoint",
      undefined,
      i
    );

    addStartEndPoint(
      intermediaryPointFeature,
      interactivePointLayer,
      "route-waypoint"
    );
  }

  setUpPointInteraction([interactivePointLayer]);
}

export async function updateManualRoute() {
  const map = getMap();
  if (!map) return;

  let manualRouteLayer = getManualRouteLayer();

  try {

    const { userClicks, pathCoords } = manualRouteState;
    syncManualEndpointMarkers(userClicks);


    if (userClicks.length === 0) {
      cleanRouteUI();
      return;
    } else {
      saveContainer.style.display = "flex";
    }

    if (pathCoords.length > 1) {
      if (!manualRouteFeature) {
        manualRouteFeature = new Feature({
          geometry: new LineString(pathCoords),
          type: "line",
        });

        manualRouteLayer.getSource().addFeature(manualRouteFeature);
      } else {
        manualRouteFeature.getGeometry().setCoordinates(pathCoords);
      }
    } else {
      manualRouteLayer.getSource().removeFeature(manualRouteFeature);
      manualRouteFeature = null;
    }

    if (pathCoords.length === 1) {
      setLastKnownDistanceKm(0);
      updateManualRouteStats(true, formatDistance(0), formatETA(0), formatElevation(0));
      resetElevationChart();
      if (!window.appConfig.loggedIn) {
        await localforage.setItem("cachedUserClicks", userClicks);
        await localforage.setItem("cachedPathCoords", pathCoords);
        await localforage.setItem("cachedManualRouteStats", {
          total_distance: 0,
          eta_seconds: 0,
          elevation_gain: 0
        });
      }
      return;
    }

    const transformedPathCoords = pathCoords.map(coord => {
      const [lon, lat] = toLonLat(coord);

      return coord.length === 3 ? [lon, lat, coord[2]] : [lon, lat]
    });

    const routeStatsResponse = await fetch(window.appConfig.apiNormaliseRouteStatsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        coordinates: transformedPathCoords
      }),
    });

    const routeStats = await routeStatsResponse.json().catch(() => ({}));

    if (
      !routeStatsResponse.ok ||
      !Number.isFinite(Number(routeStats.distance_km)) ||
      !Number.isFinite(Number(routeStats.eta_seconds)) ||
      !Number.isFinite(Number(routeStats.elevation_gain_m))
    ) {
      throw new Error(routeStats.message || "ERROR : updateManualRoute()", {cause : routeStats.user_message || ERROR_MESSAGES.ROUTING.PATH_CREATION_FAILED})
    };

    // sets the source of truth for distance values 
    setLastKnownDistanceKm(routeStats.distance_km);


    // sets display values 
    const distanceDisplay = formatDistance(routeStats.distance_km);
    const etaDisplay = formatETA(routeStats.eta_seconds);
    const elevationGainDisplay = formatElevation(routeStats.elevation_gain_m);


    // caches route info if not logged in, used to allow user to continue routing if they login 
    if (!window.appConfig.loggedIn) {
      await localforage.setItem('cachedUserClicks', userClicks);
      await localforage.setItem('cachedPathCoords', pathCoords);
      await localforage.setItem('cachedManualRouteStats', {
        total_distance: Number(routeStats.distance_km),
        eta_seconds: Number(routeStats.eta_seconds),
        elevation_gain: Number(routeStats.elevation_gain_m)
      });
    }

    const isOnePoint = pathCoords.length === 1;

    updateManualRouteStats(isOnePoint, distanceDisplay, etaDisplay, elevationGainDisplay);
    createElevationProfile(pathCoords);

  }
  catch (error) {
    throw new Error(error.message || "ERROR : updateManualRoute()", {cause : error.cause || ERROR_MESSAGES.ROUTING.PATH_CREATION_FAILED});
  }
};

function updateManualRouteStats(isOnePoint, distanceDisplay, etaDisplay, elevationGainDisplay) {
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

export async function undoManualRoutePoint() {

  const { userClicks, segmentCache } = manualRouteState;

  // guard clause to prevent redundant running of code if userClicks is none / has no coords
  if (!userClicks || userClicks.length === 0) {
    if (saveContainer) saveContainer.style.display = 'none';
    document.getElementById('route-stats')?.remove();
    resetElevationChart();
    collapseSaveRouteContainer();
    await updateManualRoute();
    syncCoordinateInputs();
    return;
  }

  // this removes the last click
  const removed = userClicks.pop();
  manualRouteState.isSnapped = false;

  // this adds the removed point to the redo stack
  manualRouteState.redoStack.push(removed);

  manualRouteState.pathCoords = []; // resets pathCoord array

  // this updates the UI and exits if there are no clicks
  if (userClicks.length === 0) {
    await updateManualRoute();
    syncCoordinateInputs();
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
  await updateManualRoute();
  syncCoordinateInputs();
};

async function redoManualRoutePoint() {
  const restoredPoint = manualRouteState.redoStack.pop();
  
  if (!restoredPoint) return;

  try {
    await addManualPoint(restoredPoint[0], restoredPoint[1], "normal", { clearRedo: false });
    syncCoordinateInputs();
  } catch (error) {
    manualRouteState.redoStack.push(restoredPoint);
    showToast(error.cause || "Sorry, we couldn't redo your point.", "error", null);
  }
};

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
  await handleManualRouteGeneration('54.454722, -3.267793', '54.454195, -3.211540');

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
 *
 * @param {HTMLInputElement} entry
 * @param {"start" | "end"} type
 */
async function handleCoordEntryChange(entry, type) {
  const raw = entry?.value?.trim() ?? "";
  const parsed = parseCoordString(raw);

  // this returns if the string is in an invalid format
  if (!parsed) return;

  // this converts coords to Web Mercator when the value is lon/lat
  const mercatorCoords = toWebMercator(parsed);
  if (!mercatorCoords) return;

  // returning prematurely if the point is not in Cumbria 
  if (!isPointInPolygon(toLonLat(mercatorCoords))) {
    showToast("Please choose a point within Cumbria.")
    return;
  }

  const map = getMap();
  map.renderSync();

  try {
    if (type === "end" && manualRouteState.userClicks.length === 0) {
      showToast("Set a start point before setting the end point.", "error");
      entry.value = "";
      return;
    }

    await addManualPoint(mercatorCoords[0], mercatorCoords[1], type);
    syncCoordinateInputs();
  } catch (error) {
    syncCoordinateInputs();
    showToast(error.cause || ERROR_MESSAGES.ROUTING.PATH_CREATION_FAILED, "error");
  }
}

/**
 * Adds a start/end point feature to a vector layer, removing any existing feature of the same type first
 *
 * @param {ol.Feature} pointFeature The point feature to add
 * @param {ol.layer.Vector} vectorLayer The vector layer that will contain the feature
 * @param {"start"|"end"|"route-waypoint"} type Feature type identifier (e.g. `"start"` or `"end"`)
 * @returns {void}
 */
function addStartEndPoint(pointFeature, vectorLayer, type) {
  const vectorLayerSource = vectorLayer.getSource();

  // this removes any existing features which are of the same type (for start and end points)
  if (type !== "route-waypoint") {
    vectorLayerSource.getFeatures()
      .filter(feature => feature.get('type') === type)
      .forEach(feature => vectorLayerSource.removeFeature(feature));
  }

  vectorLayerSource.addFeature(pointFeature)
}

/**
 * Creates an OpenLayers point feature.
 *
 * @param {Array<number>} coordinates Coordinates in EPSG:3857.
 * @param {ol.style.Style} style Style to apply to the feature.
 * @param {"start"|"end"|"start-end"|"route-waypoint"} type Logical point type (e.g. "start", "end", "waypoint").
 * @param {"Start"|"End"|"Start/End"|undefined} [label] Display label for the point.
 * @param {number} [index] For intermediary points
 * @returns {ol.Feature}
 */
export function createPoint(coordinates, style, type, label, index) {

    const point = new Feature({
        geometry: new Point(coordinates)
    });

    point.set("type", type);
    point.set("label", label);
    if (type === "route-waypoint") point.set("index", index);
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

  interactivePointLayerInteraction.on('translateend', async (event) => {
    const movedFeature = event.features.item(0);
    if (!movedFeature) return;

    const newCoordinates = movedFeature.getGeometry().getCoordinates();
    const pointType = movedFeature.get("type");
    try {
      if (!isPointInPolygon(toLonLat(newCoordinates))) {
        throw new Error("Waypoint moved outside Cumbria", { cause: ERROR_MESSAGES.ROUTING.OUTSIDE_CUMBRIA });
      }

      if (pointType === "start") {
        await addManualPoint(newCoordinates[0], newCoordinates[1], "start");
      } else if (pointType === "end" || pointType === "start-end") {
        await addManualPoint(newCoordinates[0], newCoordinates[1], "end");
      } else if (pointType === "route-waypoint") {
        await replaceIntermediaryPoint(movedFeature.get("index"), newCoordinates);
      }
      syncCoordinateInputs();
    } catch (error) {
      syncManualEndpointMarkers(manualRouteState.userClicks);
      syncCoordinateInputs();
      showToast(error.cause || ERROR_MESSAGES.ROUTING.PATH_CREATION_FAILED, "error");
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

/**
 * Handles user clicks on saved points 
 * 
 * @param {Event} event 
 * @returns {boolean} True if a point has been clicked and false if not
 */
function handleSelectSavedPoint(event) {
  const map = getMap();

  if (selectedPoint) {
    selectedPoint.setStyle(getSavedPointStyle(selectedPoint.get("name")));
    selectedPoint = null;
  }

  let featureClicked = false;
  let newSelection = null;
  const savedPointsLayer = getSavedPointsLayer();

  map.forEachFeatureAtPixel(event.pixel, (feature, layer) => {
    if ( layer === savedPointsLayer && feature.getGeometry() instanceof Point ) {
      newSelection = feature;
      featureClicked = true;
      return;
    }
  });

  if (newSelection) {
    selectedPoint = newSelection;
    const pointName = selectedPoint.get("name");
    selectedPoint.setStyle(getSelectedPointStyle(pointName));
    deletePointModalNameDisplay.textContent = pointName;
    showModal(true, deletePointModal);
    return true;
  } else {
    return false;
  }
}

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
  else if (getLastLoadedRouteStats()) {
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

/**
 * Orchestrates keyboard shortcuts process and order of events  
 * 
 * @param {Event} e 
 * @returns {void}
 */
function handleKeyboardShortcuts(e) {

  // this returns if the user is typing 
  if (document.activeElement.tagName === "INPUT" || 
      document.activeElement.tagName === "TEXTAREA") {
        return;
  };

  // this gets the key that is pressed
  const key = e.key.toLowerCase();
  const mode = getCurrentMode();

  // cmd / ctrl signals a routing action rather than navigation
  if (e.ctrlKey || e.metaKey) {
    appShortcuts(e, key)
    if (mode === "manual") {
      manualRouteShortcuts(e, key) 
    };
  }
  else {
    navigationShortcuts(e, key)
  }
};

/**
 * Handles general shortcuts
 * 
 * @param {Event} e 
 * @param {String} key 
 * @returns 
 */
function appShortcuts(e, key) {

  const isModifier = e.metaKey || e.ctrlKey;

  // resets view and inputs 
  if (isModifier && e.shiftKey && key === 'h') {
    e.preventDefault();
    homeButtonFunction();
    return;
  };

  // focuses on the search input entry 
  if (isModifier && e.shiftKey && key === 'k') {
    e.preventDefault();
    searchEntry.focus();
  }

  return;
}

/**
 * Handles shortcuts for manual routing 
 * 
 * @param {Event} e 
 * @param {String} key 
 * @returns {void}
 */
function manualRouteShortcuts(e, key) {
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
}

/**
 * Handles shortcuts for opening/closing panels and modals 
 * 
 * @param {Event} e 
 * @param {String} key 
 * @returns {void}
 */
function navigationShortcuts(e, key) {
  
  // saved routes dash
  if (key === '1') {
    handlePanelShortcut(
      e, 
      savedRoutesDashContent, 
      () => openSavedRoutesDash(),
      () => closeSavedRoutesDash()
    );
    return;
  }

  // import route panel
  if (key === '2') {
    handlePanelShortcut(
      e, 
      importRoutePanel, 
      () => openImportRoute(),
      () => closeImportRoute()
    );
    return;
  }
  
  // settings panel
  if (key === '3') {
    handlePanelShortcut(
      e,
      settingPanel,
      () => openSettings(),
      () => closeSettings()
    );
    return;
  }

  // report issue modal
  if (key === '4') {
    handleModalShortcut(
      e,
      reportIssueModal
    );
    return;
  }

  // donate modal
  if (key === '5') {
    handleModalShortcut(
      e,
      donateModal
    )
    return;
  }

  // shortcuts modal
  if (key === '6') {
    handleModalShortcut(
      e,
      shortcutsModal
    )
    return;
  };
}

/**
 * @param {Event} e
 * @param {HTMLDivElement} panel 
 * @param {Function} open 
 * @param {Function} close 
 * @returns {void}
 */
function handlePanelShortcut(e, panel, open, close) {
  e.preventDefault();

  if (loginModal.open) {
    loginModal.close();
    return;
  };

  closeModals();

  if (panel.style.width === "100vw") {
    close();
  } else {
    closePanels();
    open();
  }
}

/**
 * Helper to open/close modals
 * 
 * @param {Event} e 
 * @param {HTMLDialogElement} modal 
 * @returns {void}
 */
function handleModalShortcut(e, modal) {
  e.preventDefault();

  closePanels();

  if (modal.open) {
    modal.close();
  }
  else {
    closeModals();
    showModal(true, modal)
  }
}
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

  deletePointModal.addEventListener("click", (e) => {
    closeModalUponOutsideClick(e, deletePointModalContent, deletePointModal)
  });

  deletePointModal.addEventListener("close", deselectSelectedPoint);

  deletePointModalExitButton?.addEventListener("click", () => {
    showModal(false, deletePointModal)
  });

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

  window.addEventListener("load", checkIfMobile);
  window.addEventListener('DOMContentLoaded', loadAndDisplaySavedPoints);
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
    const file = e.target.files[0];
    validateFileInput(file);
  });


  addClickListener(importRouteSubmitButton, handleRouteImport, "click");
  routeInputTypes.forEach(radio => {
    radio.addEventListener('change', handleRouteImportType);
  });

  // These event listeners are for the routing panel
  addClickListener(searchForAreaButton, searchArea, "click");

  addClickListener(setStartCoordButton, setStartCoord, "click");
  addClickListener(setEndCoordButton, setEndCoord, "click");

  addClickListener(startCoordEntry, () => handleCoordEntryChange(startCoordEntry, "start"), 'change')
  addClickListener(endCoordEntry, () => handleCoordEntryChange(endCoordEntry, "end"), 'change')

  addClickListener(clearRouteButton, clearManualRoute, "click");
  addClickListener(homeButton, homeButtonFunction, "click");

  addClickListener(undoManualRouteButton, undoManualRoutePoint, "click");
  addClickListener(redoManualRouteButton, redoManualRoutePoint, "click");
  addClickListener(noRouteCreateButton, noRouteCreateFunction, "click");

  generatePathButton.addEventListener("click", () => handleManualRouteGeneration());

  // These event listeners are for route saving.
  addClickListener(saveRouteToggleButton, toggleSaveRouteContainer, "click");

  // These event listeners are for keyboard shortcuts.
  addClickListener(document, handleKeyboardShortcuts, "keydown");

  // Login Modal
  addClickListener(loginModalExitButton, () => showModal(false, loginModal), 'click');
  addClickListener(loginModalLoginButton, loginModalLogin, 'click');
  addClickListener(loginModal, (e) => closeModalUponOutsideClick(e, loginModalContent, loginModal), 'click');

  // Save Point Modal
  addClickListener(savePointModalCloseButton, () => showModal(false, savePointModal), "click");
  addClickListener(savePointModal, (e) => closeModalUponOutsideClick(e, savePointModalContent, savePointModal), "click");

  // Report Issue Modal
  addClickListener(reportIssueModalExit, () => showReportIssueModal(false), "click");
  addClickListener(reportIssueModalSubmit, () => handleReportIssueSubmission(reportIssueTitleInput.value.trim(), reportIssueTextAreaInput.value.trim()), "click");

  // Donate Modal
  addClickListener(donateModalCloseButton, () => showModal(false, donateModal), "click");
  addClickListener(donateModalMaybeLaterButton, () => showModal(false, donateModal), "click");
  addClickListener(donateModalOpenButton, () => showModal(true, donateModal), "click");
  addClickListener(donateModal, (e) => closeModalUponOutsideClick(e, donateModalContent, donateModal), "click");

  // Load Last Route Modal
  addClickListener(loadLastRouteModalDismissButton, discardLastLoadedRoute, "click");
  addClickListener(loadLastRouteModalLoadButton, handleLoadCachedRoute, "click");
  addClickListener(loadLastRouteModal, (e) => closeModalUponOutsideClick(e, loadLastRouteModalContent, loadLastRouteModal), "click");

  // Keyboard Shortcuts Modal
  addClickListener(shortcutsModalOpenButton, () => showModal(true, shortcutsModal), "click");
  addClickListener(shortcutsModalCloseButton, () => showModal(false, shortcutsModal), "click");
  addClickListener(shortcutsModal, (e) => closeModalUponOutsideClick(e, shortcutsModalContent, shortcutsModal), "click");

  onMapClick(manualRouteClickHandler);

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
