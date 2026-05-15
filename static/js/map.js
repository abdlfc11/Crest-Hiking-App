// All map/application logic. Uses values from map_jinja.js

// ================
// BASIC ELEMENT REFS & STATE
// ================

import { logout, login, switchToRegistering } from "./auth.js";
import { tileLayer, createTileLayer, createRouteLayer, getRouteLayer, setRouteLayer } from "./layers.js";
import { calculatePath } from "./routing/routing.js";
import { roundCoords } from "./utils.js";
import { routingStateObject } from "./routing/routingValues.js";

const map_style = document.getElementById("map")

export let map = null;

const searchEntry = document.getElementById("search-entry");
const searchForAreaButton = document.getElementById("search-for-area-button");

// saving a route
const selectedRouteName = document.getElementById("selected-route-name");
const selectedRouteType = document.getElementById("selected-route-type");
const selectedRouteDisplay = document.getElementById("selected-route-display");
const routeNameInput = document.getElementById("route_name");

// loading
const loadMessage = document.getElementById("load_message");
const loadRouteButton = document.getElementById("load-route-button");
const routeList = document.getElementById("route-list");
const loadRouteDropdown = document.getElementById("load-route-dropdown");

// saving and loading divs (the containers)
const saveRouteDiv = document.getElementById("save_route");
const loadRouteDiv = document.getElementById("load_route");

// routes and points
let savedPointsLayer = null;




// manual routing
const clearManualRouteButton = document.getElementById("clear_manual_route")

// logging in and out
const logoutButton = document.getElementById("logout_button");
const loginButton = document.getElementById("login_button");
const loginScreen = document.getElementById("login-screen");


// saved routes dash
const savedRoutesDashboard = document.getElementById("saved_route_dasboard");
const allRoutesContainer = document.getElementById("all-routes-container");
const loadButtons = document.querySelectorAll(".route-btn-load");
const downloadGPXButtons = document.querySelectorAll(".route-btn-download-gpx");
const downloadGeoJSONButtons = document.querySelectorAll(".route-btn-download-geojson");
const deleteButtons = document.querySelectorAll(".route-btn-delete");


const settingsModal = document.getElementById("settings_modal");
const settingsButton = document.getElementById("settings_button");
const settingsModalElement = document.getElementById("settings_modal");
const settingsClose = document.getElementById("settings_close");

const icons = document.querySelectorAll(".fa-eye");

const slideInNavigationBar = document.getElementById("the-sidenav");

const errorPopUp = document.getElementById('user-error-popup-container');
const errorPopUpText = document.getElementById('user-error-popup-text');

// DELETING A POINT
const pointDeleteDeleteButton = document.getElementById("point-delete-delete-button");
const pointDeleteExitButton = document.getElementById("point-delete-exit-button");
const deletePointConfirmationDialog = document.getElementById("delete-point-confirmation-dialog");
const pointDeleteModalNameDisplay = document.getElementById("point-name-display");
const wrapper = document.querySelector(".wrapper")

// ================
// INITIALISING FUNCTIONS
// ================

function initSettings() {
  
}

export function initMap() {
  createTileLayer();
  createMap();
  createRouteLayer();

}

function initSaveOrLoad() {
  loadRouteButton.addEventListener("click", loadRoute);
  saveRouteForm.addEventListener("submit", saveRoute);
}

function initRouting() {
  clearManualRouteButton.addEventListener("click", clearManualRoute);
}

// AUTH INITIALISATION


// main function for initialising auth

function initAuth() {
    if (document.getElementById('login-screen')) {
      initLogin();
    }

    if (document.getElementById('register_screen')) {
      initRegister();
    }

    if (document.getElementById('map_content')) {
      initLogout();
    }
 }
 
// functions used in auth init

function initLogout() {
  logoutButton.addEventListener("click", logout);
}

function initRegister() {
  registerButton.addEventListener("click", register);
  registerGoBackButton.addEventListener("click", goBackToLoginFromRegister)
}


function initLogin() {
  loginButton.addEventListener("click", login);
  switchToRegisterButton.addEventListener("click", switchToRegistering);
}

function initApp() {

  initMap();
  initAuth();
  initRouting();
  initSaveOrLoad();
}

// call the function when all DOM elements have loaded
document.addEventListener('DOMContentLoaded', initApp);


// ================
// SETTINGS & MAP INITIALISATION
// ================

// map getter

export function getMap() {
  return map;
}

function loadSettings() {
  const settings = {
    distanceUnit: localStorage.getItem("distanceUnit") || "km", // default km
  };
  return settings;
}

let appSettings = loadSettings();


