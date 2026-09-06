import {
  manualRouteState,
  cumbriaBoundary,
  isPointInPolygon
} from "../routes/routeState.js";

import {
  updateManualRoute
} from '../ui/ui.js'

import { fromLonLat, toLonLat } from "ol/proj.js";
import { getDistance } from "ol/sphere.js";
import localforage from "localforage";
import { ERROR_MESSAGES } from "../utils/error-contants.js";

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
    throw new Error("ERROR : getPathSegment()", {cause : ERROR_MESSAGES.ROUTING.PATH_CREATION_FAILED});
  }

  const data = await response.json();

  if (data.success) {
    return data;
  }
  // no logging needed as the backend already logs errors if data.success if False 
  throw new Error( data.message || "ERROR : getPathSegment()", {cause : ERROR_MESSAGES.ROUTING.PATH_CREATION_FAILED});
}

function segmentKey(start, end) {
  return JSON.stringify([start, end]);
}

function coordinatesEqual(first, second) {
  return Boolean(first && second && first[0] === second[0] && first[1] === second[1]);
}

function toWebMercatorSegment(coordinates) {
  return coordinates.map(coord =>
    coord.length >= 3
      ? [...fromLonLat([coord[0], coord[1]]), coord[2]]
      : fromLonLat([coord[0], coord[1]])
  );
}

async function resolveSegment(start, end, segmentCache) {
  const key = segmentKey(start, end);
  if (segmentCache[key]) return segmentCache[key];

  const data = await getPathSegment(toLonLat(start), toLonLat(end));
  return toWebMercatorSegment(data.coordinates);
}

function rebuildPathCoords(userClicks, segmentCache) {
  if (userClicks.length === 0) return [];

  const pathCoords = [userClicks[0]];
  for (let index = 0; index < userClicks.length - 1; index += 1) {
    const segment = segmentCache[segmentKey(userClicks[index], userClicks[index + 1])];
    if (!segment) {
      throw new Error("Missing cached manual route segment", {
        cause: ERROR_MESSAGES.ROUTING.PATH_CREATION_FAILED
      });
    }
    pathCoords.push(...segment.slice(1));
  }
  return pathCoords;
}

async function persistManualSegmentCache() {
  await localforage.setItem("cachedSegmentCache", manualRouteState.segmentCache);
}

/**
 * Adds the entered point into the appropriate data structures and updates the UI
 * 
 * @param {Number} x X coordinate of clicked-on point in Web Mercator
 * @param {Number} y Y coordinate of clicked-on point in Web Mercator
 * @param {("normal"|"start"|"end")} [type="normal"] Type of point being added
 * @param {Object} 
 * @returns {Object} Holds success and (on failure) message values
 */
