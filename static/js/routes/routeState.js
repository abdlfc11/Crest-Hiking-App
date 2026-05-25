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
  isSnapped: false
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
 
// may now receive coordinates where each coord is made of 3 elements, x, y and elevation
export function getCurrentPathData() {
  return currentPathData;
}

export function setCurrentPathData(data) {
  currentPathData = data;
}

export function getLoadedRouteCoordinates() {
  return loadedRouteCoordinates;
}

// may now receive coordinates where each coord is made of 3 elements, x, y and elevation
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
  manualRouteState.initialElevation = 0;
  manualRouteState.isSnapped = false;
}

export function hasActiveRouteStatsPanel() {
  return manualRouteState.pathCoords.length > 0 || lastAutoRouteStats !== null || lastLoadedRouteStats !== null; 
};

/**
 * Function to determine whether or not each coordinate of a path contains elevation 
 * @param {Array} coords 
 * @returns boolean value
 */
export function hasElevation(coords) {
  return coords.every(coord => coord.length === 3)
}

/**
 * Function to retrieve elevation of each coordinate in the path
 * @param {Array} coords 
 * @returns The elevation for each coordinate in the set of coordinates passed in, in the form of an array
 */
export function extractElevation(coords) {
  return coords.filter(coord => coord.length === 3).map(coord => coord[2])
}

/**
 * 
 * @param {Array} coords 
 * @returns An object formed of index : elevation pairs in the form { }
 */
export function extractElevationProfile(coords) {
  return coords.filter(coord => coord.length === 3).map((coord, index) => ({
    index: index,
    elevation: coord[2]
  }));
};

/**
 * 
 * @param {Array} coords 
 * @returns The range of elevation of a path in the form { min: min_elevation, max: max_elevation }
 */
export function getElevationRange(coords) {
  return coords.reduce((range, coord) => {
    if (coord.length === 3) {
      const elevation = coord[2];

      if (range.min === null || elevation < range.min) range.min = elevation;
      if (range.max === null || elevation > range.max) range.max = elevation;
    }
    return range;
  }, { min: null, max: null})
}