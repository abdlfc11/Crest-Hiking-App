/**
 * This file is intended to hold all styling related functions
 * As of July 2026 this file hold the following functions:
 * 
 *      - createManualPointStyle(label, colour, radius=7.5, strokeBorderColor="#FFFFFF")
 *      - getRouteStrokeStyle()
 * 
 */



/**
 * 
 * @param {string} label The text to be displayed above the point
 * @param {string} colour The inner (fill) colour of the point
 * @param {number} radius Radius of the point
 * @param {string} strokeBorderColor Border colour of the point + text  
 * @returns {Object} The styling to be applied to the point via OL
 */
export function createManualPointStyle(label, colour, radius=7.5, strokeBorderColor="#FFFFFF") {
  return new ol.style.Style({
    image : new ol.style.Circle({
      radius : radius,
      fill : new ol.style.Fill({
        color : colour
      }),
      stroke : new ol.style.Stroke({
        color : strokeBorderColor,
        width : 3
      })
    }),
    text : label ? new ol.style.Text({
      text : label,
      font : "bold 12px sans-serif",
      fill : new ol.style.Fill({
        color : "black"
      }),
      stroke : new ol.style.Stroke({
        color : strokeBorderColor,
        width : 3
      }),
      offsetY : -15
    }) : null
  })
}

/**
 * Function used to get the styling of route LineStrings displayed on the map 
 * 
 * @returns {Object} The styling to be applied to the LineString via OL
 */
export function getRouteStrokeStyle() {
  return {
    color: "#2563eb",
    width: 8,
    lineCap: "round",
    lineJoin: "round",
  }
}