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
 * Returns the styling to be applied to intermediary points on a route
 * @returns {ol.style.Style}
 */
export function createManualPointStyle() {
  return new Style({
    image: new Circle({
      radius: 6.5,
      fill: new Fill({
        color: "#000000"
      }),
      stroke: new Stroke({
        color: "#FFFFFF",
        width: 3
      })
    }),
    zIndex: 1000
  })
}

/**
 * Returns the styling to be applied to dynamic points created on a route by the elevation chart 
 * @returns {ol.style.Style} 
 */
export function createElevationPointStyle() {
  return new Style({
    image: new Circle({
      radius: 7.5,
      fill: new Fill({
        color: '#FFFFFF'
      }),
      stroke: new Stroke({
        color: '#0a45e7',
        width: 3
      })
    }),
    zIndex: 1200
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