function createMap() {
   map = new ol.Map({
    layers: [tileLayer],
    target: "map",
    controls: new ol.control.defaults.defaults({
      attribution : false
    }).extend([
      new ol.control.Attribution({
        collapsible : false
      })
    ]),
    view: new ol.View({
      projection: "EPSG:3857",
      maxZoom: 17,
      minZoom: 0,
      center: mapInitialCenter,
      zoom: mapInitialZoom,
    }),
  });
}

export function onMapClick(handler) {
  map.on('click', handler)
}

export function onMapRenderComplete(handler) {
  handler
}


// ================
// CLICK INTERACTION & SAVED POINTS
// ================

let savedPointsLookup = { ...initialSavedPointsLookup };

function saveNewPoint(coordinate, name) {
  const x = coordinate[0];
  const y = coordinate[1];

  fetch(apiSavePointUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      point_name: name,
      web_mercator_x: x,
      web_mercator_y: y,
    }),
  })
    .then((response) => {
      if (!response.ok) {
        return response.json().then((errorData) => {
          throw new Error(
            errorData.message ||
              `Server responded with status ${response.status}`,
          );
        });
      }
      return response.json();
    })
    .then((data) => {
      if (data.success) {
        alert(`Saved ${data.message}`);
        loadAndDisplaySavedPoints();
      } else {
        alert(`Error saving point: ${data.message}`);
      }
    })
    .catch((error) => {
      alert(`Could not save point: ${error.message}`);
      console.error("Fetch Error:", error);
    });
}

// ================
// ROUTE LIST & SAVE/LOAD
// ================

function refreshRouteListUI(routes) {

  routeList.innerHTML = "";
  selectedRouteDisplay.textContent = "Choose a route";
  selectedRouteName.value = "";
  selectedRouteType.value = "";
  loadMessage.innerHTML = "";

  if (routes.length === 0) {
    routeList.innerHTML =
      '<div class="load-route-item disabled">No saved routes available</div>';
    return;
  }

  routes.forEach((route) => {
    const routeItem = document.createElement("div");
    routeItem.className = "load-route-item";
    routeItem.setAttribute("data-name", route.name);
    routeItem.setAttribute("data-type", route.type);
    routeItem.innerHTML = `
      <span class="load-route-name">${route.name} (${route.type.toUpperCase()})</span>
      <span class="load-route-delete" title="Delete Route" data-name="${route.name}" data-type="${route.type}">X</span>
    `;

    routeItem.querySelector(".load-route-name").addEventListener("click", function (e) {
        e.stopPropagation();
        document.querySelectorAll(".load-route-item").forEach((item) => item.classList.remove("selected"));
        routeItem.classList.add("selected");

        selectedRouteName.value = route.name;
        selectedRouteType.value = route.type;
        selectedRouteDisplay.textContent = `${route.name} (${route.type.toUpperCase()})`;
      }
    );

    routeItem.querySelector(".load-route-delete").addEventListener("click", function (e) {
        e.stopPropagation();
        handleRouteDeletion(route.name, route.type);
      }
    );

    routeList.appendChild(routeItem);
  });
}

export function refreshRouteList() {
  fetch(apiGetRoutesUrl)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      refreshRouteListUI(data.routes);
    })
    .catch((error) => {
      console.error("Error fetching route list:", error);
      document.getElementById("load_message").innerHTML = `<span style="color: red;"> Error fetching routes: ${error.message}</span>`;
    });
}

function handleRouteDeletion(routeName, fileType) {
  if (
    !confirm(
      `Are you sure you want to delete the route: ${routeName} (${fileType.toUpperCase()})?`,
    )
  ) {
    return;
  }

  const messageDiv = document.getElementById("load_message");
  messageDiv.innerHTML = '<span style="color: blue;">Deleting route...</span>';

  fetch(apiDeleteRouteUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      route_name: routeName,
      file_type: fileType,
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        messageDiv.innerHTML = `<span style="color: green;">✓ ${data.message}</span>`;
        refreshRouteList();
      } else {
        messageDiv.innerHTML = `<span style="color: red;">✗ ${data.message}</span>`;
      }
    })
    .catch((error) => {
      messageDiv.innerHTML = `<span style="color: red;">✗ Error deleting route: ${error.message}</span>`;
      console.error("Error deleting route:", error);
    });
}

function clearRoute() {
  if (routeLayer) {
    routeLayer.clear();
  }
  if (displayedPath) {
    displayedPath.clear();
  }
  routingStateObject.currentPathData = null;
}

// SAVING A ROUTE
const saveRouteForm = document.getElementById("saveRouteForm");

