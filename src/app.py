# IMPORTS 
from src.pathfinder import a_star, snap_to_largest_component, build_global_kdtree

from flask import Flask, render_template, request, jsonify, session, send_file

import sys
import os

sys.path.insert(0, "/app/src")

# SQLModel + DB
from sqlmodel import Session, select, delete
from db import engine

from src.models import User, Route, Point, Settings

import pickle as pkl
import time
from pyproj import Transformer
import json
import math
from datetime import datetime, timezone
from scipy.spatial import KDTree
from werkzeug.security import generate_password_hash, check_password_hash
import requests 
from src.config import Config
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import networkx as nx
from datetime import timedelta
import gpxpy
import gpxpy.gpx
import io
import re


# default map centre (BNG coordinates)
default_centre = [333543, 505910]

app = Flask(__name__,
            template_folder='../templates',
            static_folder='../static')

if os.environ.get("FLASK_ENV") == "development":
    app.debug = True

app.config["TEMPLATES_AUTO_RELOAD"] = True

app.permanent_session_lifetime = timedelta(minutes=30)


# SQL_ALCHEMY SET UP

# secret key for sessions
app.secret_key = Config.SECRET_KEY 
locationiq_api_key = Config.LOCATIONIQ_API_KEY

# binds for multiple databases
app.config["SQLALCHEMY_DATABASE_URI"] = Config.DATABASE_URI


# Session security settings for production
app.config.update(
    SESSION_COOKIE_SECURE=False,      # CHANGE TO TRUE BEFORE PRODUCTION SO IT IS HTTPS AND NOT HTTP
    SESSION_COOKIE_HTTPONLY=True,    # prevents JavaScript access
    SESSION_COOKIE_SAMESITE='Lax',  # provides CSRF protection
    PERMANENT_SESSION_LIFETIME=3600  # so that sessions expire after 1 hour
)

limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "500 per hour"],
    storage_uri="memory://",
)


# useful helper for getting the current user during route and point creation as well as logging in and out 
def get_current_user():
    username = session.get("username")
    print(username)
    if not username:
        print("no username detected")
        return None
    with Session(engine) as db:
        return db.exec(select(User).where(User.username == username)).first()

# STRFTIME FILTER
@app.template_filter("strftime")
def strftime_filter(date, format: str):
    if isinstance(date, str):
        date = datetime.isoformat(date)
    return date.strftime(format)

@app.errorhandler(404)
def page_not_found(error):
    return render_template('Error-Pages/404.html')

@app.errorhandler(500)
def page_not_found(error):
    return render_template('Error-Pages/500.html')

# region AUTH FLASK ROUTES

#region LOGGING IN AND OUT

@app.route("/login", methods=["POST"])
@limiter.limit("10 per minute")
def login():

    data = request.get_json()
    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"success": False, "message": "Username and Password are required"})

    with Session(engine) as db:
        user = db.exec(
            select(User).where(User.username == username)
        ).first()

    if user and check_password_hash(user.password_hashed, password):
        session["username"] = username
        session["preferred_name"] = user.preferred_name if user.preferred_name else user.username
        print(session["username"])
        print(session["preferred_name"])
        session.permanent = True  # Make session respect PERMANENT_SESSION_LIFETIME
        return jsonify({"success": True, "message": "Successfully logged in"})
    if user is None or not check_password_hash(user.password_hashed, password):
        return jsonify({"success": False, "message": "Username and/or Password are incorrect"})

@app.route("/logout", methods=["POST"])
@limiter.limit("10 per minute")
def logout():
    username = session.get("username", "user")
    session.pop('username', None)
    return jsonify({"success": True, "message": f"Sucessfully logged out of {username}"})

#endregion
    
# region REGISTERING 
@app.route("/registering", methods=["POST"])
@limiter.limit("10 per minute")
def registering():
    data = request.get_json()
    username = data.get("username", "").strip()
    p1 = data.get("password1", "")
    p2 = data.get("password2", "")
    preferred_name = data.get("preferred_name").strip()

    if not username or len(username) <= 7:
        return jsonify({"success": False, "message": "Username must have at least 8 characters"})
    
    if p1 != p2:
        return jsonify({"success": False, "message": "The passwords must match each other"})
    
    if len(p1) <= 11:
        return jsonify({"success": False, "message": "Passwords must have at least 12 characters"})
    
    has_digit = any(char.isdigit() for char in p1)
    if not has_digit:
        return jsonify({"success" : False, "message" : "Passwords must have at least one numerical digit"})

    special_characters = ["@", "#", "$", "%", "^", "&", "*", "(", ")", "_", "+", "-", "=", "[", "]", "{", "}", "|", ";", ":", ",", ".", "<", ">", "?", "/"]
    
    if not any(character in p1 for character in special_characters):
        return jsonify({"success": False, "message": "Passwords must have at least one special character"})

    with Session(engine) as db:
        existing_user = db.exec(
            select(User).where(User.username == username)
        ).first()

    
        if existing_user:
            return jsonify({"success": False, "message": "Someone has already chosen this username"})
        
        try:
            new_user = User(
                username = username,
                preferred_name = preferred_name,
                password_hashed = generate_password_hash(p1)
            )

            db.add(new_user)
            db.commit()
            return jsonify({"success": True, "message": "Successfully registered"})
        
        except Exception as error:
            db.rollback()
            print("Registration error: ", error)
            return jsonify({"success": False, "message": "There was an unexpected error with our database"})

