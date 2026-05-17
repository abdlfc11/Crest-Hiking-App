import { manualRouteState } from "../routes/routeState.js";

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

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  const data = await response.json();

  if (data.success) {
    return data;
  }
  throw new Error(data.message || "Path creation failed");
}

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
  const { userClicks, pathCoords } = manualRouteState;
  const currentClick = [x, y];

  if (userClicks.length === 0) {
    userClicks.push(currentClick);
    pathCoords.push(currentClick);
    const { updateManualRoute } = await import("../ui.js");
    updateManualRoute();
    return;
  }

  const lastClickedPoint = pathCoords[pathCoords.length - 1];
  const start = userClicks[0];
  let finalClick = currentClick;
  const end = currentClick;

  if (userClicks.length >= 3) {
    const thresholdDistance = 50;
    const distanceX = end[0] - start[0];
    const distanceY = end[1] - start[1];
    const distance = Math.sqrt(distanceX ** 2 + distanceY ** 2);

    if (distance < thresholdDistance) {
      finalClick = start;
    }
  }

  if (!lastClickedPoint) {
    console.error("No starting point found");
    return;
  }

  try {
    const data = await getPathSegment(lastClickedPoint, finalClick);

    if (data?.success) {
      const newSegment = data.coordinates;
      manualRouteState.pathCoords.push(...newSegment.slice(1));
      userClicks.push(finalClick);
      const { updateManualRoute } = await import("../ui.js");
      updateManualRoute();
    } else {
      console.warn("Could not find a path to that location");
    }
  } catch (error) {
    console.warn("Could not find a path to that location", error);
  }
}
