import { showError, addClickListener, createRouteCard, calculateEta, formatDistance, formatETA, formatElevation } from "./utils.js";

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
    "year": "numeric"
    }).format(today);

    const formattedETA = formatETA(routeInfo.eta_seconds);

    const routeCard = createRouteCard(routeInfo.route_name, formattedToday, routeInfo.distance_km, formattedETA, formatElevation(routeInfo.elevation_gain_metres));

    if (allRoutesContainer) allRoutesContainer.insertAdjacentHTML("beforeend", routeCard);            
}

