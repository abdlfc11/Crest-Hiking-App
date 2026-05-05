// All map/application logic. Uses values from map_jinja.js

// ================
// BASIC ELEMENT REFS & STATE
// ================

import { logout, login, switchToRegistering } from "./auth.js";

const map_style = document.getElementById("map")

console.log("Map initial centre:", mapInitialCenter);

let map = null;
let tileLayer = null;

const searchEntry = document.getElementById("search-entry");
const searchForAreaButton = document.getElementById("search-for-area-button");

const startPointEntry = document.getElementById("start_point_entry");
const endPointEntry = document.getElementById("end_point_entry");

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
let selectedPoint = null;
let loadedRouteCoordinates = null;
let currentPathData = null;
let displayedPath = null;
let routeLayer = null; // layer for loaded routes

// mode toggling
const autoModeButton = document.getElementById("mode_auto");
const manualModeButton = document.getElementById("mode_manual");
let currentMode = "auto"; 
const autoModeContent = document.getElementById("auto_mode_content");
const manualModeContent = document.getElementById("manual_mode_content");


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

const mapContent = document.getElementById("map_content");

const settingsModal = document.getElementById("settings_modal");
const settingsButton = document.getElementById("settings_button");
const settingsModalElement = document.getElementById("settings_modal");
const settingsClose = document.getElementById("settings_close");

const icons = document.querySelectorAll(".fa-eye");

const slideInNavigationBar = document.getElementById("the-sidenav");

const generatePathButton = document.getElementById("generate_path_button");

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

function initMap() {
  createTileLayer();
  createMap();
  AddRouteLayer();
  map.on("click", coordinateDisplayHandler);

  map.once("rendercomplete", function () {
    loadAndDisplaySavedPoints();
    refreshRouteList();
    updateLoadRouteVisibility();
  });

}

function initSaveOrLoad() {
  loadRouteButton.addEventListener("click", loadRoute);
  saveRouteForm.addEventListener("submit", saveRoute);
}

function initRouting() {
  searchForAreaButton.addEventListener("click", searchArea);
  generatePathButton.addEventListener("click", calculatePath);
  autoModeButton.addEventListener("click", switchToAutoMode);
  manualModeButton.addEventListener("click", switchToManualMode);
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

function loadSettings() {
  const settings = {
    distanceUnit: localStorage.getItem("distanceUnit") || "km", // default km
  };
  return settings;
}

let appSettings = loadSettings();

// create tile layer

function createTileLayer() {
  tileLayer = new ol.layer.Tile({
    source: new ol.source.XYZ({
      url: "https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png",
      attributions: "Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)",
      maxZoom: 17,
    }),
  });
};

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

function getPathColor() {
  return "#2563eb"; // blue
}

function AddRouteLayer() {
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
}

// slide-in navigation
function openNav() {
  slideInNavigationBar.style.width = "250px";
}

function closeNav() {
  slideInNavigationBar.style.width = "0";
}

// ================
// UI VISIBILITY & MODE TOGGLING
// ================

function crosshairVisibility() {
  const crosshair = document.getElementById("crosshair");
  const manualToggle = document.getElementById("mode_manual");
  const automaticToggle = document.getElementById("mode_auto");

  if (manualToggle.classList.contains("active")) {
    crosshair.style.display = "none";
  }
  if (automaticToggle.classList.contains("active")) {
    crosshair.style.display = "block";
  }
}

function toggleHandlers() {
  const manualToggle = document.getElementById("mode_manual");
  const automaticToggle = document.getElementById("mode_auto");

  const handleToggles = (event) => {
    manualToggle.classList.remove("active");
    automaticToggle.classList.remove("active");
    event.currentTarget.classList.add("active");
    crosshairVisibility();
  };

  automaticToggle.addEventListener("mousedown", handleToggles);
  manualToggle.addEventListener("mousedown", handleToggles);
}

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

// ================
// CLICK INTERACTION & SAVED POINTS
// ================

let savedPointsLookup = { ...initialSavedPointsLookup };

let coordinateDisplayHandler = function (event) {
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
    const webMercatorReference = `${Math.round(coordinate[0])}, ${Math.round(
      coordinate[1],
    )}`;
    const pointName = prompt(
      `Do you want to save this coordinate: ${webMercatorReference}? Enter a name to save it:`,
    );
    if (pointName) {
      saveNewPoint(coordinate, pointName);
    }
  }
};

