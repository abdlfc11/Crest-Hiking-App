/**
 * settings.js
 * Handles settings panel UI wiring for the map view (distance unit toggle).
 * Open/close of the panel itself is managed by ui.js (style.width).
 * Persists choice to both localStorage (via settingsState) and the Flask backend.
 *
 * Uses vanilla JS + JSDoc. No framework.
 *
 * @module settings
 */

import {
  getAppSettings,
  saveAppSettings,
  loadAppSettingsFromServer,
  saveAppSettingsToServer,
} from "./settingsState.js";
import { formatDistance } from "./utils.js";

/** @type {(() => void) | null} */
let onDistanceUnitChange = null;

/**
 * Register callback invoked after distance unit is toggled.
 * Used by ui.js to refresh manual route stats, etc.
 *
 * @param {() => void} handler
 */
export function setOnDistanceUnitChange(handler) {
  onDistanceUnitChange = handler;
}

/**
 * Entry point called from map.js after DOM ready.
 * Loads server prefs (async) then wires the checkbox using the real DOM id from map.html.
 * Does NOT touch open/close buttons (handled in ui.js to avoid duplicate listeners / scope issues).
 */
export function initSettings() {
  // 1. Immediate UI from local/default
  syncCheckboxWithCurrentSettings();

  // 2. Background sync with server (user is authenticated on /map)
  loadAppSettingsFromServer()
    .then(() => {
      syncCheckboxWithCurrentSettings();
    })
    .catch((err) => {
      console.warn("[settings] server load failed, using local", err);
    });

  // Note: we intentionally do NOT attach open/close here.
  // ui.js does: addClickListener(settingOpenButton, openSettings...) and closeSettings()
}

/**
 * Read current settings and set checkbox state + (re)attach change handler once.
 */
function syncCheckboxWithCurrentSettings() {
  const checkbox = document.getElementById("distance-unit-checkbox");
  if (!checkbox) return;

  const settings = getAppSettings();
  checkbox.checked = settings.distanceUnit === "miles";

  // guard against double-binding across hot reloads / multiple inits
  if (!checkbox.dataset.settingsBound) {
    checkbox.addEventListener("change", handleDistanceUnitChange);
    checkbox.dataset.settingsBound = "true";
  }
}

/**
 * Toggle handler – updates state, persists locally + server, refreshes consumers.
 * @this {HTMLInputElement}
 */
function handleDistanceUnitChange() {
  const isMiles = this.checked;
  const newSettings = { distanceUnit: isMiles ? "miles" : "km" };

  const previous = getAppSettings();
  if (previous.distanceUnit === newSettings.distanceUnit) return;

  // local + memory
  saveAppSettings(newSettings);

  // server (best-effort)
  saveAppSettingsToServer({ distanceUnit: newSettings.distanceUnit }).catch((err) => {
    console.warn("[settings] failed to save to server:", err);
    // UI still updated locally; user can retry by toggling again
  });

  // re-format any currently visible distance numbers that were rendered with old unit
  // (safe on initial load; for live toggles after a route is shown the caller of onChange
  //  (updateManualRoute) will recompute from source data so we don't parse ambiguous text)
  refreshStaticDistanceDisplaysIfSafe();

  // notify listeners (manual route, etc.)
  if (onDistanceUnitChange) {
    try {
      onDistanceUnitChange();
    } catch (e) {
      console.error("onDistanceUnitChange handler threw", e);
    }
  }
}

/**
 * Best-effort refresh of #route-distance-display elements.
 * Only safe when we know the numeric value inside is still the original km value
 * (i.e. right after page load before any toggle). After first toggle we rely on
 * recompute paths in ui.js instead of parsing formatted strings.
 */
function refreshStaticDistanceDisplaysIfSafe() {
  const els = document.querySelectorAll("#route-distance-display");
  els.forEach((el) => {
    const raw = (el.textContent || "").replace(/[^\d.]/g, "");
    const num = parseFloat(raw);
    if (!Number.isNaN(num)) {
      // assume the value was produced from km source data at render time
      el.textContent = formatDistance(num);
    }
  });
}

// Legacy alias some older code may have referenced (harmless if unused)
export { initSettings as initSettingsHandlers };
