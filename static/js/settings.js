/**
 * settings.js
 * Handles settings panel UI wiring for the map view (distance unit toggle + theme radio pills).
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
  getTheme,
} from "./settingsState.js";

import { formatDistance } from "./utils/format-utils.js";

import { logout, deleteAccount } from "./auth/auth.js";

import { applyTheme } from "./ui.js";

import { hasActiveRouteStatsPanel } from "./routes/routeState.js";

import { updateSavedRouteCards } from "./routes/savedRoutesDashboard.js";

/** @type {(() => void) | null} */
let onDistanceUnitChange = null;

const routeStatPanel = document.getElementById('route-stats');

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
  syncThemeRadiosWithCurrentSettings();
  applyTheme(getTheme());

  const isLoggedIn = window.appConfig.loggedIn

  if (!isLoggedIn) {
    return;
  }
 
  // 2. Background sync with server (user is authenticated on /map)
  loadAppSettingsFromServer()
    .then(() => {
      syncCheckboxWithCurrentSettings();
      syncThemeRadiosWithCurrentSettings();
      applyTheme(getTheme());
    })
    .catch((err) => {
      console.warn("[settings] server load failed, using local", err);
    });
 
  // NOTE: we intentionally do NOT attach open/close here.
  // ui.js does: addClickListener(settingOpenButton, openSettings...) and closeSettings()
 
  initAccountManagementButtons();
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
  
    // notify listeners (manual route, etc.)
    if (onDistanceUnitChange) {
      try {
        if (hasActiveRouteStatsPanel()) {
          onDistanceUnitChange();
        }
        updateSavedRouteCards();
      } catch (e) {
        console.error("onDistanceUnitChange handler threw", e);
      }
    }
}

/**
 * Read current settings and check the correct theme radio.
 * Uses the same once-only listener guard pattern as the distance checkbox.
 */
function syncThemeRadiosWithCurrentSettings() {
  const radios = document.querySelectorAll('input[name="theme"]');
  if (!radios.length) return;

  const settings = getAppSettings();
  const current = settings.theme || "system";

  radios.forEach((radio) => {
    radio.checked = radio.value === current;
  });

  if (!radios[0].dataset.settingsBound) {
    radios.forEach((radio) => {
      radio.addEventListener("change", handleThemeChange);
    });
    radios[0].dataset.settingsBound = "true";
  }
}

/**
 * Radio change handler – updates state, persists locally + server, applies visual theme.
 * @this {HTMLInputElement}
 */
function handleThemeChange() {
  const value = this.value; // "light" | "dark" | "system"
  const newSettings = { theme: value };

  const previous = getAppSettings();
  if (previous.theme === newSettings.theme) return;

  // local + memory
  saveAppSettings(newSettings);

  // server (best-effort)
  saveAppSettingsToServer({ theme: newSettings.theme }).catch((err) => {
    console.warn("[settings] failed to save to server:", err);
  });

  // immediately update the UI (side nav, saved routes dashboard, etc.)
  applyTheme(getTheme());
}

// Legacy alias some older code may have referenced (harmless if unused)
export { initSettings as initSettingsHandlers };

 // ACCOUNT MANAGEMENT BUTTONS IN PANEL

function initAccountManagementButtons() {

  // Logout button 
  const logoutBtn = document.getElementById("settings-logout-button");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logout );
  }

  // Delete account 
  const container = document.getElementById("delete-account-container");
  if (!container) return;

  const normalState = container.querySelector(".delete-normal-state");
  const confirmState = container.querySelector(".delete-confirm-state");
  const deleteBtn = document.getElementById("settings-delete-account-button");
  const cancelBtn = document.getElementById("delete-cancel-button");
  const confirmBtn = document.getElementById("delete-confirm-button");

  if (!normalState || !confirmState || !deleteBtn) return;

  // First click on "Delete" morphs the row into confirmation
  deleteBtn.addEventListener("click", () => {
    normalState.style.display = "none";
    confirmState.style.display = "flex";
  });

  // Cancel restores original row
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      confirmState.style.display = "none";
      normalState.style.display = "flex";
    });
  }

  // Final confirmation calls the delete endpoint from flask backend
  if (confirmBtn) {
    confirmBtn.addEventListener("click", () => {
      deleteAccount(true);
    });
  }
}
