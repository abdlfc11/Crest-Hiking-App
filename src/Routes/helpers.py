#region IMPORTS

# Standard Library Imports 
import json
import math

# Third-Party Libraries
import gpxpy
import gpxpy.gpx

# Local Imports 
from extensions import service

#endregion

#region ROUTING HELPER FUNCTIONS

def haversine(x1, y1, x2, y2):

    # NOTE : coords need to be in lon/lat, make sure to convert coords

    R = 6371000

    phi1 = math.radians(y1)
    phi2 = math.radians(y2)

    dphi = math.radians(y2 - y1)
    dlambda = math.radians(x2 - x1)

    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

    return R * c

def normalise_route(coordinates, avg_speed_kmh=4.5):
    """
    This function converts raw route geometry into metrics e.g ETA and elevation data (if present)
    """

    converted_coords = []

    if not coordinates or len(coordinates) < 2:
        return({"success": False, "message": "Route is too small"})
    
    start_coord = coordinates[0]

    
    # this checks the first coord to check if it is in lat/lon format, if not it converts coords to lat/lon format
    if not (abs(start_coord[0]) <= 180 and abs(start_coord[1]) <= 90):
        print("DEBUG STATEMENT\nFUNCTION : normalise_route()\nDetected projection that is NOT Lat/Lon for start point. Converting to Lat/Lon")
        for coord in coordinates:
            converted_coord = service.convert_web_mercator_to_wgs84(coord[0], coord[1])
            converted_coords.append(converted_coord)

    total_distance_m = 0.0
    total_elevation_gain_m = 0.0

    has_elevation = len(coordinates[0]) == 3

    for i in range(len(coordinates) - 1):
        x1, y1 = coordinates[i][0], coordinates[i][1]
        x2, y2 = coordinates[i + 1][0], coordinates[i + 1][1]

        # distance calculation
        if not converted_coords or converted_coords == []:
            total_distance_m += haversine(x1, y1, x2, y2)
        else:
            total_distance_m += haversine(converted_coords[i][0], converted_coords[i][1], converted_coords[i + 1][0], converted_coords[i + 1][1])

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
def check_elevation(coords):
    return bool(coords) and len(coords[0]) == 3

# returns the x and y coords of a coordinate that may be 2D or 3D
def get_xy(coord):
    if len(coord) >= 2:
        return coord[0], coord[1]
    return coord

# if a coord is over 180 degrees then it is definitely not wgs84 (181 used as buffer for edge cases)
# this helper thus returns true if a coord is web mercator and false if it isn't (and thus is wgs84)
def check_web_mercator(coord):
    if coord is None:
        return False
    return abs(coord[0]) > 181 or abs(coord[1]) > 181

def parse_elevation(elevation_string: str):
    if not elevation_string:
        return None
    try:
        return float(elevation_string.replace('m', '').strip())
    except Exception:
        return None

# helper function used in creation of gpx / geojson files which converts hrs and minutes to seconds 
def parse_eta_to_seconds(eta_string: str):
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

def generate_geojson(route):

    raw_coordinates_str = route.coordinates

    
    # check to ensure that the coords are retrieved
    if not raw_coordinates_str:
        return None

    # converts the raw coords into a list
    raw_coords = json.loads(raw_coordinates_str)
    
    corrected_coords = []
    
    has_elevation = check_elevation(raw_coords)
        
    for coord in raw_coords:
        if has_elevation:
            x, y, elevation = coord
            lon, lat = service.convert_web_mercator_to_wgs84(x, y)
            corrected_coords.append([lon, lat, elevation])
        else:
            x, y = coord
            lon, lat = service.convert_web_mercator_to_wgs84(x, y)
            corrected_coords.append([x, y])

        
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

def generate_gpx(route):
    gpx = gpxpy.gpx.GPX() # initialises container
    track = gpxpy.gpx.GPXTrack(name=route.name) # creates a track (the entire route) and adds it to the container (next line)
    gpx.tracks.append(track) 
    segment = gpxpy.gpx.GPXTrackSegment() # creates a segment (one connected part of a route) and adds it to the container (next line)
    track.segments.append(segment)

    coords = json.loads(route.coordinates)

    has_elevation = check_elevation(coords)

    for coord in coords: # loops through each coord in one sub array in the coords array
        if has_elevation:
            x, y, elevation = coord
            lon, lat = service.convert_web_mercator_to_wgs84(x, y) # converts to lat and lon (needed for gpx)
            segment.points.append(gpxpy.gpx.GPXTrackPoint(
                latitude=lat,
                longitude=lon,
                elevation=elevation
            ))
        else:
            x, y = coord
            lon, lat = service.convert_web_mercator_to_wgs84(x, y)
            segment.points.append(gpxpy.gpx.GPXTrackPoint(
                latitude=lat,
                longitude=lon
            ))

    return gpx.to_xml()

def parse_kml_coord_list(coord_list) -> list:
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


def process_kml_feature(feature) -> list:
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