#endregion

@app.route('/beta-page', methods=["GET"])
def get_beta_page():
    return render_template("beta-code.html")

# region DELETING ACCOUNT
@app.route("/delete_account", methods=["POST"])
@limiter.limit("10 per minute")
def delete_account():
    username = session.get('username')

    with Session(engine) as db:

       
        user = get_current_user()

        if user:
            try:
                
                db.delete(user)

                db.exec(
                    delete(Route)
                    .where(Route.user_id == user.id)
                )
                db.exec(
                    delete(Point)
                    .where(Point.user_id == user.id)
                )
                
                db.commit()
                session.pop('username', None)
                return jsonify({"success": True, "message": "Successfully deleted your account"})
            except Exception as e:
                db.rollback()
                print("ERROR:", e)
                return jsonify({"success": False, "message": "Could not delete your account, try again later. "})
    return jsonify({"success": False, "message": "Could not delete your account, try again later. "})

#endregion

#endregion

#region SETTING ROUTES

@app.route("/get_settings", methods=["GET"])
def get_settings():
    user = get_current_user()
    if not user:
        return jsonify({"success": False, "message": "Error: no user found"}), 401

    try:
        with Session(engine) as db:

            # all setting records are queried
            existing_records = db.exec(
                select(Settings)
                .where(Settings.user_id == user.id)
            ).all()

            # makes key value pairs in the structure (setting: user_choice)
            settings_payload = {record.key: record.value for record in existing_records}
            
            # returns data in a valid format
            return jsonify({
                "success": True, 
                "settings_dict": settings_payload
            }), 200

    except Exception as error:
        print("ERROR WHILE RETRIEVING SETTINGS: ", error)
        return jsonify({"success": False, "message": "There was an error whilst retrieving settings"}), 500

@app.route("/save_settings", methods=["POST"]) 
def save_settings():
    data = request.get_json()
    settings = data.get("settings_dict") or {} 
    user = get_current_user()

    if not user:
        return jsonify({"success": False, "message": "Error: no user found"}), 401

    try:
        
        with Session(engine) as db:
            
            # get existing records (if any)
            existing_records = db.exec(
                select(Settings)
                .where(Settings.user_id == user.id)
            ).all()

            # this creates a dictionary of settings based on the exisiting records retrieved
            settings_dictionary = {record.key: record for record in existing_records}

            # tracker used to check if the db changed so that it can be determined whether to take any action or not
            db_changed = False 

            # this for loop goes through each setting in local storage and checks if it is the same in the db records
            # it then sets the db_changed tracker value to true if there is change detected
            # it also adds any new settings detected
            for key, new_value in settings.items():
                if key in settings_dictionary:
                    record = settings_dictionary[key]
                    if record.value != new_value:
                        record.value = new_value
                        db_changed = True
                else:
                    new_record = Settings(user_id=user.id, key=key, value=new_value)
                    db.add(new_record)
                    db_changed = True 
            
            # the db's changes are committed if any changes have been detected
            if db_changed:
                db.commit()
            
            return jsonify({"success": True, "message": "Successfully saved settings"}), 200

    except Exception as error:
        db.rollback()
        print("ERROR WHILE SAVING SETTINGS: ", error)
        return jsonify({"success": False, "message": "There was an error whilst saving settings"}), 500
#endregion


# ROUTE CREATION  

