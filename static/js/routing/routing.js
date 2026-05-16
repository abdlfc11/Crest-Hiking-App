
import { getMap, map } from "../map.js"; 
import { getPathColour } from "../layers.js";

// ###########
// HELPER FUNCTIONS
// ########### 


// ###########
// MAIN CALCULATE PATH FUNCTION
// ###########

export async function calculatePath(startPoint, endPoint) {

  const url = window.appConfig.apiCalculatePathUrl

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        start_point: startPoint,
        end_point: endPoint,
      }),
    })


    // checks if html status is between 200-299 and returns appropriate error if not
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`)
    }

    const data = await response.json()

    if (data.success) {
      return data
    }
    else {
      console.error("Path calculation failed")
      throw new Error(data.message || "Path creation failed")
    }
  } 
  catch (error) {
    console.error("Error while calculating path", error)
    throw error
  }
}


// ###########
// MANUAL ROUTING
// ###########

// getting the path segment
export async function getPathSegment(start, end) {

  const url = window.appConfig.apiCalculatePathUrl

  try {
    const response = await fetch(url, {
      "method" : "POST", 
      "headers" : { "Content-Type" : "application/json"},
      "body" : JSON.stringify({ start_point : `${start[0]}, ${start[1]}`, end_point : `${end[0]}, ${end[1]}`}) // NOTE : data is being sent back to flask here
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`)
    }

    const data = await response.json()

    if (data.success) {
      return data
    }
    else {
      console.error("Manual routing calculation failed")
      throw new Error(data.message || "Error whilst calculating manual path segment")
    }
  }
  catch (error) {
    throw error
  }
}


// adding a point on the map
async function addManualPoint(x, y) {

  let currentClick = [x, y];

  if (routingStateObject.userClicks.length === 0) {
    routingStateObject.userClicks.push(currentClick);
    routingStateObject.pathCoords.push(currentClick);
    updateManualRoute();
    return;
  }

  routingStateObject.lastClickedPoint = routingStateObject.pathCoords[routingStateObject.pathCoords.length - 1]; // get the last coordinate in the path
  const start = routingStateObject.userClicks[0]; // sets the first coord to the start variable

  let finalClick = currentClick; // sets the final click variable to the coords of the current click
  let end = currentClick; // sets end to the newly clicked point

  // if the user has clicked and plotted more than three points
  if (routingStateObject.userClicks.length >= 3) {

    // sets the distance threshold (20 metres)
    const threshold_distance = 50;

    // euclidean distance AKA pythag theorem
    const distance_x = end[0] - start[0];
    const distance_y = end[1] - start[1];
    const distance = Math.sqrt((distance_x)**2 + (distance_y)**2);
    
    // if the distance is less than the threshold distance
    if (distance < threshold_distance) {
      finalClick = start;
      console.log("Snapping to start");
    }
  }

  if (!routingStateObject.lastClickedPoint) {
    console.error("No starting point found");
    return;
  }

  const data = await getPathSegment(routingStateObject.lastClickedPoint, finalClick); // calculate the segment between the new coord and last coord in the path

  if (data && data.success) {

    const newSegment = data.coordinates; 

    routingStateObject.pathCoords = routingStateObject.pathCoords.concat(newSegment.slice(1)) // stitch the segment into the path (excepting the coord of the new segment to prevent duplicates)

    routingStateObject.userClicks.push(finalClick); // adds the final click to the path coord array

    updateManualRoute();
  }
  else {
    console.warn("Could not find a path to that location")
  }

}


// updating the route once a point has been plotted


