/**
 * settingsState.js
 * Central in-memory + persisted (localStorage + server) store for user app preferences.
 * Supports `distanceUnit` ("km" | "miles"), Theme {dark, light and system}
 * Other modules import getAppSettings() for read-only access (e.g. formatDistance).
 *
 * @module settingsState
 */

/** 
 * @typedef {Object} AppSettings
 * @property {'km' | 'miles'} distanceUnit
 * @property {'light' | 'dark' | 'system'} theme
 */

let appSettings = {
  distanceUnit: "km",
  theme: "system"
};

/**
 * Hydrate from localStorage (sync, used for instant UI before server round-trip).
 * Falls back to previous "distanceUnit" key for backward compatability
 */
function hydrateFromLocalStorage() {
  try {
    const saved = localStorage.getItem("appSettings");
    if (saved) {
      const parsed = JSON.parse(saved); // this makes a JS Object from the local storage string
      if (parsed) {
        appSettings = { ...appSettings, ...parsed };
        return;
      }
    }
    // legacy key
    const legacy = localStorage.getItem("distanceUnit");
    if (legacy === "miles" || legacy === "km") {
      appSettings.distanceUnit = legacy;
    }
  } catch (e) {
    // ignore corrupt localStorage
  }
}

hydrateFromLocalStorage();

/**
 * Return a clone of current settings. Safe for consumers.
 * @returns {AppSettings}
 */
export function getAppSettings() {
  return { ...appSettings };
}

/**
 * Update in-memory state + localStorage. Does NOT touch the server.
 * @param {AppSettings} settings
 */
export function saveAppSettings(settings) {

  if(!settings) return;

  appSettings = { ...appSettings, ...settings };
  try {
    localStorage.setItem("appSettings", JSON.stringify(appSettings));

    if (settings.distanceUnit) {
      localStorage.setItem("distanceUnit", appSettings.distanceUnit);
    }
  } catch (e) {
    // storage full / private mode etc.
  }
}

/**
 * Asynchronously load preferences from the backend for the logged-in user
 * and merge into local state (server wins for this session).
 *
 * @returns {Promise<AppSettings>}
 */
export async function loadAppSettingsFromServer() {
  const url = window.appConfig && window.appConfig.apiGetSettings;
  if (!url) {
    console.debug("[settingsState] no apiGetSettings configured");
    return getAppSettings();
  }

  try {
    const res = await fetch(url, { method: "GET", credentials: "same-origin" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (data && data.success && data.settings_dict) {
      const incoming = data.settings_dict;
      if (incoming.distanceUnit === "km" || incoming.distanceUnit === "miles") {
        saveAppSettings({ distanceUnit: incoming.distanceUnit });
      }
      if (incoming.theme === "dark" || incoming.theme === "light" || incoming.theme === "system") {
        saveAppSettings({ theme: incoming.theme });
      }
    }
  } catch (err) {
    console.warn("[settingsState] failed to load settings from server:", err);
    // keep whatever we have in memory/local
  }
  return getAppSettings();
}

/**
 * Persist the provided (or current) settings to the backend.
 * Fire-and-forget friendly; throws on hard failure.
 *
 * @param {Object<string, string>} [settingsDict] - e.g. { distanceUnit: "miles" }
 * @returns {Promise<{ success: boolean, message?: string }>}
 */
export async function saveAppSettingsToServer(settingsDict) {
  const url = window.appConfig && window.appConfig.apiSaveSettings;
  if (!url) throw new Error("apiSaveSettings not present in window.appConfig");

  const payload = settingsDict || { ...appSettings };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ settings_dict: payload }),
  });

  if (!res.ok) {
    throw new Error(`Save settings HTTP ${res.status}`);
  }
  return res.json();
}

// ##### SYSTEM THEME #####

/**
 * returns the correct theme to apply at the time of calling
 * @returns {string}
 */
export function getTheme() {
  const currentTheme = appSettings.theme;

  if (currentTheme === "system") {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches; // var is a boolean value, True for dark and false for light
    return prefersDark ? "dark" : "light" // if prefersDark is true, the return value is "dark" otherwise it is "light"
  }
  return currentTheme
} 

/**
 * Returns the current distance unit preference.
 * @returns {'km' | 'miles'}
 */
export function getDistanceUnit() {
  return appSettings.distanceUnit;
}