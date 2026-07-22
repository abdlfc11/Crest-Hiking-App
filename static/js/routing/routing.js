import { manualRouteState,
  hasElevation,
  extractElevation,
  extractElevationProfile,
  getElevationRange,
  cumbriaBoundary,
  isPointInPolygon
} from "../routes/routeState.js";
import { showError } from "../utils.js";

export async function calculatePath(startPoint, endPoint) {
  const url = window.appConfig.apiCalculatePathUrl;
  const startArray = startPoint.split(",").map((num) => Number(num.trim()));
  const endArray = endPoint.split(",").map((num) => Number(num.trim()));

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
    showError(data.message || "Sorry, there was an unexpected error when calculating your route, please try again later.")
    throw new Error(`HTTP error: ${response.status}`);
  }

  if (data.success) {
    return data;
  }
  showError(data.message || "Sorry, there was an unexpected error when calculating your route, please try again later.")
  throw new Error(data.message || "Path creation failed");
}

window.calculatePath = calculatePath; // To test the calculation of paths i.e how long it takes

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
    throw new Error(`HTTP error: ${response.status}`);
  }

  const data = await response.json();

  if (data.success) {
    return data;
  }
  throw new Error(data.message || "Error whilst calculating manual path segment");
}

export async function addManualPoint(x, y) {
  const { userClicks, pathCoords, segmentCache } = manualRouteState;
  const currentClick = [x, y];

  // The below code uses a more computationally expensive but much more accurate way of finding out if a point is in Cumbria
  const lonLatCoords = ol.proj.toLonLat(currentClick);
  const isInCumbria = isPointInPolygon(lonLatCoords, cumbriaBoundary);
  if (!isInCumbria) {
      return {"success": false, "message": "Please click on a point within Cumbria"};
  }

  // this restores the redo stack
  manualRouteState.redoStack = [];

  if (userClicks.length === 0) {
    userClicks.push(currentClick);
    pathCoords.push(currentClick);
    const { updateManualRoute } = await import("../ui.js");
    updateManualRoute();
    return {"success": true};
  }
 
  const lastClickedPoint = pathCoords[pathCoords.length - 1];
  const start = userClicks[0];
  let finalClick = currentClick;
  const end = currentClick;

  if (userClicks.length >= 3) {
    const thresholdDistance = 50;

    const startLonLat = ol.proj.toLonLat(start);
    const endLonLat = ol.proj.toLonLat(end);

    const distance = ol.sphere.getDistance(startLonLat, endLonLat);

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
      segment = segmentCache[key];
    }
    else {
      const data = await getPathSegment(lastClickedPoint, finalClick);

      if (!data.success) {
        return {"success": false, "message": "Sorry, we not find a path to that location"};;
      }

      segment = data.coordinates;

      // this stores the segment in cache 
      segmentCache[key] = segment;

      // this updates elevation change
      manualRouteState.initialElevation += data.route_stats.elevation_change;

    }
  }
  catch (error) {
    return {"success": false, "message": "Sorry, we not find a path to that location"};;
  }

  // this appends the segment to pathCoords (skips first point to prevent duplication)
  manualRouteState.pathCoords.push(... segment.slice(1))

  userClicks.push(finalClick);
  manualRouteState.isSnapped = true;

  // this updates the UI
  const { updateManualRoute } = await import("../ui.js");
  updateManualRoute();

  return {"success": true};
}