export async function addManualPoint(x, y, type="normal", options = {}) {
  const { userClicks, pathCoords, segmentCache } = manualRouteState;
  const currentClick = [x, y];
  const { clearRedo = true } = options;

  // this is a more computationally expensive but much more accurate way of finding out if a point is in Cumbria
  const lonLatCoords = toLonLat(currentClick);
  const isInCumbria = isPointInPolygon(lonLatCoords, cumbriaBoundary);
  if (!isInCumbria) {
    throw new Error("User clicked outside Cumbria", {cause: ERROR_MESSAGES.ROUTING.OUTSIDE_CUMBRIA});
  }

  if (clearRedo) manualRouteState.redoStack = [];

  // returns prematurely after populating manualRouteState if coord is the first one
  if (userClicks.length === 0) {
    userClicks.push(currentClick);
    pathCoords.push(currentClick);
    await persistManualSegmentCache();
    await updateManualRoute();

    return {
      "success": true
    };
  }

  const start = userClicks[0];
  const lastClickedPoint = userClicks[userClicks.length - 1];
  let finalClick = currentClick;

  if (type === "normal" && manualRouteState.isSnapped) {
    throw new Error("Closed route cannot accept another waypoint", {
      cause: "Move or replace the end point before adding another waypoint to a closed route."
    });
  }

  // handles start / end types
  if (type === "start") {
    return changeRouteStart(currentClick)
  } else if (type === "end") {
    return replaceManualRouteEnd(currentClick)
  };

  // if enough points exist, checks whether the new click closes the route (matches the start point)
  if (userClicks.length >= 2) {
    const thresholdDistance = 50;

    // lon lat used to calculate distance (Web Mercator projection has distortion risk over long distances)
    const startLonLat = toLonLat(start);
    const endLonLat = toLonLat(currentClick);
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

  const key = segmentKey(lastClickedPoint, finalClick);
  const segment = await resolveSegment(lastClickedPoint, finalClick, segmentCache);
  segmentCache[key] = segment;
  await persistManualSegmentCache();

  // this appends the segment to pathCoords (skips first point to prevent duplication)
  manualRouteState.pathCoords.push(... segment.slice(1))

  userClicks.push(finalClick);
  manualRouteState.isSnapped = finalClick === start;

  await updateManualRoute();

  return {"success": true};
}

/**
 * Replaces the final manual waypoint without retaining its stale route segment.
 *
 * @param {number[]} currentClick
 * @returns
 */
export async function replaceManualRouteEnd(currentClick) {

  try { 
    const { userClicks, segmentCache } = manualRouteState;
    
    if (userClicks.length < 2) {
      return addManualPoint(currentClick[0], currentClick[1], "normal", { clearRedo: false });
    }

    const oldEnd = userClicks[userClicks.length - 1];
    const previousPoint = userClicks[userClicks.length - 2];
    const replacementSegment = await resolveSegment(previousPoint, currentClick, segmentCache);
    const proposedClicks = [...userClicks.slice(0, -1), currentClick];
    const proposedCache = { ...segmentCache };

    delete proposedCache[segmentKey(previousPoint, oldEnd)];
    proposedCache[segmentKey(previousPoint, currentClick)] = replacementSegment;

    manualRouteState.userClicks = proposedClicks;
    manualRouteState.segmentCache = proposedCache;
    manualRouteState.pathCoords = rebuildPathCoords(proposedClicks, proposedCache);
    manualRouteState.isSnapped = coordinatesEqual(currentClick, proposedClicks[0]);
    await persistManualSegmentCache();
    await updateManualRoute();
    return {
      success: true
    };
  }
  catch (error) {
    throw new Error(`ERROR (replaceManualRouteEnd()) : ${error}`, {cause : ERROR_MESSAGES.ROUTING.GENERIC_ROUTE_ACTION})
  }
}

/**
 * Replaces an intermediary waypoint of a present route
 *
 * @param {number} index Index attribute of the intermediary point that was moved
 * @param {number[]} newCoordinates Coordinates attribute of the intermediary point that was moved
 * @returns {void}
 */
export async function replaceIntermediaryPoint(index, newCoordinates) {

  try {
    const { userClicks, segmentCache } = manualRouteState;

    // Rejects invalid calls  
    if (userClicks.length < 3 || index <= 0 || index >= userClicks.length - 1) {
      throw new Error("Invalid intermediary waypoint index");
    }

    const oldPoint = userClicks[index];
    const previousPoint = userClicks[index - 1];
    const nextPoint = userClicks[index + 1];

    // Computes new segments 
    const [previousSegment, nextSegment] = await Promise.all([
      resolveSegment(previousPoint, newCoordinates, segmentCache),
      resolveSegment(newCoordinates, nextPoint, segmentCache)
    ]);

    // Replaces the old coordinate with the new one 
    const newUserClicks = [...userClicks];
    newUserClicks[index] = newCoordinates;
    
    // Deletes stale segments + Adds new segments 
    const newSegmentCache = { ...segmentCache };

    delete newSegmentCache[segmentKey(previousPoint, oldPoint)];
    delete newSegmentCache[segmentKey(oldPoint, nextPoint)];

    newSegmentCache[segmentKey(previousPoint, newCoordinates)] = previousSegment;
    newSegmentCache[segmentKey(newCoordinates, nextPoint)] = nextSegment;

    // Updates manualRouteState
    manualRouteState.userClicks = newUserClicks;
    manualRouteState.segmentCache = newSegmentCache;
    manualRouteState.pathCoords = rebuildPathCoords(newUserClicks, newSegmentCache);
    manualRouteState.redoStack = [];

    await persistManualSegmentCache();
    await updateManualRoute(); 

    return {
      success: true
    };
  }
  catch (error) {
    throw new Error(`ERROR (replaceIntermediaryPoint()) : ${error}`, {cause : ERROR_MESSAGES.ROUTING.GENERIC_ROUTE_ACTION})
  }
}

/**
 * Replaces the current start point of a route with the inputted coordinates
 *
 * @param {number[]} currentClick
 * @returns {Object} Holds success
 */
async function changeRouteStart(currentClick) {

  try {
    const { userClicks, segmentCache } = manualRouteState;

    const oldStart = userClicks[0];

    // Moves starting point only if it is the only click 
    if (userClicks.length === 1) {
      userClicks[0] = currentClick;
      manualRouteState.pathCoords = [currentClick];
      await updateManualRoute();

      return {
        "success": true
      };
    }


    // Calculates new segment 
    const secondPoint = userClicks[1];
    const newFirstSegment = await resolveSegment(currentClick, secondPoint, segmentCache);

    // Deletes old cached segment and adds the new one 
    const proposedCache = { ...segmentCache };
    delete proposedCache[segmentKey(oldStart, secondPoint)];
    proposedCache[segmentKey(currentClick, secondPoint)] = newFirstSegment;

    const proposedClicks = [currentClick, ...userClicks.slice(1)];


    // Updates manualRouteState 
    manualRouteState.userClicks = proposedClicks;
    manualRouteState.segmentCache = proposedCache;
    manualRouteState.pathCoords = rebuildPathCoords(proposedClicks, proposedCache);
    manualRouteState.isSnapped = proposedClicks.length > 1 && coordinatesEqual(proposedClicks.at(-1), currentClick);

    await persistManualSegmentCache();
    await updateManualRoute();

    return {
      "success": true
    };
  } 
  catch(error) {
    throw new Error(`ERROR (changeRouteStart()) : ${error}`, {cause : ERROR_MESSAGES.ROUTING.GENERIC_ROUTE_ACTION})
  }
};
