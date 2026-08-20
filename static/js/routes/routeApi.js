/**
 * Shared route HTTP helpers for the map page and saved-routes dashboard.
 * Implement the TODO blocks when you wire up each button.
 */

/** @typedef {{ name: string, type: string }} RouteRef */


/**
 * @param {string} routeName
 * @param {string} fileType - e.g. "geojson" | "gpx"
 * @returns {Promise<{ success: boolean, message?: string, [key: string]: unknown }>}
 */
export async function deleteRoute(routeName) {

  const url = window.appConfig.apiDeleteRouteUrl

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      route_name: routeName,
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || `Load Route Error : ${response.status}`, {cause: data.user_message || "Sorry, there was an error downloading your route, please try again later."});
  }

  return data
}

/**
 * @param {string} routeName
 * @returns {Promise<{ success: boolean, path_geojson?: object, coordinates?: Array<Array<number>>, route_stats?: object, message?: string }>}
 */
export async function loadRoute(routeName) {
  const url = window.appConfig.apiLoadRouteUrl;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      route_name: routeName,
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || `Load Route Error : ${response.status}`, {cause: data.user_message || "Sorry, there was an error loading your route, please try again later."});
  }

  return data;
}

/**
 * @param {string} routeName
 * @param {"gpx" | "geojson"} format
 * @param {HTMLButtonElement} DOMElement
 * @returns {Promise<Blob>}
 */
export async function downloadRoute(routeName, format, DOMElement) {

  const url = window.appConfig.apiDownloadRouteFileUrl
  DOMElement.classList.add('loading');

  const response = await fetch(url, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      route_name: routeName,
      route_type: format
    })
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.message || `Download Route Error : ${response.status}`, {cause: data.user_message || "Sorry, there was an error downloading your route, please try again later."});
  }

  DOMElement.classList.remove('loading')
  return response
}

