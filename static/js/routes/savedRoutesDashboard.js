/**
 * Saved-routes dashboard page UI ( /saved_routes ).
 * Event listeners are wired; implement the TODO handlers to call routeApi.js.
 */

import { deleteRoute, downloadRoute, loadRoute } from "./routeApi.js";

import { closeNav, closeSavedRoutesDash,  } from "../ui.js"

import { displayLoadedRouteOnMap } from "./loadRoute.js";

import { setLoadedRouteCoordinates, setCurrentPathData } from "./routeState.js";

import { createElevationProfile, initChartToggleListener } from "../elevationChart.js";

import {
  addClickListener,
  createNoRouteCard,
  showError
} from "../utils/ui-utils.js"

import { formatDistance } from "../utils/format-utils.js";
import { logError } from "../utils/logError-utils.js";

const allRoutesContainer = document.getElementById("all-routes-container");

/**
 * Function responsible for updating the distance values of saved route cards
 */
export function updateSavedRouteCards() {
  const statValues = document.querySelectorAll('[data-distance-km]');
  statValues.forEach(value => {
    const rawKm = parseFloat(value.dataset.distanceKm);
    if (isNaN(rawKm)) return;
    const formattedValue = formatDistance(rawKm);
    value.textContent = formattedValue;
  });
};

/**
 * reads the route name and format from the closest route card
 * @param {Element} routeCardElement
 * @returns {{ routeName: string } | null}
 */
export function getRouteFromCard(routeCardElement) {
  if (!routeCardElement) return null;

  const routeName = routeCardElement.dataset.routeName;
  if (!routeName) return null;

  return { routeName };
}

/**
 * handler for controlling the sequence of events that occur following the clicking of the load route button 
 * @param {MouseEvent} event
 */
async function onLoadClick(event) {
  const routeCard = event.target.closest('.route-card');
  const route = getRouteFromCard(routeCard);
  if (!route) return;

  try {
    await closeSavedRoutesDash();
    await closeNav();
    const data = await loadRoute(route.routeName);
    await displayLoadedRouteOnMap(data);
    await initChartToggleListener();
    await createElevationProfile(data.coordinates)

    // both set calls could set coords whereby each coord is formed of 3 elements i.e (x, y and elevation)
    await setLoadedRouteCoordinates(data.coordinates);
    await setCurrentPathData(data.coordinates);
  } catch (error) {
    showE
  }

  event.preventDefault();
}

/**
 * handler for controlling the sequence of events that occur following the clicking of the delete route button 
 * @param {MouseEvent} event
 */
async function onDeleteClick(event) {
  const routeCard = event.target.closest(".route-card")
  const route = getRouteFromCard(routeCard);
  if (!route) return;

  const check = confirm(`Are you sure you want to delete the route: ${route.routeName}?`);
  if (!check) {
    return;
  }

  try {
    const response = await deleteRoute(route.routeName);
    if (response.success) {
      routeCard.remove();

      const remainingCards = document.querySelectorAll('.route-card');

      if (remainingCards.length === 0) {
        allRoutesContainer.insertAdjacentHTML('beforeend', createNoRouteCard());
      }

    }
  } catch (error) {

    showError("Sorry, there was an unexpected error, try again later. ")
  }

  event.preventDefault();
}

/**
 * handler for controlling the sequence of events that occur following the clicking of the download route button 
 * @param {MouseEvent} event
 * @param {"gpx" | "geojson"} format
 * @param {HTMLButtonElement} DOMElement
 */
async function onDownloadClick(event, format, DOMElement) {

  DOMElement.classList.add('loading')
  DOMElement.disabled = true;

  event.preventDefault();

  const routeCard = event.target.closest(".route-card")
  const route = getRouteFromCard(routeCard);
  if (!route) {
    DOMElement.disabled = false;
    DOMElement.classList.remove('loading');
    return;
  }
  
  try {

    const response = await downloadRoute(route.routeName, format, DOMElement); 
    
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

    // good practice to remove the link + download url
    document.body.removeChild(a); 
    URL.revokeObjectURL(url);

  } 
  catch(error) {
  
    logError("Downloading Route", error.message, null, "DOWNLOAD_ROUTE")

    showError("Sorry, there was an unexpected error, try again later. ")
  }
  finally {
    DOMElement.disabled = false;
    DOMElement.classList.remove('loading')
  }
}

/** 
  * handles adding the event listeners for each button on the route card
*/
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
      onDownloadClick(e, "gpx", gpxButton)
    }
    else if (geojsonButton) {
      onDownloadClick(e, "geojson", geojsonButton)
    }
  })
}

/**
 * responsible for adding event listener to the go back button
 */
function bindNavigation() {
  const goBackButton = document.getElementById("go-back-button");
  if (goBackButton) {
    goBackButton.addEventListener("click", () => {
      window.location.href = "/map";
    });
  }
}
/**
 * function responsbile for initialising the event listeners by calling both functions associated with adding event listeners 
 */
export function initSavedRoutesDashboard() {
  bindNavigation();
  bindRouteCardButtons();
}

addClickListener(document, initSavedRoutesDashboard, "DOMContentLoaded")
