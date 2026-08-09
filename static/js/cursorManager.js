/**
 * NOTES:  
 * 
 * OVERVIEW : 
 * Central, future-proof place to manage the map cursor.
 * 
 * WHY :
 * OpenLayers internally sets `cursor: pointer` on .ol-viewport whenever the pointer
 * is over a feature (saved points, route line, etc.). 
 * We want full control (crosshair in manual / clickMode, grab in normal auto mode)
 * even when hovering features.
 * 
 * RESPONSIBILITIES:
 * - writes to the OL viewport element (map.getViewport())
 * - Re-applies the desired cursor on every OL pointermove (after OL's own logic runs)
 * - Provides a single updateCursor() that decides based on current app state
 */

let viewport = null;
let getCurrentModeFn = null;
let getClickModeFn = null;
let desiredCursor = 'grab';
let mapRef = null;          // keep a reference so we can call hasFeatureAtPixel

export function initCursorManager(map, getCurrentMode, getClickMode) {
  if (!map) {
    console.warn('[cursorManager] No map provided to initCursorManager');
    return;
  }

  mapRef = map;
  viewport = map.getViewport();
  getCurrentModeFn = getCurrentMode;
  getClickModeFn = getClickMode;

  // every pointer move → decide the final cursor
  map.on('pointermove', (evt) => {
    applyCursor(evt.pixel);
  });

  // initial application
  updateCursor();
}

/**
 * Re-evaluates the desired cursor from app state and applies it.
 */
export function updateCursor() {
  if (!getCurrentModeFn || !getClickModeFn) return;

  const mode = getCurrentModeFn();
  const clickMode = getClickModeFn();

  if (clickMode || mode === 'manual') {
    setCursor('crosshair');
  } else {
    setCursor('grab');
  }
}

/**
 * Forces a specific cursor immediately.
 */
export function setCursor(cursorValue) {
  desiredCursor = cursorValue;
  // apply immediately (no pixel available → no feature check)
  applyCursor(null);
}

/**
 * Force re-apply the current desired cursor
 * (useful after closing panels, etc.)
 */
export function forceApplyCursor() {
  applyCursor(null);
}

/**
 * Internal helper that decides the final cursor value
 * and writes it to the viewport.
 *
 * @param {import('ol').Pixel | null} pixel current mouse pixel (null = no feature test)
 */
function applyCursor(pixel) {
  if (!viewport) return;

  let cursor = desiredCursor;

  // Only consider pointer when we are auto routing --> 'grab' cursor instead of 'pointer' cursor 
  if (desiredCursor === 'grab' && pixel && mapRef) {

    // gets the feature under the cursor (if any)
    const feature = mapRef.forEachFeatureAtPixel(
      pixel,
      (f) => f  // this returns the first feature found
    );

    if (feature) {
      const geometryType = feature.getGeometry().getType();
      const type = feature.get('type');

      const hoveredOverStartOrEndPoint = geometryType === 'Point' && (type === 'start' || type === 'end')
      const hoveredOverLineString = geometryType === 'LineString'

      // this shows the pointer on everything EXCEPT Point features named "start" or "end" AND Linestrings 
      // this ensures that only saved points have the 'pointer' cursor, LineStrings will be removed from this when further route editing is implemented 
      if ( !hoveredOverStartOrEndPoint && !hoveredOverLineString ) {
        cursor = 'pointer';
      }
    }
  }

  viewport.style.cursor = cursor;
}