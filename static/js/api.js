async function init() {
    const config = await fetch("/api/config").then(response => response.json());

    const mapInitialCenter = config.map_centre;
    const mapInitialZoom = config.zoom;

    const defaultCenter = mapInitialCenter;

    const savedPoints = config.saved_points ?? [];

    const initialSavedPointsLookup = Object.fromEntries(
        savedPoints.map(p => [p.name, p.coordinates])
    );
}

init()
