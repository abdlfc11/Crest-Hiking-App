//#region 

import Fill from "ol/style/Fill"
import Icon from "ol/style/Icon"
import Stroke from "ol/style/Stroke"
import Style from "ol/style/Style"
import Text from "ol/style/Text"

const UNSELECTED_FILL = "#11617c"
const UNSELECTED_STROKE = "#FFFFFF"
const UNSELECTED_TEXT_FONT = "bold 12px system-ui"

const SELECTED_FILL = "#e92e60"
const SELECTED_STROKE = "#FFFFFF"
const SELECTED_TEXT_FONT = "bold 13px system-ui"

const TEXT_STROKE = "#FFFFFF"
const TEXT_FILL = '#000000'

//#endregion

/**
 * helper to generate SVG Data URIs with custom fill and stroke colors
 * @param {string} fillColor Hex or RGB color code for the pin interior
 * @param {string} [strokeColor="#FFFFFF"] Hex or RGB color code for the pin border
 * @returns {string} Data URI suitable for OpenLayers ol.style.Icon
 */
function createPinSvg(fillColor, strokeColor = "#FFFFFF") {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none">
      <ellipse cx="12" cy="22" rx="4" ry="1.5" fill="black" fill-opacity="0.25"/>
      
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" 
            fill="${fillColor}" 
            stroke="${strokeColor}" 
            stroke-width="1.5" 
            stroke-linecap="round" 
            stroke-linejoin="round"/>
            
      <circle cx="12" cy="10" r="3" fill="#FFFFFF" stroke="${strokeColor}" stroke-width="0.5"/>
    </svg>
  `;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/**
 * returns the default OpenLayers style for a saved map point
 * @param {string} name the label text to display above the pin
 * @param {string} [fill=null] The Fill colour of the point to be added, defaults to null 
 * @returns {ol.style.Style} OpenLayers Style object for standard points
 */
export function getSavedPointStyle(name, fill) {
  return new Style({

    // icon
    image: new Icon({
      src: createPinSvg(fill || UNSELECTED_FILL), 

      // anchor in order to place the icon above the point slightly rather than directly on-top of the point 
      anchor: [0.5, 1],           
      anchorXUnits: 'fraction',
      anchorYUnits: 'fraction',

      scale: 1,
    }),

    // text (name of point)
    text: new Text({
      text: name,
      
      font: UNSELECTED_TEXT_FONT,

      fill: new Fill({
        color: TEXT_FILL,
      }),

      stroke: new Stroke({
        color: TEXT_STROKE,
        width: 3
      }),

      offsetY: -36, 
    }),
  });
}

/**
 * returns the OpenLayers style for a selected/highlighted map point
 * @param {string} name the label text to display above the pin
 * @returns {ol.style.Style} OpenLayers Style object for selected points
 */
export function getSelectedPointStyle(name) {
  return new Style({

    // icon
    image: new Icon({
      src: createPinSvg(SELECTED_FILL), 

      // anchor in order to place the icon above the point slightly rather than directly on-top of the point 
      anchor: [0.5, 0.9],
      anchorXUnits: 'fraction',
      anchorYUnits: 'fraction',

      scale: 1.2, // scaled up for visual representation that it is selected 
    }),

    // text (name of point)
    text: new Text({
      text: name,

      font: SELECTED_TEXT_FONT,

      fill: new Fill({
        color: TEXT_FILL,
      }),

      stroke: new Stroke({
        color: TEXT_STROKE,
        width: 3 
      }),

      offsetY: -42,
    }),
  });
}