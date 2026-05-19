/**
 * Saved-routes dashboard page UI ( /saved_routes ).
 * Event listeners are wired; implement the TODO handlers to call routeApi.js.
 */

import { deleteRoute, downloadRoute, loadRoute } from "./routeApi.js";
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
     routeCard.remove();
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
async function onDownloadClick(event, format) {

  event.preventDefault();

  const routeCard = event.target.closest(".route-card")
  const route = getRouteFromCard(routeCard);
  if (!route) return;

  // TODO: await downloadRoute(route.routeName, format) and trigger a file download

  try {

    const response = await downloadRoute(route.routeName, format); 
    
    const blob = await response.blob(); // this gets binary file

    console.log(route.routeName)
    console.log(format)

    const filename = `${route.routeName}.${format}`

    const url = URL.createObjectURL(blob); // this creates a temp URL that points to the file to be dowloaded in browsers memory

    const a = document.createElement('a'); // this creates a hidden link

    a.href = url; // sets the link's pointer to the url

    a.download = filename; // sets download link to the filename

    document.body.appendChild(a); // adds the link to the html file

    a.click(); // simulates click starting the download

    document.body.removeChild(a); // good practice to remove

    URL.revokeObjectURL(url); // also good pratice to remove

  } 
  catch(error) {
    console.error("Download route failed: ", error)
  }
}

function bindRouteCardButtons() {
  if (!allRoutesContainer) return;

  allRoutesContainer.addEventListener('click', (e) => {

    const deleteButton = e.target.closest('.route-btn-delete');
    const loadButton = e.target.closest('.route-btn-load');
    const gpxButton = e.target.closest('.route-btn-download-gpx')
    const geojsonButton = e.target.closest('.route-btn-download-geojson')

    if (deleteButton) {
      onDeleteClick(e)
    }
    else if (loadButton) {
      onLoadClick(e)
    }
    else if (gpxButton) {
      onDownloadClick(e, "gpx")
    }
    else if (geojsonButton) {
      onDownloadClick(e, "geojson")
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
