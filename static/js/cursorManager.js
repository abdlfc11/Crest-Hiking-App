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

export function initCursorManager(map, getCurrentMode, getClickMode) {
  if (!map) {
    console.warn('[cursorManager] No map provided to initCursorManager');
    return;
  }

  viewport = map.getViewport();
  getCurrentModeFn = getCurrentMode;
  getClickModeFn = getClickMode;

  // whenever the cursor moves the cursor is updated using the OpenLayers viewport element
  map.on('pointermove', () => {
    if (viewport) {
      viewport.style.cursor = desiredCursor;
    }
  });

  // applies the cursor based on the state of the app
  updateCursor();
}

/**
 * Re-evaluates the desired cursor from app state and applies it.
 * this is called whenever route creation mode or click mode changes.
 */
export function updateCursor() {
  if (!getCurrentModeFn || !getClickModeFn) {
    return;
  }

  const mode = getCurrentModeFn();
  const clickMode = getClickModeFn();

  if (clickMode || mode === 'manual') {
    setCursor('crosshair');
  } else {
    setCursor('grab');
  }
}

/**
 * forces a specific cursor immediately.
 * should only for transient states if needed; prefer updateCursor() for normal flow.
 */
export function setCursor(cursorValue) {
  desiredCursor = cursorValue;
  if (viewport) {
    viewport.style.cursor = desiredCursor;
  }
}

/**
 * Force re-apply the current desired cursor.
 * Useful after closing panels (saved routes dashboard, etc.) when no pointer move has occurred yet
 */
export function forceApplyCursor() {
  if (viewport) {
    viewport.style.cursor = desiredCursor;
  }
}