function updateManualRoute() {

  const map = getMap();

  // this removes the old map layer to make a fresh path
  if (routingStateObject.manualRouteLayer) {
    map.removeLayer(routingStateObject.manualRouteLayer);
  }

  // if there are no clicks then hide the stats div
  if (routingStateObject.userClicks.length === 0) {
    const existingStats = document.getElementById("route-stats");
    if (existingStats) {
      existingStats.remove();
    }


    const saveRouteDiv = document.getElementById("save_route");
    if (saveRouteDiv && currentMode === "manual") {
      saveRouteDiv.style.display = "none";
    }
    return;
  }

  if (routingStateObject.currentMode === "manual") {
    const saveRouteDiv = document.getElementById("save_route");
    if (saveRouteDiv) {
      saveRouteDiv.style.display = "block";
    }
  }

  const totalDistanceMeters = calculateTotalDistance(routingStateObject.pathCoords);
  const totalDistanceKm = totalDistanceMeters / 1000;
  const distanceDisplay = formatDistance(totalDistanceKm);
  const etaDisplay = calculateETA(totalDistanceKm);

  // array used to hold both Point and LineString features
  const features = [];

  // creates point features where the user clicked
  routingStateObject.userClicks.forEach((point, index) => {
    
    // this defines the point feature (type is used to reference the type of feature later)
    const feature = new ol.Feature({
      geometry : new ol.geom.Point(point),
      type : "point"
    });

    // adds the index to the feature to be used in the ID'ing of start and end points
    feature.set("index", index);
    
    // feature then pushed into the array
    features.push(feature);
  })

  // if there is more than one point then add LineString features between them
  if (routingStateObject.pathCoords.length > 1) {
    features.push( new ol.Feature({
      geometry : new ol.geom.LineString(routingStateObject.pathCoords),
      type : "line"
    }));
  }

  // tolerance value to allow small coordinate differences
  const tolerance = 0.000001;
  let isEndSnappedToStart = false;
  
  // if there are enough points to make a round route
  if (routingStateObject.userClicks.length > 3) {
    const start = routingStateObject.userClicks[0];
    const end = routingStateObject.userClicks[routingStateObject.userClicks.length - 1];
    const dx = Math.abs(start[0] - end[0]);
    const dy = Math.abs(start[1] - end[1]);
    
    // if the distances are close enough
    if (dx < tolerance && dy < tolerance) {
      // the two are snapped together
      isEndSnappedToStart = true;
    }
  }

  // used for the presentation of the path on the map
  routingStateObject.manualRouteLayer = new ol.layer.Vector({
    source : new ol.source.Vector({
      features : features
    }),
    style : function (feature) {
      // so the function knows if the feature is a point of LineString 
      const featureType = feature.get("type");
      
      // if the algorithm detects a point
      if (featureType === "point") {

        // index of the point in the pathCoords array is retrieved
        const index = feature.get("index")

        // boolean value to check if the point is the first in the pathCoords array
        const isStart = index === 0;

        // boolean value to check if the point is the last in the pathCoords array
        const isEnd = index === routingStateObject.userClicks.length - 1;
        
        // if the end point has snapped to the start coordinate
        if (isEndSnappedToStart) {

          // if the point is the first one in the pathCoords array then change its name to Start/End
          if (isStart) {
            return createManualPointStyle("Start/End", "#8145d4");
          }

          // if the point is the last one in the pathCoords array then ommit its name so it doesn't overlap with the start point
          if (isEnd) {
            return createManualPointStyle("", "#8145d4", 0); 
          }
        }
        
        // if the points AREN'T snapped and the point is the first one in the pathCoords array
        if (isStart) {
          return createManualPointStyle("Start", "#8145d4");
        }
        
        // if the points AREN'T snapped and the point is the last one in the pathCoords array
        if (isEnd) {
          return createManualPointStyle("End", "#8145d4");
        }

        // if the points are in the middle (intermediary points)
        return createManualPointStyle("", "#000", 6.5);
      }

      // style for the lines connecting points
      return new ol.style.Style({
        stroke : new ol.style.Stroke({
          color : "#2563eb",
          width : 5
        })
      });
    }
  });


  map.addLayer(manualRouteLayer);

  let statsDiv = document.getElementById("route-stats");
  if (!statsDiv) {
    statsDiv = document.createElement("div");
    statsDiv.id = "route-stats";
    document.body.appendChild(statsDiv);
  }

  statsDiv.innerHTML = `
    <div class="stats-header">
      <span class="stats-title">Route Information</span>
    </div>
    <div class="stats-content">
      <div class="stat-row">
        <span class="stat-label">Distance:</span>
        <span class="stat-value" id="route_distance_display">${distanceDisplay}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">ETA:</span>
        <span class="stat-value" id="route_eta_display">${etaDisplay}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Elevation Change:</span>
        <span class="stat-value" id="route_elevation_change_display">N/A</span>
      </div>
    </div>
  `;
}