// Shared route path / mode state for save, load, and map display. 

let currentPathData = null;
let loadedRouteCoordinates = null;
let currentMode = "auto";
let lastKnownDistanceKm = null;
let lastAutoRouteStats = null;
let lastLoadedRouteStats = null;

export const cumbriaBoundary = [[-2.676437512253789,55.17303211992565],[-2.703435556064023,55.173204585049575],[-2.812732609129586,55.13618096254551],[-2.871323494177803,55.10027642234522],[-2.896876480211215,55.07794483345954],[-2.937634075043214,55.07038660573058],[-2.958641952088684,55.04927798202847],[-3.021194787473005,55.05488475273268],[-3.049494339066073,55.00937750479223],[-3.045122265160668,54.99807219506249],[-3.07568093885911,54.967591530489635],[-3.103239632102877,54.97149645376425],[-3.131442315911948,54.9472155512728],[-3.137961350085464,54.92745641349978],[-3.185998432500452,54.94992806070925],[-3.211460975032582,54.95447055095435],[-3.285426927942487,54.94141668542915],[-3.313474162720334,54.918887327569855],[-3.280141763497257,54.90301428578929],[-3.311518476719928,54.88826065831703],[-3.349129818443099,54.89808958246414],[-3.399841657595402,54.86745795781753],[-3.41031115159707,54.83972874002788],[-3.438343991887265,54.79972234756579],[-3.435752501090701,54.760670325074024],[-3.510577397372789,54.71058929272164],[-3.526139785245876,54.685820251977354],[-3.575890615419519,54.64662663798311],[-3.570604588819481,54.603187954383074],[-3.580390615316288,54.57189593343623],[-3.61360636489758,54.52502547752097],[-3.638894919175695,54.5173726395865],[-3.619573584513901,54.490896243137385],[-3.592986408161096,54.48210695422993],[-3.563196336681655,54.45163108220539],[-3.492610451939712,54.4011925345011],[-3.461057116642764,54.364695313158464],[-3.430645319721884,54.34199283021604],[-3.417359050425175,54.31364949877024],[-3.421403517093221,54.284393321522536],[-3.322393280328773,54.19052528088748],[-3.240106825242387,54.20326220995209],[-3.254345679387558,54.21953137840905],[-3.233122818438903,54.22876359179939],[-3.212306027952584,54.20851646429298],[-3.217153400432179,54.17745538262028],[-3.237698167006797,54.15591189110666],[-3.24472464083487,54.11679064639535],[-3.227191695647964,54.094415866841686],[-3.194109886021833,54.104260933262154],[-3.172402794163839,54.0817749634583],[-3.131352021419719,54.10234001833571],[-3.06085643907219,54.16198898615388],[-3.053135781302188,54.19887908503633],[-3.011859467288911,54.1793833659134],[-3.005293798414952,54.15625965594931],[-2.968382363985691,54.14601591800645],[-2.943498695889875,54.1555222118723],[-2.907610482009655,54.19311885961694],[-2.862300195700672,54.188347678349224],[-2.837217661199997,54.17416235475967],[-2.799230430180163,54.197721890513336],[-2.736489886204351,54.16901642157738],[-2.679876544008729,54.161123981426734],[-2.670499575618695,54.176572301767585],[-2.624956518480819,54.19555816341066],[-2.550749082826831,54.200282008818526],[-2.520067041955534,54.21643585381617],[-2.460859461635243,54.22670511986853],[-2.403625555591272,54.22557228673294],[-2.396775917705597,54.23936996554438],[-2.348048772126217,54.237795052002184],[-2.322653217753612,54.24544835537394],[-2.323028439125271,54.31107155616121],[-2.309837400103302,54.32430392650438],[-2.359669958604477,54.35025630574292],[-2.317038060453376,54.37630023393069],[-2.307975355863948,54.42067772517404],[-2.267898089112992,54.44722394046882],[-2.189310015303459,54.448968893460304],[-2.158991152161441,54.47202017975469],[-2.172392239659978,54.53243515514935],[-2.197524834152717,54.53269503822849],[-2.209482619762749,54.55170457303469],[-2.245956714270858,54.56505410350389],[-2.304509127106089,54.59618953813223],[-2.324932238049341,54.631642251667984],[-2.287972876984938,54.650472274505304],[-2.292869050671266,54.66387769517325],[-2.327563629763393,54.67086581519176],[-2.353459166394436,54.69793275916364],[-2.309897754837555,54.7718993661433],[-2.314804112565652,54.792568329258636],[-2.392719964122322,54.83450839436589],[-2.401616108352738,54.85147716911449],[-2.495578506589636,54.81023582140116],[-2.529193140503162,54.806131676379415],[-2.567843102729398,54.82356792556386],[-2.573346645033541,54.853539140148804],[-2.605272891943608,54.88393113226483],[-2.576407978821967,54.89671012917167],[-2.566214796886457,54.91923136931568],[-2.568419356148727,54.958284934676755],[-2.601422668235903,54.971334298521334],[-2.575777760137306,54.98491729636879],[-2.574804469721143,55.011167319029],[-2.539565502218004,55.0288717290026],[-2.48304290005877,55.04001406763759],[-2.502013879776389,55.057720960794136],[-2.500622130533391,55.090186490621804],[-2.552646913454723,55.08125204076589],[-2.592081236825463,55.10423844986231],[-2.606147349911998,55.126143079178924],[-2.656933749178559,55.13612852273704] ,[-2.676437512253789,55.17303211992565]]

export const manualRouteState = {
  userClicks: [],
  pathCoords: [],
  manualRoutePoints: [],
  initialElevation: 0,
  isSnapped: false,
  segmentCache: {},
  redoStack: []
};

