import { showError, addClickListener, createRouteCard, calculateEta, formatDistance, formatETA } from "./utils.js";

const allRoutesContainer = document.getElementById("all-routes-container");

export async function processImportedRouteFile(file) {

    const form = new FormData();
    form.append("route_file", file);

    const response = await fetch("/import_route_file", {
        method: 'POST',
        body: form
    });

    if (!response.ok) {
        showError(response.message || "There was an error on our end, try again later");
        throw new Error(`HTTP Error: ${response.status}`);
    }

    const data = await response.json();

    if (data.success) {
        return data;
    }
    else {
        return data.message;
    }

}

export function displayImportedRouteCard(data) {

    const routeInfo = data.route_info;
    const today = new Date();
        
    const formattedToday = new Intl.DateTimeFormat('en-GB', {
    "day": "2-digit",
    "month": "2-digit",
    "year": "2-digit"
    }).format(today);

    const formattedETA = formatETA(routeInfo.etaSeconds);

    const routeCard = createRouteCard(routeInfo.routeName, formattedToday, routeInfo.distanceKm, formattedETA, routeInfo.elevationGainMetres);

    if (allRoutesContainer) allRoutesContainer.insertAdjacentHTML("beforeend", routeCard);            
}

