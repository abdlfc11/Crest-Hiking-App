
import { map } from "./map.js"; 

const startPointEntry = document.getElementById("start_point_entry");
const endPointEntry = document.getElementById("end_point_entry");

export let loadedRouteCoordinates = null;
export let currentPathData = null;
export let displayedPath = null;

// ###########
// HELPER FUNCTIONS
// ###########

// ###########
// MAIN CALCULATE PATH FUNCTION
// ###########

export function calculatePath() {

  if(endPointEntry.value === "" && startPointEntry.value === "") {
    showError(startPointEntry, "Please enter coordinates");
    showError(endPointEntry, "Please enter coordinates");
    return
  }
  if (startPointEntry.value === "") {
    showError(startPointEntry, "Please enter coordinates");
    return;
  }
  if (endPointEntry.value === "") {
    showError(endPointEntry, "Please enter coordinates");
    return;
  }

  generatePathButton.disabled = true;
  generatePathButton.classList.add("loading");

  fetch(apiCalculatePathUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      start_point: startPointEntry.value,
      end_point: endPointEntry.value,
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {

        if (displayedPath) {
          map.removeLayer(displayedPath);
          displayedPath = null;
        }
        
        displayedPath = new ol.layer.Vector({
          source: new ol.source.Vector({
            features: new ol.format.GeoJSON().readFeatures(data.pathGeoJSON),
          }),
          style: new ol.style.Style({
            stroke: new ol.style.Stroke({
              color: getPathColor(),
              width: 5,
            }),
          }),
        });
        map.addLayer(displayedPath);
        currentPathData = data.coordinates;

        generatePathButton.classList.remove("loader");

        const pathSource = displayedPath.getSource();
        const view = map.getView();

        setTimeout(() => {
          view.fit(pathSource.getExtent(), {
            padding: [50, 350, 50, 300],
            duration: 1200,
          });
        }, 100);

        const saveRouteDiv = document.getElementById("save_route");
        saveRouteDiv.style.display = "block";

        if (data.route_stats) {
          const statsHtml = `
            <div id="route-stats">
              <div class="stats-header">
                <span class="stats-title">Route Information</span>
              </div>
              <div class="stats-content">
                <div class="stat-row">
                  <span class="stat-label" >Distance:</span>
                  <span class="stat-value" id="route_distance_display">${formatDistance(parseFloat(data.route_stats.total_distance))}</span>
                </div>
                <div class="stat-row">
                  <span class="stat-label">ETA:</span>
                  <span class="stat-value" id="route_eta_display">${data.route_stats.eta}</span>
                </div>
                <div class="stat-row">
                  <span class="stat-label">Elevation Change:</span>
                  <span class="stat-value" id="route_elevation_change_display">${data.route_stats.elevation_change}</span>
                </div>
              </div>
            </div>
          `;
          const existingStats = document.getElementById("route-stats");
          if (existingStats) existingStats.remove();
          document.body.insertAdjacentHTML("beforeend", statsHtml);
        }

        updateLoadRouteVisibility();
      } else {
        homeButtonFunction();
        console.log("failure in forming a path with the error: ", data.error);
      }
    })
    .catch((error) => console.error("Error", error))
    .finally(() => {
      generatePathButton.disabled = false;
      generatePathButton.classList.remove("loading")
    })
}