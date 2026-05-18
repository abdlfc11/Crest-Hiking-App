import { getAppSettings } from "./settingsState.js";
import { addClickListener } from "./ui.js";

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

// formating distance between different units
export function formatDistance(distanceKm) {
  const appSettings = getAppSettings();
  if (!appSettings) return `${distanceKm.toFixed(2)}km`;

  if (appSettings.distanceUnit === "miles") {
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

export function showToast(message, type = "info") {
  const container = document.getElementById("user-error-popup-container");
  const textEl = document.getElementById("user-error-popup-text");
  if (!container || !textEl) {
    if (type === "error") console.error(message);
    else console.log(message);
    return;
  }
  textEl.textContent = message;
  container.classList.remove("hidden", "success", "error");
  if (type === "success") container.classList.add("success");
  if (type === "error") container.classList.add("error");
  container.style.display = "flex";
  clearTimeout(showToast._hideTimer);
  showToast._hideTimer = setTimeout(() => {
    container.style.display = "none";
  }, 4000);
}

export function moveMapToPosition(map, position = [-357428, 7256794], duration = 1200, zoom = 10) {
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