function getSavedPointStyle(name) {
  return new ol.style.Style({
    image: new ol.style.Circle({
      radius: 7,
      fill: new ol.style.Fill({
        color: "#8903ff",
      }),
      stroke: new ol.style.Stroke({
        color: "white",
        width: 3,
      }),
    }),
    text: new ol.style.Text({
      text: name,
      font: "bold 12px sans-serif",
      fill: new ol.style.Fill({
        color: "black",
      }),
      stroke: new ol.style.Stroke({ color: '#fff', width: 3 }),
      offsetY: -15,
    }),
  });
}

function getSelectedPointStyle(name) {
  const baseStyle = getSavedPointStyle(name);
  baseStyle.getImage().setStroke(
    new ol.style.Stroke({
      color: "blue",
      width: 4,
    }),
  );
  return baseStyle;
}

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
// TOASTS
// ================

function showToast(message, type) {
  const messageDiv = document.getElementById("load_message");
  if (!messageDiv) return;

  const colors = {
    success: {
      bg: "#d4edda",
      border: "#c3e6cb",
      text: "#155724",
    },
    error: {
      bg: "#f8d7da",
      border: "#f5c6cb",
      text: "#721c24",
    },
    info: {
      bg: "#d1ecf1",
      border: "#bee5eb",
      text: "#0c5460",
    },
  };

  const color = colors[type] || colors.info;
  messageDiv.innerHTML = `<span style="background: ${color.bg}; border: 1px solid ${color.border}; color: ${color.text}; padding: 4px 8px; border-radius: 4px; display: block;">${message}</span>`;

  setTimeout(() => {
    messageDiv.innerHTML = "";
  }, 5000);
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

function refreshRouteList() {
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
  currentPathData = null;
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
    pathCoordinates = currentPathData || loadedRouteCoordinates || [];
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
      currentPathData = data.coordinates;

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

let manualRoutePoints = [];
let manualRouteLayer = null;
let manualRouteClickHandler = null;
let lastClickedPoint = null



function switchToAutoMode() {

  map_style.style.cursor = "default";
  currentMode = "auto";
  autoModeButton.classList.add("active");
  manualModeButton.classList.remove("active");

  autoModeContent.style.display = "block";
  manualModeContent.style.display = "none";

  if (manualRouteClickHandler) {
    map.un("click", manualRouteClickHandler);
    manualRouteClickHandler = null;
  }

  map.on("click", coordinateDisplayHandler);

  

  clearManualRoute();
  clearAutoRoute();

  updateLoadRouteVisibility();
}

function switchToManualMode() {
  map_style.style.cursor = "crosshair"
  currentMode = "manual";
  manualModeButton.classList.add("active");
  autoModeButton.classList.remove("active");

  autoModeContent.style.display = "none";
  manualModeContent.style.display = "block";

  map.un("click", coordinateDisplayHandler);

  manualRouteClickHandler = function (event) {
    const coordinate = event.coordinate;
    addManualPoint(coordinate[0], coordinate[1]);
  };
  map.on("click", manualRouteClickHandler);

  clearAutoRoute();

  updateLoadRouteVisibility();
}

async function addManualPoint(x, y) {

  let currentClick = [x, y];

  if (userClicks.length === 0) {
    userClicks.push(currentClick);
    pathCoords.push(currentClick);
    updateManualRoute();
    return;
  }

  const lastClickedPoint = pathCoords[pathCoords.length - 1]; // get the last coordinate in the path
  const start = userClicks[0]; // sets the first coord to the start variable

  let finalClick = currentClick; // sets the final click variable to the coords of the current click
  let end = currentClick; // sets end to the newly clicked point

  // if the user has clicked and plotted more than three points
  if (userClicks.length >= 3) {

    // sets the distance threshold (20 metres)
    const threshold_distance = 50;

    // euclidean distance AKA pythag theorem
    const distance_x = end[0] - start[0];
    const distance_y = end[1] - start[1];
    const distance = Math.sqrt((distance_x)**2 + (distance_y)**2);
    
    // if the distance is less than the threshold distance
    if (distance < threshold_distance) {
      finalClick = start;
      console.log("Snapping to start");
    }
  }

  if (!lastClickedPoint) {
    console.error("No starting point found");
    return;
  }

  const data = await getPathSegment(lastClickedPoint, finalClick); // calculate the segment between the new coord and last coord in the path

  if (data && data.success) {

    const newSegment = data.coordinates; 

    pathCoords = pathCoords.concat(newSegment.slice(1)) // stitch the segment into the path (excepting the coord of the new segment to prevent duplicates)

    userClicks.push(finalClick); // adds the final click to the path coord array

    updateManualRoute();
  }
  else {
    console.warn("Could not find a path to that location")
  }

}

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


function clearManualRoute() {
  userClicks = [];
  pathCoords = [];
  manualRoutePoints = [];
  if (manualRouteLayer) {
    map.removeLayer(manualRouteLayer);
    manualRouteLayer = null;
  }

  const existingStats = document.getElementById("route-stats");
  if (existingStats) {
    existingStats.remove();
  }

  const saveRouteDiv = document.getElementById("save_route");
  if (saveRouteDiv && currentMode === "manual") {
    saveRouteDiv.style.display = "none";
  }

  loadedRouteCoordinates = null;
  currentPathData = null;

  if (displayedPath) {
    map.removeLayer(displayedPath);
    displayedPath = null;
  }

  if (routeLayer) {
    routeLayer.getSource().clear();
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

  updateLoadRouteVisibility();
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

function formatDistance(distanceKm) {
  if (!appSettings) return `${distanceKm.toFixed(2)}km`;

  if (appSettings.distanceUnit === "miles") {
    const distanceMiles = distanceKm * 0.621371;
    return `${distanceMiles.toFixed(2)}mi`;
  }
  return `${distanceKm.toFixed(2)}km`;
}

// ================
// MANUAL ROUTE LAYER RENDERING
// ================

let userClicks = [] // stores all the clicks on the map 
let pathCoords = [] // the coordinates of the path segments formed by the A* algorithm

function createManualPointStyle(label, colour, radius=7.5) {
  return new ol.style.Style({
    image : new ol.style.Circle({
      radius : radius,
      fill : new ol.style.Fill({
        color : colour
      }),
      stroke : new ol.style.Stroke({
        color : "white",
        width : 3
      })
    }),
    text : label ? new ol.style.Text({
      text : label,
      font : "bold 12px sans-serif",
      fill : new ol.style.Fill({
        color : "black"
      }),
      stroke : new ol.style.Stroke({
        color : "white",
        width : 3
      }),
      offsetY : -15
    }) : null
  })
}

function updateManualRoute() {

  // this removes the old map layer to make a fresh path
  if (manualRouteLayer) {
    map.removeLayer(manualRouteLayer);
  }

  // if there are no clicks then hide the stats div
  if (userClicks.length === 0) {
    const existingStats = document.getElementById("route-stats");
    if (existingStats) {
      existingStats.remove();
    }


    const saveRouteDiv = document.getElementById("save_route");
    if (saveRouteDiv && currentMode === "manual") {
      saveRouteDiv.style.display = "none";
    }
    return;
  }

  if (currentMode === "manual") {
    const saveRouteDiv = document.getElementById("save_route");
    if (saveRouteDiv) {
      saveRouteDiv.style.display = "block";
    }
  }

  const totalDistanceMeters = calculateTotalDistance(pathCoords);
  const totalDistanceKm = totalDistanceMeters / 1000;
  const distanceDisplay = formatDistance(totalDistanceKm);
  const etaDisplay = calculateETA(totalDistanceKm);

  // array used to hold both Point and LineString features
  const features = [];

  // creates point features where the user clicked
  userClicks.forEach((point, index) => {
    
    // this defines the point feature (type is used to reference the type of feature later)
    const feature = new ol.Feature({
      geometry : new ol.geom.Point(point),
      type : "point"
    });

    // adds the index to the feature to be used in the ID'ing of start and end points
    feature.set("index", index);
    
    // feature then pushed into the array
    features.push(feature);
  })

  // if there is more than one point then add LineString features between them
  if (pathCoords.length > 1) {
    features.push( new ol.Feature({
      geometry : new ol.geom.LineString(pathCoords),
      type : "line"
    }));
  }

  // tolerance value to allow small coordinate differences
  const tolerance = 0.000001;
  let isEndSnappedToStart = false;
  
  // if there are enough points to make a round route
  if (userClicks.length > 3) {
    const start = userClicks[0];
    const end = userClicks[userClicks.length - 1];
    const dx = Math.abs(start[0] - end[0]);
    const dy = Math.abs(start[1] - end[1]);
    
    // if the distances are close enough
    if (dx < tolerance && dy < tolerance) {
      // the two are snapped together
      isEndSnappedToStart = true;
    }
  }

  // used for the presentation of the path on the map
  manualRouteLayer = new ol.layer.Vector({
    source : new ol.source.Vector({
      features : features
    }),
    style : function (feature) {
      // so the function knows if the feature is a point of LineString 
      const featureType = feature.get("type");
      
      // if the algorithm detects a point
      if (featureType === "point") {

        // index of the point in the pathCoords array is retrieved
        const index = feature.get("index")

        // boolean value to check if the point is the first in the pathCoords array
        const isStart = index === 0;

        // boolean value to check if the point is the last in the pathCoords array
        const isEnd = index === userClicks.length - 1;
        
        // if the end point has snapped to the start coordinate
        if (isEndSnappedToStart) {

          // if the point is the first one in the pathCoords array then change its name to Start/End
          if (isStart) {
            return createManualPointStyle("Start/End", "#8145d4");
          }

          // if the point is the last one in the pathCoords array then ommit its name so it doesn't overlap with the start point
          if (isEnd) {
            return createManualPointStyle("", "#8145d4", 0); 
          }
        }
        
        // if the points AREN'T snapped and the point is the first one in the pathCoords array
        if (isStart) {
          return createManualPointStyle("Start", "#8145d4");
        }
        
        // if the points AREN'T snapped and the point is the last one in the pathCoords array
        if (isEnd) {
          return createManualPointStyle("End", "#8145d4");
        }

        // if the points are in the middle (intermediary points)
        return createManualPointStyle("", "#000", 6.5);
      }

      // style for the lines connecting points
      return new ol.style.Style({
        stroke : new ol.style.Stroke({
          color : "#2563eb",
          width : 5
        })
      });
    }
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
    </div>
    <div class="stats-content">
      <div class="stat-row">
        <span class="stat-label">Distance:</span>
        <span class="stat-value" id="route_distance_display">${distanceDisplay}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">ETA:</span>
        <span class="stat-value" id="route_eta_display">${etaDisplay}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Elevation Change:</span>
        <span class="stat-value" id="route_elevation_change_display">N/A</span>
      </div>
    </div>
  `;
}

// ================
// SAVED POINTS UI SYNC
// ================

function rebuildSavedPointsUI(points) {
  savedPointsLookup = {};
  const startList = document.getElementById("start_points_list");
  const endList = document.getElementById("end_points_list");
  if (startList) startList.innerHTML = "";
  if (endList) endList.innerHTML = "";

  points.forEach((p) => {
    savedPointsLookup[p.name] = `${p.coordinates[0]}, ${p.coordinates[1]}`;
    if (startList)
      startList.insertAdjacentHTML(
        "beforeend",
        `<option value="${p.name}"></option>`,
      );
    if (endList)
      endList.insertAdjacentHTML(
        "beforeend",
        `<option value="${p.name}"></option>`,
      );
  });
}

const startPoint = document.getElementById("start_point");
const endPoint = document.getElementById("end_point");

function pointAutocomplete(inputPoint) {
  if (!inputPoint) return;
  inputPoint.addEventListener("input", () => {
    const name = inputPoint.value.trim();
    if (savedPointsLookup[name]) {
      inputPoint.value = savedPointsLookup[name];
    }
  });
}

pointAutocomplete(startPoint);
pointAutocomplete(endPoint);

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
// SAVED POINTS LOADING
// ================

function loadAndDisplaySavedPoints() {
  if (savedPointsLayer) {
    map.removeLayer(savedPointsLayer);
  }

  fetch(apiGetSavedPointsUrl)
    .then((response) => response.json())
    .then((data) => {
      const features = [];
      data.points.forEach((point) => {
        const feature = new ol.Feature({
          geometry: new ol.geom.Point(point.coordinates),
          name: point.name,
        });
        features.push(feature);
      });

      rebuildSavedPointsUI(data.points);

      savedPointsLayer = new ol.layer.Vector({
        source: new ol.source.Vector({
          features: features,
        }),
        style: function (feature) {
          return getSavedPointStyle(feature.get("name"));
        },
      });

      map.addLayer(savedPointsLayer);
    })
    .catch((error) => {
      console.error("Error fetching saved point:", error);
    });
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

// ================
// AUTHENTICATION (LOGIN / LOGOUT / REGISTER)
// ================

function register() {
  const username = registerUsernameEntry.value;
  const password1 = registerPasswordEntry1.value;
  const password2 = registerPasswordEntry2.value;

  const message = validateRegisterInput(username, password1, password2);

  if (message !== true) {
    registerValidationLabel.innerText = message;
    registerValidationLabel.style.opacity = "1";
    setTimeout(() => {
      registerValidationLabel.style.opacity = "0";
    }, 3000);
    return;
  }

  fetch(apiRegisterUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: username,
      password1: password1,
      password2: password2,
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        registerUsernameEntry.value = "";
        registerPasswordEntry1.value = "";
        registerPasswordEntry2.value = "";
        registerScreen.style.display = "none";
        loginScreen.style.display = "flex";
        loginValidationLabel.innerText = data.message;
        loginValidationLabel.style.color = "#0f7a52";
        loginValidationLabel.style.opacity = "1";
        setTimeout(() => {
          loginValidationLabel.style.opacity = "0";
        }, 3000);
      } else {
        registerValidationLabel.innerText = data.message;
        registerValidationLabel.style.opacity = "1";
        setTimeout(() => {
          registerValidationLabel.style.opacity = "0";
        }, 3000);
      }
    })
    .catch((error) => {
      console.error("Error", error);
    });
}

// ================
// PASSWORD VISIBILITY ICONS
// ================

icons.forEach((icon) => {
  icon.addEventListener("click", (event) => {
    const parent = event.currentTarget.parentElement;
    const passwordInput = parent.querySelector(
      'input[type="password"], input[type="text"]',
    );

    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";

    event.currentTarget.style.color = isPassword ? "#417affff" : "lightgray";
  });
});

// ================
// ROUTE GENERATION (AUTO MODE)
// ================



function calculatePath() {

  if(endPointEntry.value === "" && startPointEntry.value === "") {
    showError(startPointEntry, "Please enter coordinates");
    showError(endPointEntry, "Please enter coordinates");
    return
  }
  if (startPointEntry.value === "") {
    showError(startPointEntry, "Please enter coordinates");
    return;
  }
  if (endPointEntry.value === "") {
    showError(endPointEntry, "Please enter coordinates");
    return;
  }

  generatePathButton.disabled = true;
  generatePathButton.classList.add("loading");

  fetch(apiCalculatePathUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      start_point: startPointEntry.value,
      end_point: endPointEntry.value,
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {

        if (displayedPath) {
          map.removeLayer(displayedPath);
          displayedPath = null;
        }
        
        displayedPath = new ol.layer.Vector({
          source: new ol.source.Vector({
            features: new ol.format.GeoJSON().readFeatures(data.pathGeoJSON),
          }),
          style: new ol.style.Style({
            stroke: new ol.style.Stroke({
              color: getPathColor(),
              width: 5,
            }),
          }),
        });
        map.addLayer(displayedPath);
        currentPathData = data.coordinates;

        generatePathButton.classList.remove("loader");

        const pathSource = displayedPath.getSource();
        const view = map.getView();

        setTimeout(() => {
          view.fit(pathSource.getExtent(), {
            padding: [50, 350, 50, 300],
            duration: 1200,
          });
        }, 100);

        const saveRouteDiv = document.getElementById("save_route");
        saveRouteDiv.style.display = "block";

        if (data.route_stats) {
          const statsHtml = `
            <div id="route-stats">
              <div class="stats-header">
                <span class="stats-title">Route Information</span>
              </div>
              <div class="stats-content">
                <div class="stat-row">
                  <span class="stat-label" >Distance:</span>
                  <span class="stat-value" id="route_distance_display">${formatDistance(parseFloat(data.route_stats.total_distance))}</span>
                </div>
                <div class="stat-row">
                  <span class="stat-label">ETA:</span>
                  <span class="stat-value" id="route_eta_display">${data.route_stats.eta}</span>
                </div>
                <div class="stat-row">
                  <span class="stat-label">Elevation Change:</span>
                  <span class="stat-value" id="route_elevation_change_display">${data.route_stats.elevation_change}</span>
                </div>
              </div>
            </div>
          `;
          const existingStats = document.getElementById("route-stats");
          if (existingStats) existingStats.remove();
          document.body.insertAdjacentHTML("beforeend", statsHtml);
        }

        updateLoadRouteVisibility();
      } else {
        homeButtonFunction();
        console.log("failure in forming a path with the error: ", data.error);
      }
    })
    .catch((error) => console.error("Error", error))
    .finally(() => {
      generatePathButton.disabled = false;
      generatePathButton.classList.remove("loading")
    })
}

// ================
// AREA SEARCH
// ================

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

// ================
// HOME & CLEAR ROUTE BUTTONS
// ================

function homeButtonFunction() {
  endPointEntry.classList.remove('input-error');
  startPointEntry.classList.remove('input-error');
  startPointEntry.placeholder = "Coordinates";
  endPointEntry.placeholder = "Coordinates";
  generatePathButton.classList.remove('loading');
  mapContent.style.display = "block";
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

  startPointEntry.value = "";
  endPointEntry.value = "";
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

const homeButtons = document.querySelectorAll('.home-button');
homeButtons.forEach(homeButton => {
  homeButton.addEventListener("click", homeButtonFunction);
  console.log("Home Button Clicked")
})

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

// ERROR POPOP LOGIC
function showError(entry, message) {
  entry.placeholder = message;
  entry.classList.add('input-error');

  entry.addEventListener("input", () => {
    entry.classList.remove('input-error')
    entry.placeholder = "Coordinates";
  }, {once : true });
}

// ================
// OTHER INIT
// ================

document.addEventListener("DOMContentLoaded", toggleHandlers);

document.getElementById("set_start_by_centre").onclick = function () {
  const centre = map.getView().getCenter();
  startPointEntry.value = `${Math.round(centre[0])}, ${Math.round(centre[1])}`;
};

document.getElementById("set_end_by_centre").onclick = function () {
  const centre = map.getView().getCenter();
  endPointEntry.value = `${Math.round(centre[0])}, ${Math.round(centre[1])}`;
};
