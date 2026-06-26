import { getAppSettings } from "./settingsState.js";

/**
 * 
 * @param {DOMElement} element 
 * @param {function} func 
 * @param {Event} type 
 */
export function addClickListener(element, func, type) {
  if (element) element.addEventListener(type, func);
}

// function to round coordinates to a given decimal point
export function roundCoords (coordArray, decimals) {

    const [x, y] = coordArray;

    if (decimals === 0) {
        return [Math.round(x), Math.round(y)]
    }

    const multiplier = 10 ** decimals;

    const roundedX = Math.round(x * multiplier) / multiplier;
    const roundedY = Math.round(y * multiplier) / multiplier;


    return [roundedX, roundedY];
}

// function to set the styling for points that are added in manual routing mode
export function createManualPointStyle(label, colour, radius=7.5) {
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

export function getRouteStrokeStyle() {
  return {
    color: "#2563eb",
    width: 8,
    lineCap: "round",
    lineJoin: "round",
  }
}

// formating distance between different units
export function formatDistance(distanceKm) {
  const appSettings = getAppSettings(); // retrieves copy of app setting object from settingsState.js 
  const distanceUnit = appSettings?.distanceUnit;

  if (distanceUnit === "miles") {
    const distanceMiles = distanceKm * 0.621371; 
    return `${distanceMiles.toFixed(2)}mi`;
  }
  return `${distanceKm.toFixed(2)}km`;
}

export function calculateTotalDistance(points) {
  let totalDistance = 0;
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i - 1];
    const [x2, y2] = points[i];
    totalDistance += Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  }
  return totalDistance;
}

export function calculateEta(distanceKm) {
  const averageHikingSpeed = 4.0;
  const etaHours = distanceKm / averageHikingSpeed;
  const etaMinutes = Math.floor(etaHours * 60);
  const etaHoursInt = Math.floor(etaHours);
  const etaMinutesRemainder = etaMinutes % 60;

  if (etaHoursInt > 0) {
    return `${etaHoursInt}h ${etaMinutesRemainder}m`;
  }
  return `${etaMinutesRemainder}m`;
}

export function showError(message) {
    const container = document.getElementById("error-toast-container");

    const toast = document.createElement("div");
    toast.className = "error-toast";
    toast.textContent = message;

    container.appendChild(toast);

    // this triggers the slide in animation of the error popup
    requestAnimationFrame(() => {
        toast.classList.add("show");
    });

    // this makes the popup hide after 3s
    setTimeout(() => {
        toast.classList.add("hide");

        // this removes it from the DOM once time is up
        setTimeout(() => {
            toast.remove();
        }, 250);
    }, 3000);
}

export function moveMapToPosition(map, position = [-357428, 7256794], duration = 1200, zoom = 10.5) {
  if (!map) {
    console.warn("No map, returning");
    return;
  }
  map.getView().animate({
    center: position,
    zoom: zoom,
    duration: duration
  })
};