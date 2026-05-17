import {
  getCurrentMode,
  getCurrentPathData,
  getLoadedRouteCoordinates,
  manualRouteState,
} from "./routeState.js";
import { refreshRouteList } from "./loadRoute.js";

let saveRouteForm = null;

export function initSaveRoute() {
  saveRouteForm = document.getElementById("save-route-form");
  if (saveRouteForm) {
    saveRouteForm.addEventListener("submit", handleSaveRoute);
  }
}

function handleSaveRoute(e) {
  e.preventDefault();

  const routeName = document.getElementById("route-name")?.value;
  const format = document.getElementById("route-format")?.value;
  const messageDiv = document.getElementById("save-message");
  const distance = document.getElementById("route-distance-display")?.textContent;
  const eta = document.getElementById("route-eta-display")?.textContent;
  const elevationChange = document.getElementById(
    "route-elevation-change-display",
  )?.textContent;

  if (!messageDiv) return;

  messageDiv.innerHTML = '<span style="color: blue;">Saving route...</span>';

  let pathCoordinates = [];
  const mode = getCurrentMode();
  if (mode === "manual" && manualRouteState.pathCoords.length > 0) {
    pathCoordinates = manualRouteState.pathCoords;
  } else {
    pathCoordinates =
      getCurrentPathData() || getLoadedRouteCoordinates() || [];
  }

  if (pathCoordinates.length === 0) {
    messageDiv.innerHTML =
      '<span style="color: red;">No route data to save. Please create or load a route first.</span>';
    return;
  }

  const url = window.appConfig.apiSaveRouteUrl;

  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      route_name: routeName,
      format,
      coordinates: pathCoordinates,
      route_distance: distance,
      route_ETA: eta,
      elevation_change: elevationChange,
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
        const routeNameInput = document.getElementById("route-name");
        if (routeNameInput) routeNameInput.value = "";
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
