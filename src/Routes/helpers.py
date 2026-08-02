#region IMPORTS

# Standard Library Imports 
import json
import math

# Third-Party Libraries
import gpxpy
import gpxpy.gpx

# Local Imports 
from extensions import service
from constants import MAX_X, MAX_Y, MIN_X, MIN_Y

#endregion

#region ROUTING HELPER FUNCTIONS

def isRoughlyInCumbria(x: float, y: float) -> bool:

    if (-180 <= x <= 180) and (-90 <= y <= 90):
        x, y = service.convert_wgs84_to_web_mercator(x, y)

    return x >= MIN_X and x <= MAX_X and y >= MIN_Y and y <= MAX_Y 

def haversine(x1: float, y1: float, x2: float, y2: float) -> float:

    # NOTE : coords need to be in lon/lat 

    R = 6371000

    phi1 = math.radians(y1)
    phi2 = math.radians(y2)

    dphi = math.radians(y2 - y1)
    dlambda = math.radians(x2 - x1)

    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

    return R * c

def normalise_route(coordinates: list, avg_speed_kmh: float = 4.5) -> dict:
    """Converts raw route geometry into metrics like ETA and elevation data.

    Parameters:

        - coordinates (list): A nested list of points, e.g., [[Lat, Lon, elev], ...]

        - avg_speed_kmh (float): The average speed used for ETA calculations, defaults to 4.5 (average hiking speed)

    Returns:
        dict: Information associated with the path, including ETA, elevation gain, and distance.
    """

    converted_coords = []

    if not coordinates or len(coordinates) < 2:
        return({"success": False, "message": "Route is too small"})

    total_distance_m = 0.0
    total_elevation_gain_m = 0.0

    has_elevation = len(coordinates[0]) == 3

    for i in range(len(coordinates) - 1):
        x1, y1 = coordinates[i][0], coordinates[i][1]
        x2, y2 = coordinates[i + 1][0], coordinates[i + 1][1]

        # distance calculation
        if converted_coords and converted_coords != []:
            total_distance_m += haversine(converted_coords[i][0], converted_coords[i][1], converted_coords[i + 1][0], converted_coords[i + 1][1])
        else:
            total_distance_m += haversine(x1, y1, x2, y2)

        # elevation gain (only if available)
        if has_elevation:
            e1 = coordinates[i][2]
            e2 = coordinates[i + 1][2]

            if e2 > e1:
                total_elevation_gain_m += (e2 - e1)

    distance_km = total_distance_m / 1000.0
    eta_hours = distance_km / avg_speed_kmh
    eta_seconds = round(eta_hours * 60 * 60, 2)

    return {
        "distance_m": total_distance_m,
        "distance_km": distance_km,
        "elevation_gain_m": total_elevation_gain_m,
        "eta_seconds": eta_seconds
    }

# helper function which returns true if the first coordinate has 3 values (i.e x, y and z)
def check_elevation(coords: list):
    return bool(coords) and len(coords[0]) == 3

# returns the x and y coords of a coordinate that may be 2D or 3D
def get_xy(coord: list):
    if len(coord) >= 2:
        return coord[0], coord[1]
    return coord

def check_web_mercator(coord: list) -> bool:
    """
    Returns True if the inputted coordinate is in Web Mercator and false otherwise  
    """
    if coord is None:
        return False
    return abs(coord[0]) > 181 or abs(coord[1]) > 181

def parse_elevation(elevation_string: str) -> float | None:
    """
    Converts an elevation value in string format into a float value to be used in calculations 
    """
    if not elevation_string:
        return None
    try:
        return float(elevation_string.replace('m', '').strip())
    except Exception:
        return None

def parse_eta_to_seconds(eta_string: str) -> float | None:
    """
    Converts ETA string (of hours and minutes) into a float value to be used in calculations
    """
    if not eta_string:
        return None
    try:
        hours = minutes = 0
        if 'h' in eta_string:
            hours = int(eta_string.split('h')[0].strip())
        if 'm' in eta_string:
            minutes_part = eta_string.split('h')[-1] if 'h' in eta_string else eta_string
            minutes = int(minutes_part.replace('m', '').strip())
        return hours * 3600 + minutes * 60
    except Exception:
        return None

#endregion

#region GEOSPATIAL FILE PROCESSING HELPER FUNCTIONS

