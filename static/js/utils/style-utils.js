/**
 * This file is intended to hold all styling related functions
 * As of July 2026 this file hold the following functions:
 * 
 *      - createManualPointStyle(label, colour, radius=7.5, strokeBorderColor="#FFFFFF")
 *      - getRouteStrokeStyle()
 * 
 */

import Fill from "ol/style/Fill"
import Stroke from "ol/style/Stroke"
import Circle from "ol/style/Circle"
import Style from "ol/style/Style"



/**
 * 
 * @param {string} label The text to be displayed above the point
 * @param {string} colour The inner (fill) colour of the point
 * @param {number} radius Radius of the point
 * @param {string} strokeBorderColor Border colour of the point + text  
 * @returns {Object} The styling to be applied to the point via OL
 */
export function createManualPointStyle(label, colour, radius=7.5, strokeBorderColor="#FFFFFF") {
  return new Style({
    image : new Circle({
      radius : radius,
      fill : new Fill({
        color : colour
      }),
      stroke : new Stroke({
        color : strokeBorderColor,
        width : 3
      })
    }),
    text : label ? new Text({
      text : label,
      font : "bold 12px sans-serif",
      fill : new Fill({
        color : "black"
      }),
      stroke : new Stroke({
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