function saveRoute(e) {
  e.preventDefault();

  const routeName = document.getElementById("route_name").value;
  const format = document.getElementById("format").value;
  const messageDiv = document.getElementById("save_message");
  const distance = document.getElementById("route_distance_display").textContent;
  const ETA = document.getElementById("route_eta_display").textContent;
  console.log(ETA)
  const elevation_change = document.getElementById("route_elevation_change_display").textContent;
  console.log(elevation_change)

  messageDiv.innerHTML =
    '<span style="color: blue;">Saving route...</span>';

  let pathCoordinates = [];
  if (currentMode === "manual" && manualRoutePoints.length > 0) {
    pathCoordinates = manualRoutePoints;
  } else {
    pathCoordinates = routingStateObject.currentPathData || loadedRouteCoordinates || [];
  }

  if (pathCoordinates.length === 0) {
    messageDiv.innerHTML =
      '<span style="color: red;">No route data to save. Please create or load a route first.</span>';
    return;
  }

  console.log("Saving route:", {
    route_name: routeName,
    format: format,
    coordinates_count: pathCoordinates.length,
  });

  fetch(apiSaveRouteUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      route_name: routeName,
      format: format,
      coordinates: pathCoordinates,
      route_distance: distance,
      route_ETA: ETA,
      elevation_change: elevation_change
    }),
  })
    .then((response) => {
      if (!response.ok) {
        return response.json().then((errorData) => {
          throw new Error(
            errorData.message ||
              `Server responded with status ${response.status}`,
          );
        });
      }
      return response.json();
    })
    .then((data) => {
      if (data.success) {
        messageDiv.innerHTML = `<span style="color: green;">✓ ${data.message}</span>`;
        document.getElementById("route_name").value = "";
        refreshRouteList();
      } else {
        messageDiv.innerHTML = `<span style="color: red;">✗ ${data.message}</span>`;
      }
    })
    .catch((error) => {
      messageDiv.innerHTML = `<span style="color: red;">✗ Error saving route: ${error.message}</span>`;
      console.error("Error saving route:", error);
    });
}

// LOADING A ROUTE

function loadRoute(e) {
  e.preventDefault();

  const routeName = document.getElementById("selected-route-name").value;
  const fileType = document.getElementById("selected-route-type").value;
  const messageDiv = document.getElementById("load_message");

  if (!routeName) {
    messageDiv.innerHTML =
      '<span style="color: red;">Please select a route to load</span>';
    return;
  }

  messageDiv.innerHTML =
    '<span style="color: blue;">Loading route...</span>';

  fetch(apiLoadRouteUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      route_name: routeName,
      file_type: fileType,
    }),
  })
  .then((response) => response.json())
  .then((data) => {
    if (data.success) {
      const vectorSource = routeLayer.getSource();
      vectorSource.clear();

      const format = new ol.format.GeoJSON();
      const features = format.readFeatures(data.path_geojson, {
        dataProjection: "EPSG:3857",
        featureProjection: "EPSG:3857",
      });

      features.forEach((feature) => {
        feature.setStyle(
          new ol.style.Style({
            stroke: new ol.style.Stroke({
              color: "#2563eb",
              width: 5,
            }),
          }),
        );
      });

      vectorSource.addFeatures(features);

      const view = map.getView();
      view.fit(vectorSource.getExtent(), {
        size: map.getSize(),
        padding: [50, 50, 50, 50],
        duration: 1000,
      });

      if (data.route_stats) {
        const statsHtml = `
          <div id="route-stats">
            <div class="stats-header">
              <span class="stats-title">Route Information</span>
            </div>
            <div class="stats-content">
              <div class="stat-row">
                <span class="stat-label">Distance:</span>
                <span class="stat-value">${formatDistance(parseFloat(data.route_stats.total_distance))}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">ETA:</span>
                <span class="stat-value">${data.route_stats.eta}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">Elevation Change:</span>
                <span class="stat-value" id="route_elevation_change_display">${data.route_stats.elevation_change || "N/A"}</span>
              </div>
            </div>
          </div>
        `;
        const existingStats = document.getElementById("route-stats");
        if (existingStats) existingStats.remove();
        document.body.insertAdjacentHTML("beforeend", statsHtml);
      }

      loadedRouteCoordinates = data.coordinates;
      routingStateObject.currentPathData = data.coordinates;

      const saveRouteDiv = document.getElementById("save_route");
      if (saveRouteDiv) saveRouteDiv.style.display = "block";

      updateLoadRouteVisibility();

      showToast(data.message, "success");
    } else {
      showToast(`Failed to load route: ${data.message}`, "error");
    }
  })
  .catch((error) => {
    console.error("Error loading route:", error);
    showToast(
      "A network error occurred while loading the route.",
      "error",
    );
  });
}

// ================
// MODE TOGGLE & MANUAL ROUTING
// ================