def generate_geojson(route: object) -> str:
    """
    Generates a GeoJSON file content using the given route, which includes elevation
    """

    raw_coordinates_str = route.coordinates

    
    # check to ensure that the coords are retrieved
    if not raw_coordinates_str:
        return None

    # converts the raw coords into a list
    raw_coords = json.loads(raw_coordinates_str)
    
    corrected_coords = []
    
    has_elevation = check_elevation(raw_coords)

    # if the stored coords are Web Mercator (legacy), convert to lat/lon
    is_legacy_mercator = check_web_mercator(raw_coords[0]) if raw_coords else False
        
    for coord in raw_coords:

        if has_elevation:
            x, y, elevation = coord
        else:
            x, y = coord
            elevation = None

        # coords stored as lat/lon going forward; legacy mercator rows are converted on the fly
        if is_legacy_mercator:
            lon, lat = service.convert_web_mercator_to_wgs84(x, y)
        else:
            lon, lat = x, y

        if elevation is not None:
            corrected_coords.append([lon, lat, elevation])
        else:
            corrected_coords.append([lon, lat])

        
    # constructs the geojson dict
    geojson_feature = {
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": corrected_coords
        },
        "properties": {
            "route_id": route.id,
            "distance_km": route.distance_km,
            "created_at": route.created_at.isoformat()
        }
    }
    
    # returns as JSON string
    return json.dumps(geojson_feature)

def generate_gpx(route: object) -> str:
    """
    Generates a GPX file content using the given route, which includes elevation
    """

    gpx = gpxpy.gpx.GPX() # initialises container
    track = gpxpy.gpx.GPXTrack(name=route.name) # creates a track (the entire route) and adds it to the container (next line)
    gpx.tracks.append(track) 
    segment = gpxpy.gpx.GPXTrackSegment() # creates a segment (one connected part of a route) and adds it to the container (next line)
    track.segments.append(segment)

    coords = json.loads(route.coordinates)

    has_elevation = check_elevation(coords)

    # if the stored coords are Web Mercator (legacy), convert to lat/lon
    is_legacy_mercator = check_web_mercator(coords[0]) if coords else False

    for coord in coords: # loops through each coord in one sub array in the coords array

        if has_elevation:
            x, y, elevation = coord
        else:
            x, y = coord
            elevation = None

        # coords stored as lat/lon going forward; legacy mercator rows are converted on the fly
        if is_legacy_mercator:
            lon, lat = service.convert_web_mercator_to_wgs84(x, y)
        else:
            lon, lat = x, y

        if elevation is not None:
            segment.points.append(gpxpy.gpx.GPXTrackPoint(
                latitude=lat,
                longitude=lon,
                elevation=elevation
            ))
        else:
            segment.points.append(gpxpy.gpx.GPXTrackPoint(
                latitude=lat,
                longitude=lon
            ))

    return gpx.to_xml()

def parse_kml_coord_list(coord_list: list) -> list:
    """
    converts a list of KML coord tuples into the format of this app

    KML format : (lon, lat) / (lon, lat, ele)

    App format : [lat, lon] / [lat, lon, ele]
    """

    print(f"coord list: {coord_list}")

    coords = []

    for coord in coord_list:
        lon = coord[0]
        lat = coord[1]
        ele = coord[2] if len(coord) > 2 else None
        coords.append([lat, lon, ele]) if len(coord) > 2 else coords.append([lat, lon])
    
    return coords


def process_kml_feature(feature: dict) -> list:
    """
    this (recursively) processes KML features returns a list of coords extracted from any geometry found within KML features
    """

    extracted = [] 

    print(f"feature : {feature}")

    # if the feature has geometry
    if hasattr(feature, "geometry") and feature.geometry:
        geom = feature.geometry

        print(geom)
        

        # this handles LineStrings
        if geom.__class__.__name__ == "LineString":
            extracted.extend(parse_kml_coord_list(geom.coords))
            print(geom.coords)
        
        # this handles MultiLineStrings
        if geom.__class__.__name__ == "MultiLineString":
            for line in geom.geoms:
                extracted.extend(parse_kml_coord_list(line.coords))
    
    # if the feature contains nested features
    if hasattr(feature, "features"):
        for sub_feature in feature.features():
            extracted.extend(process_kml_feature(sub_feature))
    
    return extracted

def extract_kml_coords(doc) -> list:
    """
    this parses a KML file as text and extracts all coordinates from LineString and MultiLineString geometries

    returns a coords list of [lat, lon, ele] points
    """    


    print(doc)
    print(doc.features)
    print(list(doc.features))

    coords = []

    # kml features can include documents, folders, or placemarks
    for feature in doc.features:
        print(feature)
        coords.extend(process_kml_feature(feature))
    
    return coords


#endregion