export function getLastAutoRouteStats() {
  return lastAutoRouteStats;
}

export function setLastAutoRouteStats(value) {
  lastAutoRouteStats = value;
}

export function clearLastAutoRouteStats() {
  lastAutoRouteStats = null;
}

export function getLastLoadedRouteStats() {
  return lastLoadedRouteStats;
}

export function setLastLoadedRouteStats(value) {
  lastLoadedRouteStats = value;
}

export function clearLastLoadedRouteStats() {
  lastLoadedRouteStats = null;
}


export function getCurrentMode() {
  return currentMode;
}

export function setCurrentMode(mode) {
  currentMode = mode;
}
 
// may now receive coordinates where each coord is made of 3 elements, x, y and elevation
export function getCurrentPathData() {
  return currentPathData;
}

export function setCurrentPathData(data) {
  currentPathData = data;
}

export function getLoadedRouteCoordinates() {
  return loadedRouteCoordinates;
}

// may now receive coordinates where each coord is made of 3 elements, x, y and elevation
export function setLoadedRouteCoordinates(coords) {
  loadedRouteCoordinates = coords;
}

export function setLastKnownDistanceKm(value) {
  lastKnownDistanceKm = value;
}

export function getLastKnownDistanceKm () {
  return lastKnownDistanceKm;
}

export function clearPathState() {
  currentPathData = null;
  loadedRouteCoordinates = null;
}

export function clearManualRouteState() {
  manualRouteState.userClicks = [];
  manualRouteState.pathCoords = [];
  manualRouteState.manualRoutePoints = [];
  manualRouteState.initialElevation = 0;
  manualRouteState.isSnapped = false;
}

export function hasActiveRouteStatsPanel() {
  return manualRouteState.pathCoords.length > 0 || lastAutoRouteStats !== null || lastLoadedRouteStats !== null; 
};

/**
 * Function to determine whether or not each coordinate of a path contains elevation 
 * @param {Array} coords 
 * @returns boolean value
 */
export function hasElevation(coords) {
  return coords.every(coord => coord.length === 3)
}

/**
 * Function to retrieve elevation of each coordinate in the path
 * @param {Array} coords 
 * @returns The elevation for each coordinate in the set of coordinates passed in, in the form of an array
 */
export function extractElevation(coords) {
  return coords.filter(coord => coord.length === 3).map(coord => coord[2])
}

/**
 * 
 * @param {Array} coords 
 * @returns An object formed of index : elevation pairs in the form { }
 */
export function extractElevationProfile(coords) {
  return coords.filter(coord => coord.length === 3).map((coord, index) => ({
    index: index,
    elevation: coord[2]
  }));
};

/**
 * 
 * @param {Array} coords 
 * @returns The range of elevation of a path in the form { min: min_elevation, max: max_elevation }
 */
export function getElevationRange(coords) {
  if (!coords || coords.length === 0) return { min: null, max: null };

  // this extracts the elevation values of each coordinate
  const elevations = coords
    .filter(coord => coord && coord.length === 3)
    .map(coord => coord[2]);

  // this returns null values if no elevation data is present
  if (elevations.length === 0) return { min: null, max: null };

  // this uses the spread operator to find min and max values instantly
  return {
    min: Math.min(...elevations),
    max: Math.max(...elevations)
  };
}

/**
 * @param {Array} coords - Array of [long, lat, elev] arrays
 * @returns {number} The total elevation gain 
*/
export function calculateElevationGain(coords) {
  if (!coords || coords.length < 2) return 0;

  let totalGain = 0;

  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];

    if (prev.length === 3 && curr.length === 3) {
      const elevationDifference = curr[2] - prev[2];
      // Only add positive differences (uphill)
      totalGain += Math.max(0, elevationDifference);
    }
  }

  return totalGain;
}

/**
 * Checks if a point is inside a polygon using the Ray-Casting algorithm.
 * @param {Array<number>} point - [longitude, latitude] of the user's tap
 * @param {Array<Array<number>>} polygon - Array of [lng, lat] coordinates representing Cumbria
 * @returns {boolean} True if the point is inside the polygon
 */
export function isPointInPolygon(point, polygon = cumbriaBoundary) {
    const x = point[0]; // longitude
    const y = point[1]; // latitude
    
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0], yi = polygon[i][1];
        const xj = polygon[j][0], yj = polygon[j][1];
        
        const intersect = ((yi > y) !== (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    
    return inside;
}

/**
 * Ensures every coordinate is [x, y, elevation]
 * - First point gets elevation from second point if it's 0
 * - Forces numbers and consistent 3-element arrays
 */
export function normaliseCoordLength(coords) {
  if (!coords || coords.length === 0) return [];

  let normalisedCoords = coords.map(coord => {
    if (Array.isArray(coord) && coord.length >= 3) {
      return [Number(coord[0]), Number(coord[1]), Number(coord[2]) || 0];
    } else if (Array.isArray(coord) && coord.length === 2) {
      return [Number(coord[0]), Number(coord[1]), 0];
    } else {
      console.warn("Invalid coord:", coord);
      return [0, 0, 0];
    }
  });

  // this forces first point to use second point's elevation if first is 0
  if (normalisedCoords.length >= 2) {
    const firstElev = normalisedCoords[0][2];
    const secondElev = normalisedCoords[1][2];

    if (firstElev === 0 && secondElev !== 0) { // check if the first coord element doesn't have elevation AND that there is second Elevation
      normalisedCoords[0][2] = secondElev;
    }
  }

  return normalisedCoords;
}