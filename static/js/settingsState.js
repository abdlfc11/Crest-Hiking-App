let appSettings = loadSettings();

function loadSettings() {
  return {
    distanceUnit: localStorage.getItem("distanceUnit") || "km",
  };
}

export function getAppSettings() {
  return appSettings;
}

export function saveAppSettings(settings) {
  localStorage.setItem("distanceUnit", settings.distanceUnit);
  appSettings = settings;
}
