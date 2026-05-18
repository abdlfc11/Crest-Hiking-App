/**
 * Saved-routes dashboard page UI ( /saved_routes ).
 * Event listeners are wired; implement the TODO handlers to call routeApi.js.
 */

import { deleteRoute, setPendingRouteForMap } from "./routeApi.js";

// import { deleteRoute, loadRoute, downloadRoute, setPendingRouteForMap } from "./routeApi.js";

let allRoutesContainer = null;

/**
 * Read route name + format from the nearest .route-card.
 * @param {Element} element
 * @returns {{ routeName: string, routeType: string } | null}
 */
export function getRouteFromCard(element) {
  const card = element.closest(".route-card");
  if (!card) return null;

  const routeName = card.dataset.routeName;
  const routeType = card.dataset.routeType;
  if (!routeName || !routeType) return null;

  return { routeName, routeType };
}

/**
 * @param {MouseEvent} event
 */
function onLoadClick(event) {
  const route = getRouteFromCard(event.currentTarget);
  if (!route) return;

  // TODO: setPendingRouteForMap(route) then window.location.href = "/map"

  setPendingRouteForMap({
    name: route.routeName,
    type: route.routeType
  });
  window.location.href = "/map";

  //   OR call loadRoute() and handle response here
  event.preventDefault();
}

/**
 * @param {MouseEvent} event
 */
async function onDeleteClick(event) {
  const route = getRouteFromCard(event.currentTarget);
  if (!route) return;

  const check = confirm(`Are you sure you want to delete the route: ${route.routeName} (${route.routeType.toUpperCase()})?`);
  if (!check) {
    return;
  }

  try {
    const response = await deleteRoute(route.routeName, route.routeType);
    if (response.success) {
      event.currentTarget.closest(".route-card")?.remove();
    }
  } catch (error) {
    console.error("Delete route failed:", error);
    alert(error.message || "Could not delete route");
  }

  event.preventDefault();
}

/**
 * @param {MouseEvent} event
 * @param {"gpx" | "geojson"} format
 */
function onDownloadClick(event, format) {
  const route = getRouteFromCard(event.currentTarget);
  if (!route) return;

  // TODO: await downloadRoute(route.routeName, format) and trigger a file download
  event.preventDefault();
}

function bindRouteCardButtons() {
  if (!allRoutesContainer) return;

  allRoutesContainer.querySelectorAll(".route-btn-load").forEach((button) => {
    button.addEventListener("click", onLoadClick);
  });

  allRoutesContainer.querySelectorAll(".route-btn-delete").forEach((button) => {
    button.addEventListener("click", onDeleteClick);
  });

  allRoutesContainer.querySelectorAll(".route-btn-download-gpx").forEach((button) => {
    button.addEventListener("click", (e) => onDownloadClick(e, "gpx"));
  });

  allRoutesContainer
    .querySelectorAll(".route-btn-download-geojson")
    .forEach((button) => {
      button.addEventListener("click", (e) => onDownloadClick(e, "geojson"));
    });
}

function bindNavigation() {
  const goBackButton = document.getElementById("go-back-button");
  if (goBackButton) {
    goBackButton.addEventListener("click", () => {
      window.location.href = "/map";
    });
  }
}

export function initSavedRoutesDashboard() {
  allRoutesContainer = document.getElementById("all-routes-container");
  bindNavigation();
  bindRouteCardButtons();
}
