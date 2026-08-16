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

def naismith_helper(horizontal_distance_metres: float, elevation_difference_metres: float, slope_ratio: float) -> dict:
    """
    PURPOSE : this is a function used to calculate the weight of an edge using Naismith's rule

    PARAMS : takes euclidean distance, elevation difference and slope ratio as parameters
        - euclidean distance + elevation difference --> used in naismith formula
        - slope ratio --> used to determine which avg speed (in mph) to use

    RETURN VALUE : dictionary of ascent and descent value (assinged to edges depending on if the edge is going up or down)
    """

    # group of logic conditions to set walking speed based on elevation gain (in the form of the slope ratio)
    # absoloute val used as it doesn't matter if the value is negative or positive --> reduces number of conditions and likelihood of errors
    abs_slope = abs(slope_ratio) 

    if abs_slope < 0.09: # flat / gentle grade (Under 5°)
        avg_walking_speed_metres = 1.4  
    elif abs_slope < 0.21: # moderate grade (5° - 12°)
        avg_walking_speed_metres = 1.1  
    elif abs_slope < 0.46: # steep mountain grade (12° - 25°)
        avg_walking_speed_metres = 0.8  
    else: # extreme / scramble grade (+ 25°)
        avg_walking_speed_metres = 0.5  

    # distance calculations
    ascent_metres = max(0, elevation_difference_metres) # max is used to ensure there is only a positive value, rather than a negative value for the ASCENT
    descent_metres = abs(min(0, elevation_difference_metres)) # min is used to ensure there is only a negative, or zero, value for the DESCENT

    # ETA calculations
    flat_time = horizontal_distance_metres / avg_walking_speed_metres # this is the time taken to walk the distance if it was a straight line
    climb_time = (ascent_metres / 10) * 60 # this is the time taken to walk UP the slope caused by the difference in elevation
    descent_time = (descent_metres / 7.5) * 60 # this is the time taken to walk DOWN the slope caused by the difference in elevation
    return { # dict is used to reference the helper function more effectively
        "ascent" : flat_time + climb_time,
        "descent" : flat_time + descent_time
    }


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

        - coordinates (list): A nested list of points, e.g., [[Lon, Lat, elev], ...]

        - avg_speed_kmh (float): The average speed used for ETA calculations, defaults to 4.5 (average hiking speed)

    Returns:
        dict: Information associated with the path, including ETA, elevation gain, and distance.
    """

    converted_coords = []

    if not coordinates:
        return({"success": False, "message": "No coordinates passed in."})
    
    if len(coordinates) < 2:
        return {
            "distance_m": 0.0,
            "distance_km": 0.0,
            "elevation_gain_m": 0,
            "eta_seconds": 0
        }

    total_distance_m = 0.0
    total_elevation_gain_m = 0.0
    total_seconds = 0.0

    for i in range(len(coordinates) - 1):

        has_elevation = len(coordinates[i]) == 3 and len(coordinates[i+1]) == 3

        lon1, lat1 = coordinates[i][0], coordinates[i][1]
        lon2, lat2 = coordinates[i + 1][0], coordinates[i + 1][1]

        segment_distance = haversine(lon1, lat1, lon2, lat2)

        total_distance_m += segment_distance

        # elevation gain (only if available)
        if has_elevation:
            e1 = coordinates[i][2]
            e2 = coordinates[i + 1][2]

            if e1 is not None and e2 is not None:
                elevation_difference = e2 - e1

                slope_ratio = elevation_difference / segment_distance if segment_distance > 0 else 0.0 

                segment_eta = naismith_helper(
                    horizontal_distance_metres=segment_distance,
                    elevation_difference_metres=elevation_difference,
                    slope_ratio=slope_ratio
                )

                if elevation_difference > 0:
                    total_seconds += segment_eta['ascent']
                    total_elevation_gain_m += elevation_difference
                else:
                    total_seconds += segment_eta['descent']
                    

    distance_km = total_distance_m / 1000.0
    if not has_elevation:
        eta_hours = distance_km / avg_speed_kmh
        final_seconds = round(eta_hours * 3600, 2)
    else:
        final_seconds = round(total_seconds, 2)

    return {
        "distance_m": total_distance_m,
        "distance_km": distance_km,
        "elevation_gain_m": total_elevation_gain_m,
        "eta_seconds": final_seconds
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