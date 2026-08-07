import { manualRouteState,
  hasElevation,
  extractElevation,
  extractElevationProfile,
  getElevationRange,
  cumbriaBoundary,
  isPointInPolygon
} from "../routes/routeState.js";

import {
  showToast
} from "../utils/ui-utils.js"

import {
  updateManualRoute
} from '../ui.js'
import { logError } from "../utils/logError-utils.js";

import { fromLonLat, toLonLat } from "ol/proj.js";
import { getDistance } from "ol/sphere.js";

/**
 * Function used to calculate and return a path (and associated information) between two given points in projection EPSG: 4326 (Lon, Lat)
 * Specific to automatic routing
 * 
 * @param {String} startPoint Coordinate in the form "Lat, Lon"
 * @param {String} endPoint Coordinate in the form "Lat, Lon"
 * @returns 
 */
export async function calculatePath(startPoint, endPoint) {
  const url = window.appConfig.apiCalculatePathUrl;

  // forms an array of the first and end coordinate in the format [Lat, Lon]
  const rawStart = startPoint.split(",").map((num) => Number(num.trim()));
  const rawEnd = endPoint.split(",").map((num) => Number(num.trim()));

  // API expects [Lon, Lat] but coordinate is in [Lat, Lon]
  const startArray = [rawStart[1], rawStart[0]];
  const endArray = [rawEnd[1], rawEnd[0]];

  try {

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        start_point: startArray,
        end_point: endArray,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Sorry, there was an unexpected error when calculating your route, please try again later.")
    };

    if (data.success) {
      return data;
    };

    throw new Error(data.message || "Sorry, there was an unexpected error when calculating your route, please try again later.");
  }
  catch(error) {
    logError("Calculating Path", error.message, null, "NO_PATH_FOUND");
    throw error;
  };
};

/**
 * Calculates and returns information associated with a path between two given points (specific to manual routing)
 * 
 * @param {Number} start Coordinate in the format [Lon, Lat]
 * @param {Number} end Coordinate in the format [Lon, Lat]
 * @returns {Object} Information of and information associated with the path that is calculated
 */
export async function getPathSegment(start, end) {
  const url = window.appConfig.apiCalculatePathUrl;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      start_point: start,
      end_point: end,
    }),
  });

  if (!response.ok) {
    logError("Calculating Path", response, null, "NO_PATH_FOUND")
    throw new Error("Sorry, there was an unexpected error whilst calculating the path.");
  }

  const data = await response.json();

  if (data.success) {
    return data;
  }
  // no logging needed as the backend already logs errors if data.success if False 
  throw new Error("Sorry, there was an unexpected error whilst calculating the path.");
}

/**
 * Adds the entered point into the appropriate data structures and updates the UI
 * 
 * @param {Number} x X coordinate of clicked-on point in Web Mercator (as this is retrieved directly from a click on the map, and map's projection is Web Mercator)
 * @param {Number} y Y coordinate of clicked-on point in Web Mercator
 * @returns {Object} Object formed of success and message keys (message only if failed)
 */
export async function addManualPoint(x, y) {
  const { userClicks, pathCoords, segmentCache } = manualRouteState;
  const currentClick = [x, y];

  // The below code uses a more computationally expensive but much more accurate way of finding out if a point is in Cumbria
  const lonLatCoords = toLonLat(currentClick);
  const isInCumbria = isPointInPolygon(lonLatCoords, cumbriaBoundary);
  if (!isInCumbria) {
      return {"success": false, "message": "Please click on a point within Cumbria"};
  }

  // this restores the redo stack
  manualRouteState.redoStack = [];

  // returns prematurely after adding coord to the relevant arrays and updating manual route state if coord is the first one
  if (userClicks.length === 0) {
    userClicks.push(currentClick);
    pathCoords.push(currentClick);
    updateManualRoute();
    return {"success": true};
  }
 
  const lastClickedPoint = pathCoords[pathCoords.length - 1];
  const start = userClicks[0];
  let finalClick = currentClick;
  const end = currentClick;

  if (userClicks.length >= 3) {
    const thresholdDistance = 50;

    // lon lat used to calculate distance (Web Mercator projection has distortion risk over long distances)
    const startLonLat = toLonLat(start);
    const endLonLat = toLonLat(end);
    const distance = getDistance(startLonLat, endLonLat);

    // if points are close enough snap the final point to the first point
    if (distance < thresholdDistance) {
      finalClick = start;
    }
  }

  if (!lastClickedPoint) {
    console.error("No starting point found");
    return;
  }

  const A = userClicks[userClicks.length - 1]; 
  const B = finalClick;                        
  const key = JSON.stringify([A, B]);

  let segment;

  try {

    if (segmentCache[key]) { // this checks if the segment already exists in cache
      segment = segmentCache[key]; // if yes, it just retrieves it
    }
    // otherwise, it calculates it and adds it to the cache 
    else {
      // conversion to lon lat as the API expects coordinates in the form [Lon, Lat]
      const lastLonLat = toLonLat(lastClickedPoint);
      const finalLonLat = toLonLat(finalClick);
      const data = await getPathSegment(lastLonLat, finalLonLat);

      if (!data.success) {
        return {
          "success": false,
          "message": "Sorry, we could not find a path to that location."
        };
      };

      segment = data.coordinates;

      // conversion to Web Mercator as the API sends coords in the form: [Lon, Lat], whereas OpenLayers map is in Web Mercator projection
      segment = segment.map(coord =>
        coord.length >= 3
          ? [...fromLonLat([coord[0], coord[1]]), coord[2]]
          : fromLonLat([coord[0], coord[1]])
      );

      // this stores the segment in cache 
      segmentCache[key] = segment;

      // this updates elevation change
      manualRouteState.initialElevation += data.route_stats.elevation_change;

    }
  }
  catch (error) {
    logError("Calculating Path", error.message, null, "NO_PATH_FOUND");
    throw error;
  }

  // this appends the segment to pathCoords (skips first point to prevent duplication)
  manualRouteState.pathCoords.push(... segment.slice(1))

  userClicks.push(finalClick);
  manualRouteState.isSnapped = true;

  updateManualRoute();

  return {"success": true};
}
