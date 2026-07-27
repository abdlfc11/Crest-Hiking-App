/**
 * This file is intended to hold all formatting related functions
 * As of July 2026 this file hold the following functions:
 *      
 *      - formatDistance(distanceLm)
 *      - formatETA(seconds)
 *      - formatElevation(elevation)
 */

import { getAppSettings } from "../settingsState.js"; // used in formatDistance()


/**
 * Creates a formatted distance string from a distanceKm variable that is a number (float) 
 * 
 * @param {number} distanceKm The length of a route in KM 
 * @returns {string} The formatted distance string that is to be shown to the user
 */
export function formatDistance(distanceKm) {
  const appSettings = getAppSettings(); // retrieves copy of app setting object from settingsState.js 
  const distanceUnit = appSettings?.distanceUnit;

  if (distanceUnit === "miles") {
    const distanceMiles = distanceKm * 0.621371; 
    return `${distanceMiles.toFixed(2)} mi`;
  }
  return `${distanceKm.toFixed(2)} km`;
}

/**
 * Creates a formatted ETA string from a seconds variable that is either an int/float or a string 
 * 
 * @param {string | number} seconds 
 * @returns {string} The formatted ETA string that is to be shown to the user 
 */
export function formatETA(seconds) {
    if (isNaN(seconds)) {
      seconds = parseFloat(seconds)
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours === 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
}

/**
 * 
 * @param {string|number} elevationChange usually this is a string such as "938.0" or "-329.0" however the possibility of an int / float being passed is accounted for
 * @returns {string} this is a string which has been formated to add a + or leave the string unchanged if it is negative 
 */
export function formatElevation(elevation) {
  const elevNum = Math.round(Number(elevation))
  const elevDisplayValue = isNaN(elevNum) ? "0m" : (elevNum >= 0 ? `+${elevNum} m` : `${elevNum} m`)

  return elevDisplayValue
}