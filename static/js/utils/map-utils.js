/**
 * This file is intended to hold all OpenLayers map related helper functions
 * As of August 2026 this file hold the following functions:
 *      
 *      - moveMapToPosition(map, position = null, duration = 1200, zoom = 10.5)
 */

import { fromLonLat } from "ol/proj";

/**
 * Function to move the map to a specific coordinate or the centre of the map via an animation
 * 
 * Position is expected in EPSG:4326 ( [Lon, Lat] )
 * It is converted to Web Mercator before animating the map movement (OpenLayers map is in a Web Mercator projection)
 * 
 * @param {ol.Map} map OL map instance 
 * @param {Array} position The specific coordinate to move the map to in [Lon, Lat] format, if not entered it defaults to the map centre  
 * @param {number} duration How long the animation to move the map takes
 * @param {number} zoom Zoom level used by open layers 
 * @returns {void}
 */
export function moveMapToPosition(map, position = null, duration = 1200, zoom = 10.5) {
  if (!map) {
    console.warn("No map, returning");
    return;
  }

  const targetLatLon = Array.isArray(position) && position.length === 2
    ? position
    : (Array.isArray(window.appConfig?.mapInitialCentre) ? window.appConfig.mapInitialCentre : [-3.198308, 54.465458]);

  // this converts [Lon, Lat] coordinates into Web Mercator coordinates that the OpenLayers map can use 
  const targetPosition = fromLonLat(targetLatLon);

  map.getView().animate({
    center: targetPosition,
    zoom: zoom,
    duration: duration
  })
};