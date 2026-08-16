
import {
    showToast,
    addClickListener,
    createRouteCard
} from "./utils/ui-utils.js";

import {
    calculateEta
} from "./utils/routing-utils.js";

import {
    formatDistance,
    formatETA,
    formatElevation
} from "./utils/format-utils.js";

const allRoutesContainer = document.getElementById("all-routes-container");

export async function processImportedRouteFile(file) {

    const form = new FormData();
    form.append("route_file", file);

    const response = await fetch(window.appConfig.apiImportRouteUrl, {
        method: 'POST',
        body: form
    });

    const data = await response.json();

    if (!response.ok) {
        showToast(data.message || "There was an error on our end, try again later");
        throw new Error(`HTTP Error: ${response.status}`);
    }

    if (data.success) {
        return data;
    }
    else {
        return data.message;
    }

}

export function displayImportedRouteCard(data) {

    const routeInfo = data.route_info;
    console.log(routeInfo)
    const today = new Date();

    const routeName = routeInfo.route_name

    const formattedToday = new Intl.DateTimeFormat('en-GB', {
        "day": "2-digit",
        "month": "2-digit",
        "year": "numeric"
    }).format(today);

    const distanceKm = routeInfo.distance_km;
    const formattedDistanceKm = formatDistance(distanceKm);
    const formattedETA = formatETA(routeInfo.eta_seconds);
    const formattedElevation = routeInfo.elevation_gain_metres === 0 ? "No Data" : formatElevation(routeInfo.elevation_gain_metres)

    

    const routeCard = createRouteCard(routeName, formattedToday, distanceKm, formattedDistanceKm, formattedETA, formattedElevation);

    if (allRoutesContainer) allRoutesContainer.insertAdjacentHTML("beforeend", routeCard);            
}

