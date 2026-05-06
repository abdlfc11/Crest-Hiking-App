
// ###########
// CONSTANTS / VARIABLES
// ###########

const setStartCoordButton = document.getElementById('set-start-coord-button');
const setEndCoordButton = document.getElementById('set-end-coord-button');

const startCoordEntry = document.getElementById('start-point-entry')
const endCoordEntry = document.getElementById('end-point-entry')

let clickMode = null

// ###########
// HELPER FUNCTIONS
// ###########

function setStartCoord() {
    clickMode = "setStart"
}

function setEndCoord() {
    clickMode = "setEnd"
}

function setCoordEntry(DOMElement, event) {
    const coordinate = event.coordinate;
    const RoundedCoordinates = roundCoords(coordinate, 0);
    DOMElement.value = RoundedCoordinates;
}

// ###########
// MAIN MAP CLICK FUNCTION
// ###########

export function mapClickHandler(event) {  

    if (clickMode === "setStart") {
        setCoordEntry(startCoordEntry, event)
    }

    if (clickMode === "setEnd") {
        setCoordEntry(endCoordEntry, event)
    }

    if (currentMode !== "auto") return;

    if (selectedPoint) {
        selectedPoint.setStyle(getSavedPointStyle(selectedPoint.get("name")));
        selectedPoint = null;
    }

    let featureClicked = false;
    let newSelection = null;

    map.forEachFeatureAtPixel(event.pixel, function (feature, layer) {
        if (
        layer === savedPointsLayer &&
        feature.getGeometry() instanceof ol.geom.Point
        ) {
        newSelection = feature;
        featureClicked = true;
        return true;
        }
    });

    if (newSelection) {
        selectedPoint = newSelection;
        const pointName = selectedPoint.get("name");

        selectedPoint.setStyle(getSelectedPointStyle(pointName));
        pointDeleteModalNameDisplay.textContent = pointName;

        showPointDeleteDialog(true)

    } else if (!featureClicked) {
        const coordinate = event.coordinate;
        const [lon, lat] = ol.proj.toLonLat(coordinate)
        const roundedLatLonCoords = roundCoords([lat, lon], 6);
        const pointName = prompt(
        `Do you want to save this coordinate: ${roundedLatLonCoords[0]}, ${roundedLatLonCoords[1]}? \nEnter a name to save it:`,
        );
        if (pointName) {
        saveNewPoint(coordinate, pointName);
        }
    }
};

// ###########
// ADDING EVENT LISTENERS
// ###########

setStartCoordButton.addEventListener('click' ,setStartCoord);
setEndCoordButton.addEventListener('click', setEndCoord);

