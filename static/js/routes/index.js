export { initSaveRoute } from "./saveRoute.js";
export {
  fetchRoutes,
  deleteRoute,
  loadRoute,
  downloadRoute,
} from "./routeApi.js";
// Dashboard exports live in savedRoutesDashboard.js — import from there on /saved_routes only.
export {
  getCurrentMode,
  setCurrentMode,
  getCurrentPathData,
  setCurrentPathData,
  getLoadedRouteCoordinates,
  setLoadedRouteCoordinates,
  clearPathState,
  clearManualRouteState,
  manualRouteState,
} from "./routeState.js";
