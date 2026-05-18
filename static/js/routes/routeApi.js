/**
 * Shared route HTTP helpers for the map page and saved-routes dashboard.
 * Implement the TODO blocks when you wire up each button.
 */

/** @typedef {{ name: string, type: string }} RouteRef */

/** sessionStorage key used when redirecting from dashboard → map to load a route */
export const PENDING_ROUTE_STORAGE_KEY = "crest.pendingRoute";

/**
 * @returns {Promise<{ routes: Array<{ name: string, type: string, filename?: string }> }>}
 */
export async function fetchRoutes() {
  const url = window.appConfig.apiGetRoutesUrl;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  const data = await response.json();

  if (Array.isArray(data.routes)) {
    return data;
  }

  throw new Error(data.message || "Error whilst fetching routes");
}

/**
 * @param {string} routeName
 * @param {string} fileType - e.g. "geojson" | "gpx"
 * @returns {Promise<{ success: boolean, message?: string, [key: string]: unknown }>}
 */
export async function deleteRoute(routeName, routeType) {

    const url = window.appConfig.apiDeleteRouteUrl

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        route_name: routeName,
        file_type: routeType
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();

    if (data.success) {
      return data;
    }
    else {
      throw new Error(data.message || "Route deletion failed")
    }
  }

/**
 * @param {string} routeName
 * @param {string} fileType
 * @returns {Promise<{ success: boolean, path_geojson?: object, coordinates?: number[][], route_stats?: object, message?: string }>}
 */
export async function loadRoute(routeName, fileType) {
  const url = window.appConfig.apiLoadRouteUrl;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      route_name: routeName,
      file_type: fileType
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status}`);
  }

  const data = await response.json();

  if (data.success) {
    return data;
  }
  else {
    throw new Error(data.message || "Loading the route failed")
  }
}

/**
 * @param {string} routeName
 * @param {"gpx" | "geojson"} format
 * @returns {Promise<Blob>}
 */
export async function downloadRoute(routeName, format) {
  // TODO: call a download endpoint when you add one on the backend, e.g.
  // GET `/download_route?name=${encodeURIComponent(routeName)}&format=${format}`
  throw new Error("downloadRoute is not implemented yet");
}

/**
 * Store a route to load after navigating to the map page.
 * @param {RouteRef} route
 */
export function setPendingRouteForMap(route) {
  sessionStorage.setItem(PENDING_ROUTE_STORAGE_KEY, JSON.stringify(route));
}

/**
 * @returns {RouteRef | null}
 */
export function consumePendingRouteForMap() {
  const raw = sessionStorage.getItem(PENDING_ROUTE_STORAGE_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(PENDING_ROUTE_STORAGE_KEY);
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
