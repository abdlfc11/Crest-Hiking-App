/**
 * Saved-routes dashboard page UI ( /saved_routes ).
 * Event listeners are wired; implement the TODO handlers to call routeApi.js.
 */

import { deleteRoute, loadRoute } from "./routeApi.js";
import { addClickListener, closeNav, closeSavedRoutesDash,  } from "../ui.js"
import { displayLoadedRouteOnMap } from "./loadRoute.js";
import { setLoadedRouteCoordinates, setCurrentPathData } from "./routeState.js";

// import { deleteRoute, loadRoute, downloadRoute, } from "./routeApi.js";

let allRoutesContainer = null;

/**
 * Read route name + format from the nearest .route-card.
 * @param {Element} routeCardElement
 * @returns {{ routeName: string, routeType: string } | null}
 */
export function getRouteFromCard(routeCardElement) {
  if (!routeCardElement) return null;

  const routeName = routeCardElement.dataset.routeName;
  const routeType = routeCardElement.dataset.routeType;
  if (!routeName || !routeType) return null;

  return { routeName, routeType };
}

/**
 * @param {MouseEvent} event
 */
async function onLoadClick(event) {
  const routeCard = event.target.closest('.route-card');
  const route = getRouteFromCard(routeCard);
  if (!route) return;

  await closeSavedRoutesDash();
  await closeNav();
  const data = await loadRoute(route.routeName, route.routeType);
  await displayLoadedRouteOnMap(data);
  await setLoadedRouteCoordinates(data.coordinates);
  await setCurrentPathData(data.coordinates);

  //   OR call loadRoute() and handle response here
  event.preventDefault();
}

/**
 * @param {MouseEvent} event
 */
async function onDeleteClick(event) {
  const routeCard = event.target.closest(".route-card")
  const route = getRouteFromCard(routeCard);
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
  const routeCard = event.target.closest(".route-card")
  const route = getRouteFromCard(routeCard);
  if (!route) return;

  // TODO: await downloadRoute(route.routeName, format) and trigger a file download
  event.preventDefault();
}

function bindRouteCardButtons() {
  if (!allRoutesContainer) return;

  allRoutesContainer.addEventListener('click', (e) => {
    const targetButton = e.target;

    if (targetButton.classList.contains('route-btn-delete')) {
      onDeleteClick(e)
    }
    if (targetButton.classList.contains('route-btn-load')) {
      onLoadClick(e)
    }
    if (targetButton.classList.contains('route-btn-download-gpx')) {
      onDownloadClick(e, "gpx")
    }
    if (targetButton.classList.contains('route-btn-download-geojson')) {
      onDownloadClick(e, "gpx")
    }

  })
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

addClickListener(document, initSavedRoutesDashboard, "DOMContentLoaded")
