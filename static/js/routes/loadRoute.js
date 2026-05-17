import { getMap, getRouteLayer, getPathColour } from "../map.js";
import { formatDistance, showToast } from "../utils.js";
import {
  setCurrentPathData,
  setLoadedRouteCoordinates,
} from "./routeState.js";

let routeList = null;
let selectedRouteDisplay = null;
let selectedRouteName = null;
let selectedRouteType = null;
let loadMessage = null;
let loadRouteButton = null;
let loadRouteDropdown = null;

let onRouteLoaded = null;
let updateLoadRouteVisibilityCallback = null;

export function initLoadRoute(callbacks = {}) {
  onRouteLoaded = callbacks.onRouteLoaded ?? null;
  updateLoadRouteVisibilityCallback =
    callbacks.updateLoadRouteVisibility ?? null;

  routeList = document.getElementById("route-list");
  selectedRouteDisplay = document.getElementById("selected-route-display");
  selectedRouteName = document.getElementById("selected-route-name");
  selectedRouteType = document.getElementById("selected-route-type");
  loadMessage = document.getElementById("load-message");
  loadRouteButton = document.getElementById("load-route-button");
  loadRouteDropdown = document.getElementById("load-route-dropdown");

  if (loadRouteButton) {
    loadRouteButton.addEventListener("click", handleLoadRoute);
  }

  if (selectedRouteDisplay) {
    selectedRouteDisplay.addEventListener("click", (e) => {
      e.stopPropagation();
      routeList?.classList.toggle("open");
    });
  }

  document.addEventListener("click", (e) => {
    if (routeList && loadRouteDropdown && !loadRouteDropdown.contains(e.target)) {
      routeList.classList.remove("open");
    }
  });
}

function refreshRouteListUI(routes) {
  if (!routeList) return;

  routeList.innerHTML = "";
  if (selectedRouteDisplay) selectedRouteDisplay.textContent = "Choose a route";
  if (selectedRouteName) selectedRouteName.value = "";
  if (selectedRouteType) selectedRouteType.value = "";
  if (loadMessage) loadMessage.innerHTML = "";

  if (routes.length === 0) {
    const empty = document.createElement("div");
    empty.className = "load-route-item disabled";
    empty.textContent = "No saved routes available";
    routeList.appendChild(empty);
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

    routeItem.querySelector(".load-route-name").addEventListener("click", (e) => {
      e.stopPropagation();
      document
        .querySelectorAll(".load-route-item")
        .forEach((item) => item.classList.remove("selected"));
      routeItem.classList.add("selected");

      if (selectedRouteName) selectedRouteName.value = route.name;
      if (selectedRouteType) selectedRouteType.value = route.type;
      if (selectedRouteDisplay) {
        selectedRouteDisplay.textContent = `${route.name} (${route.type.toUpperCase()})`;
      }
    });

    routeItem.querySelector(".load-route-delete").addEventListener("click", (e) => {
      e.stopPropagation();
      handleRouteDeletion(route.name, route.type);
    });

    routeList.appendChild(routeItem);
  });
}

export function refreshRouteList() {
  fetch(window.appConfig.apiGetRoutesUrl)
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
      const messageEl = document.getElementById("load-message");
      if (messageEl) {
        messageEl.innerHTML = `<span style="color: red;"> Error fetching routes: ${error.message}</span>`;
      }
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

  const messageDiv = document.getElementById("load-message");
  if (messageDiv) {
    messageDiv.innerHTML = '<span style="color: blue;">Deleting route...</span>';
  }

  fetch(window.appConfig.apiDeleteRouteUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      route_name: routeName,
      file_type: fileType,
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (!messageDiv) return;
      if (data.success) {
        messageDiv.innerHTML = `<span style="color: green;">✓ ${data.message}</span>`;
        refreshRouteList();
      } else {
        messageDiv.innerHTML = `<span style="color: red;">✗ ${data.message}</span>`;
      }
    })
    .catch((error) => {
      if (messageDiv) {
        messageDiv.innerHTML = `<span style="color: red;">✗ Error deleting route: ${error.message}</span>`;
      }
      console.error("Error deleting route:", error);
    });
}

function handleLoadRoute(e) {
  e.preventDefault();

  const routeName = selectedRouteName?.value;
  const fileType = selectedRouteType?.value;

  if (!loadMessage) return;

  if (!routeName) {
    loadMessage.innerHTML =
      '<span style="color: red;">Please select a route to load</span>';
    return;
  }

  loadMessage.innerHTML = '<span style="color: blue;">Loading route...</span>';

  fetch(window.appConfig.apiLoadRouteUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      route_name: routeName,
      file_type: fileType,
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        displayLoadedRouteOnMap(data);
        setLoadedRouteCoordinates(data.coordinates);
        setCurrentPathData(data.coordinates);

        const saveRouteDiv = document.getElementById("save-route");
        if (saveRouteDiv) saveRouteDiv.style.display = "block";

        updateLoadRouteVisibilityCallback?.();
        onRouteLoaded?.(data);
        showToast(data.message, "success");
      } else {
        showToast(`Failed to load route: ${data.message}`, "error");
      }
    })
    .catch((error) => {
      console.error("Error loading route:", error);
      showToast("A network error occurred while loading the route.", "error");
    });
}

function displayLoadedRouteOnMap(data) {
  const map = getMap();
  const routeLayer = getRouteLayer();
  if (!map || !routeLayer) return;

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
          color: getPathColour(),
          width: 5,
        }),
      }),
    );
  });

  vectorSource.addFeatures(features);

  map.getView().fit(vectorSource.getExtent(), {
    size: map.getSize(),
    padding: [50, 50, 50, 50],
    duration: 1000,
  });

  if (!data.route_stats) return;

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
          <span class="stat-value" id="route-elevation-change-display">${data.route_stats.elevation_change || "N/A"}</span>
        </div>
      </div>
    </div>
  `;

  const existingStats = document.getElementById("route-stats");
  if (existingStats) existingStats.remove();
  document.body.insertAdjacentHTML("beforeend", statsHtml);
}
