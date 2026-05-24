// Shared route path / mode state for save, load, and map display. 

let currentPathData = null;
let loadedRouteCoordinates = null;
let currentMode = "auto";
let lastKnownDistanceKm = null;

export const manualRouteState = {
  userClicks: [],
  pathCoords: [],
  manualRoutePoints: [],
};

export function getCurrentMode() {
  return currentMode;
}

export function setCurrentMode(mode) {
  currentMode = mode;
}

export function getCurrentPathData() {
  return currentPathData;
}

export function setCurrentPathData(data) {
  currentPathData = data;
}

export function getLoadedRouteCoordinates() {
  return loadedRouteCoordinates;
}

export function setLoadedRouteCoordinates(coords) {
  loadedRouteCoordinates = coords;
}

export function setLastKnownDistanceKm(value) {
  lastKnownDistanceKm = value;
}

export function getLastKnownDistanceKm () {
  return lastKnownDistanceKm;
}

export function clearPathState() {
  currentPathData = null;
  loadedRouteCoordinates = null;
}

export function clearManualRouteState() {
  manualRouteState.userClicks = [];
  manualRouteState.pathCoords = [];
  manualRouteState.manualRoutePoints = [];
}