class NodeFinder:
    def __init__(self, graph_path=None, max_distance=5000, early_exit_distance=100):
        if graph_path is None:
            graph_path = Config.GRAPH_PATH
        self.graph_path = graph_path
        self._graph = None
        self._kdtree = None
        self.max_distance = max_distance
        self.early_exit_distance = early_exit_distance
        self._bng_to_web_mercator = Transformer.from_crs("EPSG:27700", "EPSG:3857", always_xy=True)
        self._bng_to_wgs84 = Transformer.from_crs("EPSG:27700", "EPSG:4326", always_xy=True)
        self._wgs84_to_web_mercator = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
        self._web_mercator_to_wgs84 = Transformer.from_crs("EPSG:3857", "EPSG:4326", always_xy=True)

    def load_graph(self):
        # loads the graph only when needed (lazy loading)
        if self._graph is None:
            if not os.path.exists(self.graph_path):
                raise FileNotFoundError(
                    f"\n\n=== GRAPH FILE MISSING ===\n"
                    f"Expected graph at: {os.path.abspath(self.graph_path)}\n\n"
                    "This is the #1 cause of 'error when generating a route' in Docker.\n\n"
                    "Common fixes:\n"
                    "  1. On your HOST machine (not inside container):\n"
                    "       git lfs install && git lfs pull\n\n"
                    "  2. Then restart Docker cleanly:\n"
                    "       docker-compose down -v\n"
                    "       docker-compose up --build -d\n\n"
                    "  3. If the file still doesn't appear inside the container,\n"
                    "     go to Docker Desktop → Settings → Resources → File sharing\n"
                    "     and make sure the project folder is listed, then Apply & Restart.\n\n"
                )

            with open(self.graph_path, "rb") as file:
                self._graph = pkl.load(file)

            # snaps to largest component upon startup
            largest_cc_nodes = max(nx.weakly_connected_components(self._graph), key=len)

            # graph is copied into memory 
            self._graph = self._graph.subgraph(largest_cc_nodes).copy()

            nodes_coords = list(self._graph.nodes())

            self._nodes_list = nodes_coords
            self._kdtree = KDTree(nodes_coords)

            build_global_kdtree(self._graph)

            print(f"Graph initialised with {len(self._nodes_list)} reachable nodes.")

            # Verify elevation data is present (the usual cause of late failures)
            if self._nodes_list:
                sample_node = self._graph.nodes[self._nodes_list[0]]
                if 'elev' not in sample_node:
                    print("WARNING: Graph loaded successfully but nodes have no 'elev' attribute.")
                    print("         Elevation stats will be broken. Rebuild the graph with elevation_upgrade.py if needed.")
        
        return self._graph

    def convert_bng_to_web_mercator(self, bng_x, bng_y):
        x, y = self._bng_to_web_mercator.transform(bng_x, bng_y)
        return x, y

    def convert_web_mercator_to_bng(self, x, y):
        bng_x, bng_y = self._bng_to_web_mercator.transform(x, y, direction="INVERSE")
        return bng_x, bng_y

    def convert_bng_to_wgs84(self, bng_x, bng_y):
        wgs84_lon, wgs84_lat = self._bng_to_wgs84.transform(bng_x, bng_y)
        return wgs84_lon, wgs84_lat

    def convert_wgs84_to_bng(self, wgs84_lon, wgs84_lat):
        bng_x, bng_y = self._bng_to_wgs84.transform(wgs84_lon, wgs84_lat, direction="INVERSE")
        return bng_x, bng_y
    
    def convert_wgs84_to_web_mercator(self, wgs84_lon, wgs84_lat):
        x, y = self._wgs84_to_web_mercator.transform(wgs84_lon, wgs84_lat)
        return x, y
    
    def convert_web_mercator_to_wgs84(self, x: float, y: float):
        lon, lat = self._web_mercator_to_wgs84.transform(x, y)
        return lon, lat  


    def euclidean_distance(self, node, target_lat, target_lon):
        # calculates distance between the target and current node using pythagoras
        return ((node[0] - target_lat) ** 2 + (node[1] - target_lon) ** 2) ** 0.5
    
    
    def find_nearest_node(self, target_lat, target_lon):
        
        self.load_graph()

        target_point = (target_lat, target_lon)

        distance, index = self._kdtree.query(target_point)

        if distance > self.max_distance:
            return None  # since nearest node is too far away
        
        nearest_node = self._nodes_list[index]

        return nearest_node

    def build_route(self, s_e, s_n, e_e, e_n):
        start_time = time.time()

        # this loads the full graph
        full_graph = self.load_graph()

        # a star algorithm is called, which both clips the graph, and then calculates the path
        path, start_node, end_node = a_star(full_graph, (s_e, s_n), (e_e, e_n))

        if not path:
            print("Pathfinding failed")
            return None, None, None

        end_time = time.time()
        print(f"The route took {end_time - start_time:.3f} seconds to build.")
        
        return path, start_node, end_node

    def calculate_route_distance(self, path):
        # calculates total distance of the route in metres
        total_distance_metres = 0
        if len(path) > 1:
            for i in range(1, len(path)):
                if len(path[i]) == 2 and len(path[i-1]) == 2:
                    # 2d coordinates (x, y)
                    x1, y1 = path[i-1]
                    x2, y2 = path[i]
                else:
                    # skips if coordinate dimensions don't match
                    continue
                
                segment_distance = ((x2 - x1)**2 + (y2 - y1)**2)**0.5
                total_distance_metres += segment_distance
        return total_distance_metres

    def calculate_eta(self, path, graph):
        total_seconds = sum(
            graph[start_coordinate][end_coordinate]['cost'] for start_coordinate, end_coordinate in zip(path, path[1:])
        )

        eta_minutes = int(total_seconds / 60)
        eta_hours_int = eta_minutes // 60
        eta_minutes_remainder = eta_minutes % 60

        if eta_hours_int > 0:
            return f"{eta_hours_int}h {eta_minutes_remainder}m"
        else:
            return f"{eta_minutes_remainder}m"



    def calculate_map_center_and_zoom(self, web_mercator_coordinates):
        # calculates optimal map centre and zoom level to fit the route
        if len(web_mercator_coordinates) > 1:
            # gets min/max coordinates
            x_coords = [coord[0] for coord in web_mercator_coordinates]
            y_coords = [coord[1] for coord in web_mercator_coordinates]
            
            min_x, max_x = min(x_coords), max(x_coords)
            min_y, max_y = min(y_coords), max(y_coords)
            
            # calculates centre point
            center_x = (min_x + max_x) / 2
            center_y = (min_y + max_y) / 2
            
            # calculates bounding box dimensions
            width = max_x - min_x
            height = max_y - min_y
            
            # adds padding for better visibility
            padding_factor = 1.4
            padded_width = width * padding_factor
            padded_height = height * padding_factor
            
            # calculates zoom level based on route size
            max_dimension = max(padded_width, padded_height)
            
            if max_dimension < 1000:  # very small paths
                zoom_level = 14
            elif max_dimension < 5000:  # small paths
                zoom_level = 12
            elif max_dimension < 20000:  # medium paths
                zoom_level = 10
            elif max_dimension < 50000:  # large paths
                zoom_level = 8
            else:  # very large paths
                zoom_level = 6
            
            # creates map centre and zoom info
            map_center = [center_x, center_y]
            map_zoom = zoom_level
        else:
            # fallback to midpoint if only one coordinate
            midpoint = web_mercator_coordinates[len(web_mercator_coordinates)//2] if web_mercator_coordinates else [0, 0]
            map_center = midpoint
            map_zoom = 10
        
        return map_center, map_zoom

service = NodeFinder(graph_path=Config.GRAPH_PATH)
if os.getenv("LOAD_GRAPH_ON_IMPORT", "1").lower() not in ("0", "false", "no"):
    service.load_graph()

# Create once at module level
transformer = Transformer.from_crs("EPSG:3857", "EPSG:4326", always_xy=True)

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
    except:
        return None

# helper function used in creation of gpx / geojson files which converts hrs and minutes to 
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
    except:
        return None

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

# route which forms a path from the set of points the back-end receives as coordinates and returns it to the front-end
@app.route("/calculate_path", methods=["POST"])
@limiter.limit("4 per second")
def calculate_path():
    try:
        data = request.get_json()
        print(data)
        # extracts and parses start point coordinates
        start_coords = data.get("start_point", "")
        end_coords = data.get("end_point", "")

        graph = service.load_graph()

        print(start_coords, end_coords)

        if not start_coords or not end_coords:
            raise ValueError("Start and end coordinates are required")

        if len(start_coords) < 2 or len(end_coords) < 2:
            raise ValueError("Coordinates must be in format 'x, y'")

        # forms variables containing each value of the start and end coordinates with suffixes removed so that they can be used in input validaton
        start_coords_x, start_coords_y = get_xy(start_coords)
        

        # debug statement to ensure that start_coords_x and y are in the required format 
        print(start_coords_x, start_coords_y)

        end_coords_x, end_coords_y = get_xy(end_coords)

        all_coords = [start_coords_x, start_coords_y, end_coords_x, end_coords_y]
        if not all(isinstance(num, (int, float)) for num in all_coords):
            raise ValueError("Coordinates must be valid numbers")
        
        s_e, s_n = start_coords_x, start_coords_y # start_easting, start_northing
        e_e, e_n = end_coords_x, end_coords_y # start_easting, start_northing
        
        # conversion calculations
        if abs(s_e) > 1000000 or abs(s_n) > 1000000: # values that are likely to be web mercator
            s_e, s_n = service.convert_web_mercator_to_bng(s_e, s_n) # converts web mercator coords into BNG
        if abs(e_e) > 1000000 or abs(e_n) > 1000000: # sam process as 
            e_e, e_n = service.convert_web_mercator_to_bng(e_e, e_n)
        
    except (KeyError, ValueError) as e:
        # handles parsing errors gracefully
        web_mercator_center = service.convert_bng_to_web_mercator(default_centre[0], default_centre[1])
        user = get_current_user()
        if user:
            available_routes = Route.query.filter_by(user_id=user.id).all() if user else []
        return jsonify({"map_centre": web_mercator_center, 
                        "available_routes": available_routes, 
                        "error": f"Invalid coordinates: {str(e)}"})

    path, start_node, end_node = service.build_route(s_e, s_n, e_e, e_n)

    if not path:  # returns to map if no path found
        web_mercator_center = service.convert_bng_to_web_mercator(default_centre[0], default_centre[1])
        user = get_current_user()
        if user:
            available_routes = Route.query.filter_by(user_id=user.id).all() if user else []
        return jsonify({"map_centre": web_mercator_center,
                        "available_routes": available_routes})

    web_mercator_coordinates = [] # array used to hold coords which will be displayed on the map
    
    for node in path:  # converts path coordinates from bng to web mercator for display

        x, y = node  

        web_x, web_y = service.convert_bng_to_web_mercator(x, y)

        elev = graph.nodes.get(node, {}).get('elev')
        if elev is not None:
            web_mercator_coordinates.append([web_x, web_y, elev])
        else:
            web_mercator_coordinates.append([web_x, web_y]) # appends coords converted into web mercator into array
    
    start_coords = web_mercator_coordinates[0]
    end_coords = web_mercator_coordinates[-1]
    
    # calculates distance and eta statistics
    total_distance = service.calculate_route_distance(path)
    
    # converts distance from bng metres to kilometres
    total_distance_km = total_distance / 1000
    
    # calculates eta
    eta_display = service.calculate_eta(path, graph)

    path_geojson = {
        "type": "Feature",
        "geometry": {"type": "LineString", "coordinates": web_mercator_coordinates},
        "properties": {"color": "#2563eb"}
    } # geojson to display the path 
    
    # calculates optimal map centre and zoom
    map_centre, map_zoom = service.calculate_map_center_and_zoom(web_mercator_coordinates)

    start_elevation = int(graph.nodes[start_node]['elev'])
    end_elevation = int(graph.nodes[end_node]['elev'])

    elevation_difference = end_elevation - start_elevation
    elevation_change = f"+{elevation_difference}m" if elevation_difference >= 0 else f"{elevation_difference}m" # takes into account positive or negative change for clarity

    # route statistics to pass to template
    route_stats = {
        "start_elevation": start_elevation,
        "end_elevation": end_elevation,
        "elevation_change": elevation_change,
        "total_distance": round(total_distance_km, 2),
        "eta": eta_display
    }

    user = get_current_user()
    if user:
        with Session(engine) as db:
            available_routes = db.exec(
                select(Route)
                .where(Route.user_id == user.id)
            ).all()
    return jsonify({"success": True,
                     "pathGeoJSON": path_geojson,
                     "map_centre": map_centre,
                     "map_zoom": map_zoom,
                     "route_stats": route_stats,
                     "coordinates": web_mercator_coordinates,
                     "startCoord": start_coords,
                     "endCoord": end_coords})

# route which saves a user-chosen point on the map
@app.route("/save_point", methods=["POST"])
@limiter.limit("10 per minute")
def save_point():
    # data received from front-end is broken down into web mercator coords that can be converted into bng
    data = request.get_json()
    point_name = data.get('point_name', '').strip()
    web_mercator_x = data.get("web_mercator_x")
    web_mercator_y = data.get("web_mercator_y")

    if not point_name or web_mercator_x is None or web_mercator_y is None:
        return jsonify({"success": False, "message": "Name and Coordinates are required"})
    
    try:
        # ensures the values are floats for correct conversions
        x_float = float(web_mercator_x)
        y_float = float(web_mercator_y)
        
        # coord conversion into bng from web mercator
        bng_x, bng_y = service.convert_web_mercator_to_bng(x_float, y_float)
        
        # coords are used to save the chosen point

        coords = json.dumps([bng_x, bng_y])

        user = get_current_user()
        if user:
            with Session(engine) as db:
                new_point = Point(name=point_name, coordinates=coords, user_id=user.id) 
                db.add(new_point)
                db.commit()

            return jsonify({"success": True, "message": 'Successfully saved the point'})
        
    except ValueError:
        # if float() fails
        return jsonify({"success": False, "message": "Invalid coordinate format. Coordinates must be numbers."}), 400
        
    except Exception as e:
        # catches pyproj errors and sends 500 response
        error_message = f"Server Error: {type(e).__name__}: {e}"
        print(f"Server Error in /save_point route: {error_message}")
        # 500 so the rejection promise can be fetched
        return jsonify({"success": False, "message": error_message}), 500
    
# flask-route which is used to save a route that has been passed into the backend into the PostgreSQL database 
@app.route("/save_route", methods=["POST"])
@limiter.limit("110 per minute")
def save_route():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "Invalid request: No JSON data provided"}), 400
        
        user = get_current_user()
        
        
        route_name = data.get("route_name")
        coordinates = data.get("coordinates")
        format_type = data.get("format")
        route_distance_km = data.get("route_distance_km")
        ETA = data.get("route_ETA")
        elevation_change = data.get("elevation_change")

        # rejects empty name
        if not route_name or (isinstance(route_name, str) and route_name.strip() == ""):
            return jsonify({"success": False, "message": "Route name is required"}), 400

        # validates coords
        if not coordinates or len(coordinates) == 0:
            return jsonify({"success": False, "message": "No route data found to save. Please generate or load a path first."}), 400

        # validates format type
        if not format_type:
            return jsonify({"success": False, "message": "Route format is required"})
        
        coordinates_json = json.dumps(coordinates)

        if not route_distance_km:
            return jsonify({"success": False, "message": "Error whilst saving route: cannot convert distance to float"})
        
        distance_km_value = float(route_distance_km)
                    
        route = Route(
            name=route_name, 
            coordinates=coordinates_json, 
            format=format_type, 
            user_id=user.id, 
            ETA=ETA, 
            distance_km=distance_km_value, 
            elevation_change=elevation_change
        )
        

        with Session(engine) as db:
            db.add(route)
            db.commit()
            print(f"[DEBUG] Route successfully committed to database.")

            return jsonify({"success": True, "message": "Successfully saved the route"})
    except Exception as e:
        return jsonify({"success": False, "message": f"Error processing request: {str(e)}"})

