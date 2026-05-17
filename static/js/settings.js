import { getAppSettings, saveAppSettings } from "./settingsState.js";
import { formatDistance } from "./utils.js";

const settingsModalElement = document.getElementById("settings-modal");
const settingsButton = document.getElementById("settings-button");
const settingsClose = document.getElementById("settings-close");

let onDistanceUnitChange = null;

export function setOnDistanceUnitChange(handler) {
  onDistanceUnitChange = handler;
}

export function initSettings() {
  if (settingsButton) {
    settingsButton.addEventListener("click", openSettingsModal);
  }
  if (settingsClose) {
    settingsClose.addEventListener("click", closeSettingsModal);
  }

  if (settingsModalElement) {
    settingsModalElement.addEventListener("click", closeByClickingOutsideModal);

    const modalContent = settingsModalElement.querySelector(
      ".settings-modal-content",
    );
    if (modalContent) {
      modalContent.addEventListener("click", (e) => e.stopPropagation());
    }
  }

  initSettingsHandlers();
}

function openSettingsModal(e) {
  e.preventDefault();
  e.stopPropagation();
  settingsModalElement?.classList.add("active");
}

function closeSettingsModal(e) {
  e.preventDefault();
  e.stopPropagation();
  settingsModalElement?.classList.remove("active");
}

function closeByClickingOutsideModal(e) {
  if (e.target === this) {
    this.classList.remove("active");
  }
}

function toggleDistanceUnit() {
  const appSettings = getAppSettings();
  appSettings.distanceUnit = this.checked ? "miles" : "km";
  saveAppSettings(appSettings);
  onDistanceUnitChange?.();
}

function initSettingsHandlers() {
  const distanceUnitToggle = document.getElementById("distance-unit-toggle");
  const appSettings = getAppSettings();
  if (distanceUnitToggle) {
    distanceUnitToggle.checked = appSettings.distanceUnit === "miles";
    distanceUnitToggle.addEventListener("change", toggleDistanceUnit);
  }

  const routeDistanceDisplay = document.getElementById("route-distance-display");
  if (routeDistanceDisplay) {
    const currentDistance = parseFloat(
      routeDistanceDisplay.textContent.replace(/[^\d.]/g, ""),
    );
    if (!Number.isNaN(currentDistance)) {
      routeDistanceDisplay.textContent = formatDistance(currentDistance);
    }
  }
}
