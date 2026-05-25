// Shared route path / mode state for save, load, and map display. 

let currentPathData = null;
let loadedRouteCoordinates = null;
let currentMode = "auto";
let lastKnownDistanceKm = null;
let lastAutoRouteStats = null;
let lastLoadedRouteStats = null;

export const manualRouteState = {
  userClicks: [],
  pathCoords: [],
  manualRoutePoints: [],
  initialElevation: 0,
};

export function getLastAutoRouteStats() {
  return lastAutoRouteStats;
}

export function setLastAutoRouteStats(value) {
  lastAutoRouteStats = value;
}

export function clearLastAutoRouteStats() {
  lastAutoRouteStats = null;
}

export function getLastLoadedRouteStats() {
  return lastLoadedRouteStats;
}

export function setLastLoadedRouteStats(value) {
  lastLoadedRouteStats = value;
}

export function clearLastLoadedRouteStats() {
  lastLoadedRouteStats = null;
}


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

export function hasActiveRouteStatsPanel() {
  return manualRouteState.pathCoords.length > 0 || lastAutoRouteStats !== null || lastLoadedRouteStats !== null; 
};