# flask route which is used to retrieves a saved route that has been passed into the back-end from the PostgreSQL database
@app.route("/load_route", methods=["POST"])
@limiter.limit("110 per minute")
def load_route():
    data = request.get_json()
    route_name = data.get('route_name', '').strip()
    
    if not route_name:
        return jsonify({"success": False, "message": "Route name is required"})
    
    with Session(engine) as db:
        route = db.exec(
            select(Route)
            .where(Route.name == route_name)
        ).first()

        if not route:
            return jsonify({"success": False, "message": "Route not found"})
        
        json_coords = json.loads(route.coordinates)

        
        # success, coordinates, file_type = db_manager.load_route(route_name)
        coordinates = json_coords

        has_elevation = check_elevation(coordinates)
        
        try:
            # converts wgs84 coordinates to web mercator for display
            web_mercator_coordinates = []

            if check_web_mercator(coordinates[0]):
                # already in web mercator so this block just normalises the lengths
                for coord in coordinates:
                    x, y = coord[0], coord[1]
                    z = coord[2] if len(coord) >= 3 else 0   # default elevation = 0
                    web_mercator_coordinates.append([x, y, z])
            else:
                # this block converts wgs84 to web mercator
                for coord in coordinates:
                    if has_elevation and len(coord) >= 3:
                        lon, lat, elevation = coord[:3]
                        web_x, web_y = service.convert_wgs84_to_web_mercator(lon, lat)
                        web_mercator_coordinates.append([web_x, web_y, elevation])
                    else:
                        lon, lat = coord[:2]
                        web_x, web_y = service.convert_wgs84_to_web_mercator(lon, lat)
                        web_mercator_coordinates.append([web_x, web_y, 0])

            if not web_mercator_coordinates:
                return jsonify({"success": False, "message": "No valid coordinates found in route file"})
            
            # converts coordinates to geojson format for display
            path_geojson = {
                "type": "FeatureCollection",
                "features": [{
                    "type": "Feature",
                    "geometry": {"type": "LineString", "coordinates": web_mercator_coordinates},
                    "properties": {"color": "#2563eb"}
                }]
            }
            
            
            # calculates midpoint for map centring
            midpoint = web_mercator_coordinates[len(web_mercator_coordinates)//2] if web_mercator_coordinates else default_centre

            # data collected directly from database values
            ETA = route.ETA
            distance = route.distance_km
            elevation_change = route.elevation_change
            
            # route statistics to pass to frontend
            route_stats = {
                "total_distance": distance if distance is not None else 0,
                "eta": ETA,
                "elevation_change": elevation_change
            }
            
            return jsonify({
                "success": True, 
                "message": f"Route '{route_name}' loaded successfully",
                "pathGeoJSON": path_geojson,
                "map_centre": midpoint,
                "coordinates": web_mercator_coordinates,
                "route_stats": route_stats
            })
        
        except Exception:
            return jsonify({"success": False, "message": "The route could not be loaded"})

# flask-route which retreives saved routes to be used in the front-end
@app.route("/get_routes", methods=["GET"])
def get_routes():
    user = get_current_user()
    if user:
        routes = Route.query.filter_by(user_id=user.id).order_by(Route.created_at).all()
    routes_list = []

    for route in routes:
        routes_list.append({
            "name": route.name,
            "type": route.format,
            "filename": f"{route.name}.{route.format}",
            "elevationChange": route.elevation_change,
            "eta": route.ETA,
            "route_distance_km": route.distance_km if route.distance_km is not None else 0,
            "created": route.created_at.strftime("%d/%m/%y")
        })
    
    return jsonify({"routes": routes_list, "success": True})

# flask route which returns a raw binary file of the route in either GPX or GeoJSON format
@app.route("/download_route", methods=["POST"])
def download_route():
    data = request.get_json(silent=True) or {} # silent to prevent errors and return None
    
    route_name = data.get('route_name', "").strip()
    file_type = data.get('route_type').lower()

    # ensures that routes have a name (defensive programming since it is almost impossible a route doesn't have a name due to design of app)
    if not route_name:
        return jsonify({"success": False, "message": "Route name is required"}), 400

    # ensures that routes have a file type (also impossible since download occurs through either a gpx or a geojson button)
    if file_type not in ["gpx", "geojson"]:
        return jsonify({"success": False, "message": "Invalid file type. Use 'gpx' or 'geojson'"}), 400

    user = get_current_user()
    # ensures that a user is logged in
    if not user:
        return jsonify({"success": False, "message": "You must be logged in"}), 401

    with Session(engine) as db:

        route = db.exec(
            select(Route)
            .where(Route.name == route_name, Route.user_id == user.id)
        ).first()
        
        # ensures that a route is found before attempting to convert
        if not route:
            return jsonify({"success": False, "message": "Route not found or you don't own it"}), 404

        print(route.coordinates)

        try:
            if file_type == "gpx":
                content = generate_gpx(route)
                mimetype = 'application/gpx+xml'
                extension = 'gpx'
            else:
                content = generate_geojson(route)
                mimetype = 'application/geo+json'
                extension = 'geojson'

            safe_name = "".join(
                char if char.isalnum() or char in " -_()" else "_" 
                for char in route.name
            )

            return send_file(
                io.BytesIO(content.encode('utf-8')),
                mimetype=mimetype,
                as_attachment=True,
                download_name=f"{safe_name}.{extension}"
            )

        except Exception as e:
            print(f"Error whilst downloading {route_name}:", e)
            return jsonify({"success": False, "message": "Failed to generate file"}), 500


# flask-route which retrieves saved points to be used in the front
@app.route("/get_saved_points", methods=["GET"])
def get_saved_points():

    user = get_current_user()
    if user:
        with Session(engine) as db:
            points = db.exec(
                select(Point)
                .where(Point.user_id == user.id)
            ).all()
    
    if not points:
        return jsonify({"points": []})
    
    web_mercator_points = []
    for point in points:
        try:
            bng_x, bng_y = json.loads(point.coordinates)

            web_mercator_x, web_mercator_y = service.convert_bng_to_web_mercator(bng_x, bng_y)

            web_mercator_points.append({
                "name": point.name,
                "coordinates": [web_mercator_x, web_mercator_y]
            })
        except Exception as e:
            print(f"Skipping points due to conversion error: {e}")
            continue
    

    return jsonify({"points": web_mercator_points})

# route which deletes a saved point that is passed into the back-end from the front-end
@app.route("/delete_point", methods=['POST'])
@limiter.limit("110 per minute")
def delete_point():
    data = request.get_json()
    point_name = data.get('point_name', '').strip()

    if not point_name:
        return jsonify ({"success": False, "message": "Point name is missing"})
    
    try:
        with Session(engine) as db:

            point_to_delete = db.exec(
                select(Point)
                .where(Point.name == point_name)
            ).first()

            db.delete(point_to_delete)
            db.commit()

            return jsonify({"success": True, "message": f"Successfully deleted the {point_name} point"})

    except Exception:
        return jsonify({"success": False, "message": f"Could not successfully save the {point_name} point"})
    
    
#flask-route which deletes a route that is passed from the front-end to the back-end
@app.route("/delete_route", methods=["POST"])
@limiter.limit("110 per minute")
def delete_route():
    data = request.get_json()
    route_name = data.get("route_name")
    user = get_current_user()

    if not route_name:
        return jsonify({"success": False, "message": "Route name is missing"}), 400

    try:
        with Session(engine) as db:
            route = db.exec(
                select(Route)
                .where(Route.name == route_name, Route.user_id == user.id)
            ).first()
            db.delete(route)
            db.commit()

            return jsonify({"success": True, "message": f"Successfully saved the {route.name}"})
    except Exception:
        return jsonify({"success": False, "message": "Could not delete the route."})


# GENERAL MAP ROUTES

@app.route("/")
@limiter.exempt
def main_page():
    return render_template("main.html")

# first route 
@app.route("/login-page")
@limiter.exempt
def login_page():
    return render_template("login.html")

@app.route("/register")
@limiter.exempt
def register_page():
    return render_template("register.html")

# After logging in
@app.route("/map")
@limiter.exempt
def map_view():
    web_mercator_center = service.convert_bng_to_web_mercator(default_centre[0], default_centre[1])

    # gets list of available routes for the load dropdown
    user = get_current_user()
    if user is None:
        available_routes = []
        saved_points = []
        return render_template("/login.html")
    
    with Session(engine) as db:
        try: 
            available_routes = db.exec(
                select(Route)
                .where(Route.user_id == user.id)
                .order_by(Route.created_at.desc())
            ).all()
            saved_points = db.exec(
                select(Point)
                .where(Point.user_id == user.id)
                .order_by(Point.created_at.desc())
            ).all()

            web_mercator_points = []
            for point in saved_points:
                try:
                    bng_x, bng_y = json.loads(point.coordinates)
                    web_mercator_x, web_mercator_y = service.convert_bng_to_web_mercator(bng_x, bng_y)
                    web_mercator_points.append({
                        "name": point.name,
                        "coordinates": [web_mercator_x, web_mercator_y]
                    })
                except Exception as e:
                    print(f"Error in conversion: {e}")
                    continue
            
            return render_template("map.html",
                                map_centre = web_mercator_center,
                                map_zoom = 10,
                                current_path = session.get('current_path', None),
                                available_routes=available_routes,
                                saved_points=web_mercator_points,
                                logged_in = (user is not None))
        except Exception as error:
            return jsonify({"success": False, "message": f"Error whilst getting map: {error}"})


@app.route("/reset", methods=["GET"])
@limiter.limit("200 per minute")
def reset_view():

    web_mercator_center = service.convert_bng_to_web_mercator(default_centre[0], default_centre[1])

    # gets list of available routes for the load dropdown
    user = get_current_user()
    if user is None:
        available_routes = []
        saved_points = []
    else:
        available_routes = Route.query.filter_by(user_id=user.id).all()
        saved_points = Point.query.filter_by(user_id=user.id).all()

    web_mercator_points = []
    for point in saved_points:
        try:
            bng_x, bng_y = json.loads(point.coordinates)
            web_mercator_x, web_mercator_y = service.convert_bng_to_web_mercator(bng_x, bng_y)
            web_mercator_points.append({
                "name": point.name,
                "coordinates": [web_mercator_x, web_mercator_y]
            })
        except Exception as e:
            print(f"Error in conversion: {e}")
            continue
    
    return render_template("map.html",
                           map_centre = web_mercator_center,
                           map_zoom = 10,
                           current_path = session.get('current_path', None),
                           available_routes=available_routes,
                           saved_points=web_mercator_points,
                           logged_in = (user is not None)) 

@app.route("/search_area", methods=["POST"])
@limiter.limit("10 per minute")
def search_area():
    data = request.get_json()
    search_input = data.get("search_input")
    query_parameters = {
        'key': locationiq_api_key,
        'q': search_input,
        'format': 'json',
        'countrycodes': 'gb'
    }

    response = requests.get("https://eu1.locationiq.com/v1/search", params=query_parameters)
    results = response.json()

    if isinstance(results, list) and len(results) > 0:

        first_result = results[0]

        latitude = first_result.get("lat")
        longitude = first_result.get("lon")

        print(f"Latitude: {latitude}\nLongitude: {longitude}")

        web_mercator_x, web_mercator_y = service.convert_wgs84_to_web_mercator(longitude, latitude)

        coords = [web_mercator_x, web_mercator_y]

        print(coords)

        return jsonify({
            "success": True,
            "coordinates": coords,
            "display_name": first_result.get("display_name")
        })
    else:
        return jsonify({"success": False, "message": "Could not find area"})




if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)