async function getPathSegment(start, end) {
  try {
    const response = await fetch("/calculate_path", {
      "method" : "POST",
      "headers" : { "Content-Type" : "application/json "},
      "body" : JSON.stringify({ start_point : `${start[0]}, ${start[1]}`, end_point : `${end[0]}, ${end[1]}`})
    });
    return await response.json();
  }
  catch (error) {
    console.log("Pathfinding error:", error);
    return {"success" : false};
  }
}

// ================
// CALCULATIONS
// ================

function calculateDistance(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function calculateTotalDistance(points) {
  let totalDistance = 0;
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i - 1];
    const [x2, y2] = points[i];
    totalDistance += calculateDistance(x1, y1, x2, y2);
  }
  return totalDistance;
}

function calculateETA(distanceKm) {
  const averageHikingSpeed = 4.0;
  const etaHours = distanceKm / averageHikingSpeed;
  const etaMinutes = Math.floor(etaHours * 60);
  const etaHoursInt = Math.floor(etaHours);
  const etaMinutesRemainder = etaMinutes % 60;

  if (etaHoursInt > 0) {
    return `${etaHoursInt}h ${etaMinutesRemainder}m`;
  } else {
    return `${etaMinutesRemainder}m`;
  }
}

// ================
// MANUAL ROUTE LAYER RENDERING
// ================

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

// ================
// DELETE POINT MODAL & DROPDOWN SETUP
// ================

const showPointDeleteDialog = (show) => {
  const dialog = document.getElementById("delete-point-confirmation-dialog");
  if (!dialog) return;
  show ? dialog.showModal() : dialog.close();
};

deletePointConfirmationDialog.addEventListener("click", (e) => !wrapper.contains(e.target) && deletePointConfirmationDialog.close())

deletePointConfirmationDialog.addEventListener("close", () => {
  if (selectedPoint) {
    // set to normal unselected saved point
    selectedPoint.setStyle(getSavedPointStyle(selectedPoint.get("name")));
    // clear the reference for the next point to be clicked
    selectedPoint = null;
  }
})  

document.addEventListener("DOMContentLoaded", function () {
  
  const dialogEl = document.getElementById("delete-point-confirmation-dialog");
  const dialogWrapper = dialogEl.querySelector(".wrapper");

  dialogEl.addEventListener("click", (e) => {
    if (!dialogWrapper.contains(e.target)) {
      showPointDeleteDialog(false);
    }
  });

  pointDeleteDeleteButton.addEventListener("click", function () {
      if (!selectedPoint) {
        alert("Error: No point is currently selected for deletion.");
        showPointDeleteDialog(false);
        return;
      }

      const pointName = selectedPoint.get("name");

      fetch(apiDeletePointUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          point_name: pointName,
        }),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            showPointDeleteDialog(false);
            selectedPoint = null;
            if (typeof loadAndDisplaySavedPoints === "function") {
              loadAndDisplaySavedPoints();
            }
          } else {
            alert(`Error deleting point: ${data.message}`);
            showPointDeleteDialog(false);
          }
        })
        .catch((error) => {
          alert(
            `Network Error: Could not delete point: ${error.message}`,
          );
          showPointDeleteDialog(false);
        });
    });

  pointDeleteExitButton.addEventListener("click", () => showPointDeleteDialog(false));

  if (selectedRouteDisplay) {
    selectedRouteDisplay.addEventListener("click", function (e) {
      e.stopPropagation();
      routeList.classList.toggle("open");
    });
  }

  document.addEventListener("click", function (e) {
    if (routeList && !loadRouteDropdown.contains(e.target)) {
      routeList.classList.remove("open");
    }
  });
});

function clearAutoRoute() {
  loadedRouteCoordinates = null;
  routingStateObject.currentPathData = null;

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

  map
    .getLayers()
    .getArray()
    .slice()
    .forEach((layer) => {
      if (layer instanceof ol.layer.Vector && layer !== savedPointsLayer) {
        if (layer.getSource()) {
          layer.getSource().clear();
        }
      }
    });

  const existingStats = document.getElementById("route-stats");
  if (existingStats) existingStats.remove();

  startPointEntry.value = "";
  endPointEntry.value = "";
  selectedRouteName.value = "";
  selectedRouteType.value = "";
  selectedRouteDisplay.textContent = "Choose a route";

  
  if (routeNameInput) routeNameInput.value = "";
  if (saveRouteDiv) saveRouteDiv.style.display = "none";
  if (loadRouteDiv) loadRouteDiv.style.display = "block";

  updateLoadRouteVisibility();
}

const clearRouteButton = document.getElementById("clear_route_button");
clearRouteButton.addEventListener("click", clearAutoRoute);
