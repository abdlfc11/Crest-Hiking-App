# These imports are for pathfinding.
from pathfinder import (
    a_star,
    snap_to_largest_component,
    build_global_kdtree,
)

# These imports are for Flask.
from flask import (
    Flask,
    render_template,
    request,
    jsonify,
    session,
    send_file,
    redirect,
    url_for,
)

# These imports are for system utilities.
import sys
import os

sys.path.insert(0, "/app/src")

# These imports are for the database.
from sqlmodel import Session, select, delete
from sqlalchemy.exc import IntegrityError

from db import engine
from models import User, Route, Point, Settings, BetaCode, ActionLog

# These imports are for data processing.
import pickle as pkl
import json
import math
import time
import io

# These imports are for date and time handling.
from datetime import datetime, timezone, timedelta

# These imports are for geospatial processing.
from pyproj import Transformer
from scipy.spatial import KDTree
import networkx as nx
import gpxpy
import gpxpy.gpx
from fastkml.kml import KML
from fitparse import FitFile

# These imports are for authentication and security.
from werkzeug.security import generate_password_hash, check_password_hash
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# These imports are for HTTP requests and configuration.
import requests
from config import Config

# This import is for typing (better readability and understanding of code)
from typing import Optional, Any

# traceback import for custom action logging 
import traceback

# default map centre (web_mercator coordinates)
default_centre = [-356034, 7258806]


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

#region ACTION LOGGING

def log_action(
    action: str, 
    outcome: bool, 
    info: Optional[Any] = None, 
    duration_ms: Optional[int] = None,
    code: Optional[str] = None
) -> None:
    """
    Records an application event or metric into the central ActionLog table.

    This function operates entirely within its own isolated database session 
    to guarantee that transaction failures in the main application flow do 
    not disrupt or prevent the creation of the event log. 

    Args:
        - action (str): The name of the event or endpoint (e.g., 'pathfind_request').

        - outcome (bool): True if the operation succeeded, False if it failed.

        - info (Any, optional): Contextual metadata. Accepts raw exceptions (which 
            are stringified) or dictionaries/lists (which are automatically 
            serialized into JSON strings). Defaults to None.

        - duration_ms (int, optional): Performance metric representing execution 
            time strictly formatted as milliseconds. Defaults to None.

        - code (str, optional): An application-specific identifier 
            (e.g., 'FAILED_SAVE_ROUTE').
            Defaults to None.

    Returns:
        None

    Raises:
        Does not propagate exceptions. Internal failures (e.g., complete database 
        unreachability) are caught silently and dumped safely to system standard error logs.
    """
    with Session(engine) as log_db:
        try:
            # This handles info parsing safely depending on data type, mainly a guard clause as most info (if not all) passed in is a string
            processed_info = None
            if info is not None:
                if isinstance(info, Exception):
                    processed_info = str(info)[:2000]
                elif isinstance(info, (dict, list)):
                    processed_info = json.dumps(info)
                else:
                    processed_info = str(info)[:2000]

            # This builds the record / row
            log_entry = ActionLog(
                action=action,
                outcome=outcome,
                info=processed_info,
                duration_ms=duration_ms,
                error_code=code
            )
            
            log_db.add(log_entry)
            log_db.commit()
            
        except Exception as log_err:
            # Fallback if the database becomes entirely unreachable
            print(f"CRITICAL: Failed to write to ActionLog table: {log_err}", file=sys.stderr)
            print(traceback.format_exc())

#endregion


# useful helper for getting the current user during route and point creation as well as logging in and out 
def get_current_user():
    username = session.get("username")
    print(username)
    if not username:
        print("no username detected")
        return None
    with Session(engine) as db:
        return db.exec(select(User).where(User.username == username)).first()

def is_beta_code_validated():
    beta_code = session.get("beta_code")
    print(beta_code)
    if not beta_code:
        print("No beta code detected")
        return False
    else:
        return True

@app.template_filter('format_elevation')
def format_elevation(elevation_gain):
    if not isinstance(elevation_gain, int) or isinstance(elevation_gain, float):
        elevation_gain = float(elevation_gain)

    if elevation_gain >= 0:
        return f"+{elevation_gain}"
    else:
        return f"{elevation_gain}"

@app.template_filter('format_eta')
def format_eta(seconds):
    hours = math.floor(seconds / 3600)
    minutes = math.floor((seconds % 3600) / 60)

    if hours == 0:
        return f"{minutes}m"
    else:
        return f"{hours}h {minutes}m"
    
# STRFTIME FILTER
@app.template_filter("strftime")
def strftime_filter(date, format: str):
    if isinstance(date, str):
        date = datetime.isoformat(date)
    return date.strftime(format)


#region ERROR HANDLER RENDER_TEMPLATES()

@app.errorhandler(404)
def page_not_found(error):
    return render_template('Error-Pages/404.html')

@app.errorhandler(405)
def page_not_found(error):
    return render_template('Error-Pages/405.html')

@app.errorhandler(500)
def page_not_found(error):
    return render_template('Error-Pages/500.html')

#endregion

# region AUTH FLASK ROUTES

# BETA CODE VALIDATION
@app.route("/validate-beta-code", methods=['POST'])
def validate_beta_code():
    data = request.get_json()
    code = data.get("beta_code", "").strip()

    if not code:
        return jsonify({"success": False, "message": "Beta code not received"})
    
    with Session(engine) as db:
        db_code = db.exec(
            select(BetaCode)
            .where(BetaCode.code == code)
        ).first()

        if not db_code:
            return jsonify({"success": False, "message": "Could not find beta code"})
    
    session["beta_code"] = code
    session.permanent = True

    return jsonify({"success": True, "message": "Beta Code validation was successful"})
        

#region LOGGING IN AND OUT

@app.route("/login", methods=["POST"])
@limiter.limit("10 per minute")
def login():
    try:

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
    except Exception as e:

        short_traceback = "".join(traceback.format_exception_only(type(e), e)).strip()

        log_action('Login', False, short_traceback, None, 'LOGIN')

        return jsonify({"success": False, "message": "Sorry, there was an unexpected error whilst logging in."}), 500 

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
    with Session(engine) as db:
        try:
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

            
            existing_user = db.exec(
                select(User).where(User.username == username)
            ).first()

        
            if existing_user:
                return jsonify({"success": False, "message": "Someone has already chosen this username"})
            
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

            short_traceback = "".join(traceback.format_exception_only(type(error), error)).strip()

            log_action('Registering', False, short_traceback, None, 'FAILED_REGISTRATION')

            return jsonify({"success": False, "message": "There was an unexpected error with our database"})

#endregion



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

                short_traceback = "".join(traceback.format_exception_only(type(e), e)).strip()

                log_action('Deleting Account', False, short_traceback, None, 'FAILED_ACCOUNT_DELETION')

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

    except Exception as e:

        short_traceback = "".join(traceback.format_exception_only(type(e), e)).strip()

        log_action('Getting Settings', False, short_traceback, None, 'FAILED_GET_SETTINGS')

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

    except Exception as e:
        db.rollback()

        short_traceback = "".join(traceback.format_exception_only(type(e), e)).strip()

        log_action('Saving Settings', False, short_traceback, None, 'FAILED_SAVE_SETTINGS')

        return jsonify({"success": False, "message": "There was an error whilst saving settings"}), 500
#endregion


#region NODEFINDER CLASS

class NodeFinder:
    def __init__(self, graph_path=None, max_distance=5000, early_exit_distance=100):
        if graph_path is None:
            graph_path = Config.GRAPH_PATH
        self.graph_path = graph_path
        self._graph = None
        self._kdtree = None
        self.max_distance = max_distance
        self.early_exit_distance = early_exit_distance
        
        # Coord conversions
        self._bng_to_web_mercator = Transformer.from_crs("EPSG:27700", "EPSG:3857", always_xy=True)
        self._bng_to_wgs84 = Transformer.from_crs("EPSG:27700", "EPSG:4326", always_xy=True)
        self._wgs84_to_web_mercator = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
        self._web_mercator_to_wgs84 = Transformer.from_crs("EPSG:3857", "EPSG:4326", always_xy=True)

    def load_graph(self):
        if self._graph is None:
            if not os.path.exists(self.graph_path):
                raise FileNotFoundError(
                    f"\n\n=== GRAPH FILE MISSING ===\n"
                    f"Expected graph at: {os.path.abspath(self.graph_path)}\n\n"
                )

            with open(self.graph_path, "rb") as file:
                self._graph = pkl.load(file)

            largest_cc_nodes = max(nx.weakly_connected_components(self._graph), key=len)
            self._graph = self._graph.subgraph(largest_cc_nodes).copy()

            nodes_coords = list(self._graph.nodes())
            self._nodes_list = nodes_coords
            self._kdtree = KDTree(nodes_coords)

            build_global_kdtree(self._graph)

            print(f"Graph initialised with {len(self._nodes_list)} reachable nodes.")

            if self._nodes_list:
                sample_node = self._graph.nodes[self._nodes_list[0]]
                if 'elev' not in sample_node:
                    print("WARNING: Graph loaded successfully but nodes have no 'elev' attribute.")
        
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


    def euclidean_distance(self, node, target_x, target_y):
        return ((node[0] - target_x) ** 2 + (node[1] - target_y) ** 2) ** 0.5
    
    def find_nearest_node(self, target_x, target_y):
        self.load_graph()
        target_point = (target_x, target_y)
        distance, index = self._kdtree.query(target_point)

        if distance > self.max_distance:
            return None  
        
        return self._nodes_list[index]

    def build_route(self, s_x, s_y, e_x, e_y):
        start_time = time.time()
        full_graph = self.load_graph()

        path, start_node, end_node = a_star(full_graph, (s_x, s_y), (e_x, e_y))

        if not path:
            print("Pathfinding failed")
            return None, None, None, None

        end_time = time.time()
        
        time_taken = round(end_time - start_time, 3) * 1000 
        
        return path, start_node, end_node, time_taken

    def calculate_route_distance(self, path):
        # Calculates total distance of the route in true meters
        total_distance_metres = 0
        if len(path) > 1:
            for i in range(1, len(path)):
                if len(path[i]) == 2 and len(path[i-1]) == 2:
                    x1, y1 = path[i-1]
                    x2, y2 = path[i]
                else:
                    continue

                # these calculations compensate for distortion caused by web mercator projection
                
                # this gets the raw web_merc distance
                stretched_distance = ((x2 - x1)**2 + (y2 - y1)**2)**0.5
                
                # this finds the centre latitude of the segment to find out the distortion
                _, mid_lat = self.convert_web_mercator_to_wgs84((x1 + x2) / 2, (y1 + y2) / 2)
                
                # this finds the scale factor, the equation is 1/ cos(latitude_radians)
                scale_factor = 1.0 / math.cos(math.radians(mid_lat))
                
                # this divides the distance by the scale factor to get the real value
                total_distance_metres += (stretched_distance / scale_factor)
                
        return total_distance_metres

    def calculate_eta(self, path, graph):
        total_seconds = sum(
            graph[start_coordinate][end_coordinate]['cost'] for start_coordinate, end_coordinate in zip(path, path[1:])
        )

        return total_seconds

    def calculate_map_center_and_zoom(self, web_mercator_coordinates):
        if len(web_mercator_coordinates) > 1:
            x_coords = [coord[0] for coord in web_mercator_coordinates]
            y_coords = [coord[1] for coord in web_mercator_coordinates]
            
            min_x, max_x = min(x_coords), max(x_coords)
            min_y, max_y = min(y_coords), max(y_coords)
            
            center_x = (min_x + max_x) / 2
            center_y = (min_y + max_y) / 2
            
            width = max_x - min_x
            height = max_y - min_y
            
            padded_width = width * 1.4
            padded_height = height * 1.4
            max_dimension = max(padded_width, padded_height)
            
            if max_dimension < 1000:
                zoom_level = 14
            elif max_dimension < 5000:
                zoom_level = 12
            elif max_dimension < 20000:
                zoom_level = 10
            elif max_dimension < 50000:
                zoom_level = 8
            else:
                zoom_level = 6
            
            map_center = [center_x, center_y]
            map_zoom = zoom_level
        else:
            midpoint = web_mercator_coordinates[0] if web_mercator_coordinates else [0, 0]
            map_center = [midpoint[0], midpoint[1]]
            map_zoom = 10
        
        return map_center, map_zoom
#endregion

service = NodeFinder(graph_path=Config.GRAPH_PATH)
if os.getenv("LOAD_GRAPH_ON_IMPORT", "1").lower() not in ("0", "false", "no"):
    service.load_graph()

# Create once at module level
transformer = Transformer.from_crs("EPSG:3857", "EPSG:4326", always_xy=True)


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
    except:
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
    except:
        return None

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

# route which forms a path from the set of points the back-end receives as coordinates and returns it to the front-end
@app.route("/calculate_path", methods=["POST"])
@limiter.limit("4 per second")
def calculate_path():
    try:
        data = request.get_json()
        
        # this extracts and parses start + end point coordinates
        start_coords = data.get("start_point", "")
        end_coords = data.get("end_point", "")

        graph = service.load_graph()
        
        # Validation of coord format 
        if not start_coords or not end_coords:
            raise ValueError("Start and end coordinates are required")

        if len(start_coords) < 2 or len(end_coords) < 2:
            raise ValueError("Coordinates must be in format 'x, y'")

        # this extracts the raw numerical coordinates
        start_coords_x, start_coords_y = get_xy(start_coords)
        end_coords_x, end_coords_y = get_xy(end_coords)

        all_coords = [start_coords_x, start_coords_y, end_coords_x, end_coords_y]
        if not all(isinstance(num, (int, float)) for num in all_coords):
            raise ValueError("Coordinates must be valid numbers")
        
        s_x, s_y = start_coords_x, start_coords_y 
        e_x, e_y = end_coords_x, end_coords_y 
        
        
        # COORD PROJECTION TYPE DETECTION
        # Lat / Lon coordinates will be small numbers, whereas web mercator uses large values in metres
    
        # this checks start and end coords to see if they are wgs84 projection and converts to web_mercator if so
        if abs(s_x) <= 180 and abs(s_y) <= 90:
            print("Detected Lat/Lon for start point. Converting to Web Mercator...")
            s_x, s_y = service.convert_wgs84_to_web_mercator(s_x, s_y)
        if abs(e_x) <= 180 and abs(e_y) <= 90:
            print("Detected Lat/Lon for end point. Converting to Web Mercator...")
            e_x, e_y = service.convert_wgs84_to_web_mercator(e_x, e_y)
        
    except (KeyError, ValueError) as e:
        with Session(engine) as db:
            user = get_current_user()
            if user:
                available_routes = db.exec(
                    select(Route)
                    .where(Route.user_id == user.id)
                ).all()
            else:
                available_routes = []

            short_traceback = "".join(traceback.format_exception_only(type(e), e)).strip()

            log_action('Calculating Path', False, short_traceback, None, 'INVALID_COORDS_AUTO_PATH_CREATION')

        return jsonify({
            "success": False,
            "map_centre": default_centre,
            "available_routes": available_routes, 
            "message": f"Invalid coordinates: {str(e)}"
        })

    # Build the route using the Web Mercator coordinates
    path, start_node, end_node, time_taken = service.build_route(s_x, s_y, e_x, e_y)

    if not path:  
        with Session(engine) as db:
            user = get_current_user()
            if user:
                available_routes = db.exec(
                    select(Route)
                    .where(Route.user_id == user.id)
                ).all()
            else:
                available_routes = []
                

            log_action('Calculating Path', False, 'Path not created', None, 'NO_PATH_FOUND')
            
            return jsonify({
                "success": False,
                "map_centre": default_centre,
                "available_routes": available_routes,
                "message": "No path could be created"
            })

    web_mercator_coordinates = [] 
    
    # Since the graph/path is already in Web Mercator, we no longer need to convert it!
    for node in path:  
        x, y = node  
        elev = graph.nodes.get(node, {}).get('elev')
        if elev is not None:
            web_mercator_coordinates.append([x, y, elev])
        else:
            web_mercator_coordinates.append([x, y])
    
    start_coords = web_mercator_coordinates[0]
    end_coords = web_mercator_coordinates[-1]
    
    # Calculates distance and eta statistics
    total_distance = service.calculate_route_distance(path)
    
    # Since your network graph distance calculation is now in meters (or handled by your service),
    # we convert it directly to kilometers here
    total_distance_km = total_distance / 1000
    
    # Calculates ETA 
    # NOTE : this is in SECONDS
    eta_seconds = service.calculate_eta(path, graph)

    path_geojson = {
        "type": "Feature",
        "geometry": {"type": "LineString", "coordinates": web_mercator_coordinates},
        "properties": {"color": "#2563eb"}
    } 
    
    # Calculates optimal map centre and zoom
    map_centre, map_zoom = service.calculate_map_center_and_zoom(web_mercator_coordinates)

    start_elevation = int(graph.nodes[start_node]['elev'])
    end_elevation = int(graph.nodes[end_node]['elev'])

    elevation_difference = end_elevation - start_elevation
    elevation_change = f"+{elevation_difference}m" if elevation_difference >= 0 else f"{elevation_difference}m" 

    route_stats = {
        "start_elevation": start_elevation,
        "end_elevation": end_elevation,
        "elevation_change": elevation_change,
        "total_distance": round(total_distance_km, 2),
        "eta_seconds": eta_seconds
    }

    with Session(engine) as db:

        log_action('Calculating Path', True, f"distance: {round(total_distance_km, 2)}km", time_taken, 'PATH_CREATED')

    user = get_current_user()
    if user:
        with Session(engine) as db:
            available_routes = db.exec(
                select(Route)
                .where(Route.user_id == user.id)
            ).all()
    else:
        available_routes = []
            
    return jsonify({
        "success": True,
        "pathGeoJSON": path_geojson,
        "map_centre": map_centre,
        "map_zoom": map_zoom,
        "route_stats": route_stats,
        "coordinates": web_mercator_coordinates,
        "startCoord": start_coords,
        "endCoord": end_coords
    })

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
              
        # coords are used to save the chosen point
        coords = json.dumps([float(web_mercator_x), float(web_mercator_y)])

        user = get_current_user()
        if user:
            with Session(engine) as db:
                new_point = Point(name=point_name, coordinates=coords, user_id=user.id) 
                db.add(new_point)
                db.commit()

                log_action('Saving Point', True, None, None, 'SAVING_POINT')

            return jsonify({"success": True, "message": 'Successfully saved the point'})
    
    # if float() fails
    except ValueError as e:

        short_traceback = "".join(traceback.format_exception_only(type(e), e)).strip()     
        log_action('Saving Point', False, short_traceback, None, 'SAVING_POINT')

        return jsonify({"success": False, "message": "Invalid coordinate format. Coordinates must be numbers."}), 400
        
    except Exception as e:

        with Session(engine) as db: 

            short_traceback = "".join(traceback.format_exception_only(type(e), e)).strip()
        
            log_action('Saving Point', False, short_traceback, None, 'SAVING_POINT')

        return jsonify({"success": False, "message": "Failed to save point."}), 500


# flask-route which is used to save a route that has been passed into the backend into the PostgreSQL database 
@app.route("/save_route", methods=["POST"])
@limiter.limit("110 per minute")
def save_route():
    with Session(engine) as db:
        try:
            data = request.get_json()
            if not data:
                return jsonify({"success": False, "message": "Invalid request"}), 400

            user = get_current_user()

            route_name = data.get("route_name")
            coordinates = data.get("coordinates")
            type = data.get("type")

            if not route_name or not route_name.strip():
                return jsonify({"success": False, "message": "Route name required"}), 400
            

            if not coordinates or len(coordinates) < 2:
                return jsonify({"success": False, "message": "Invalid route data"}), 400
            
            metrics = normalise_route(coordinates)

            route = Route(
                name=route_name,
                coordinates=json.dumps(coordinates),
                user_id=user.id,

                distance_km=metrics["distance_km"],
                eta_seconds=metrics["eta_seconds"],
                elevation_change=metrics["elevation_gain_m"]
            )

            route_info = {
                "route_name": route_name,
                "distance_km": metrics["distance_km"],
                "eta_seconds": metrics["eta_seconds"],
                "elevation_gain_metres": metrics["elevation_gain_m"],
            }

            
            db.add(route)
            db.commit()

            log_action('Saving Route', True, None, None, 'SAVE_ROUTE')

            return jsonify({
                "success": True,
                "route_info": route_info
            })


        except IntegrityError as e:
            db.rollback()

            short_traceback = "".join(traceback.format_exception_only(type(e), e)).strip()

            log_action('Saving Route', False, short_traceback, None, 'SAVE_ROUTE')

            return jsonify({"success" : False, "message" : "There was an error saving your route. "})


        except Exception as e:
            db.rollback()

            short_traceback = "".join(traceback.format_exception_only(type(e), e)).strip()
            
            log_action('Saving Route', True, short_traceback, None, 'SAVE_ROUTE')

            return jsonify({"success": False, "message": "There was an error saving your route. "})
    


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

                log_action('Loading Route', False, "No coordinates found in the route", None, 'LOAD_ROUTE')

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
            eta_seconds = route.eta_seconds
            distance = route.distance_km
            elevation_change = route.elevation_change
            
            # route statistics to pass to frontend
            route_stats = {
                "total_distance": distance if distance is not None else 0,
                "eta_seconds": eta_seconds,
                "elevation_change": elevation_change
            }

            log_action('Loading Route', True, None, None, 'LOAD_ROUTE')
            
            return jsonify({
                "success": True, 
                "message": f"Route '{route_name}' loaded successfully",
                "pathGeoJSON": path_geojson,
                "map_centre": midpoint,
                "coordinates": web_mercator_coordinates,
                "route_stats": route_stats
            })
        
        except Exception as e:

            short_traceback = "".join(traceback.format_exception_only(type(e), e)).strip()
            
            log_action('Loading Route', False, short_traceback, None, 'LOAD_ROUTE')

            return jsonify({"success": False, "message": "The route could not be loaded"})


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

            log_action('Downloading Route', False, 'Route not found', None, 'DOWNLOAD_ROUTE')

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

            log_action('Downloading Route', True, extension, None, 'DOWNLOAD_ROUTE')

            return send_file(
                io.BytesIO(content.encode('utf-8')),
                mimetype=mimetype,
                as_attachment=True,
                download_name=f"{safe_name}.{extension}"
            )

        except Exception as e:

            short_traceback = "".join(traceback.format_exception_only(type(e), e)).strip()

            log_action('Downloading Route', False, short_traceback, None, 'DOWNLOAD_ROUTE')

            return jsonify({"success": False, "message": "Failed to download route"}), 500

@app.route("/import_route_file", methods=["POST"])
def import_route():
    """
    This function handles route file uploads for GPX, FIT, KML, and GeoJSON formats.

    it received as parameters:
        - route file

    it returns:
        JSON containing:
            success (bool)
            coords (list of [lat, lon, ele?])
    """

    # this retrieves the uploaded file from the request
    uploaded_file = request.files.get("route_file")

    if not uploaded_file:

        with Session(engine) as db:

            log_action('Importing Route', False, 'Uploaded file could not be retrieved', None, 'IMPORT_ROUTE')

        return jsonify({"success": False, "message": "Cannot receive uploaded file"}), 400
    
    try: 
    
        # this extracts the filename and file extension
        filename = uploaded_file.filename
        ext = filename.rsplit('.', 1)[-1].lower()

        # this validates the supported formats 
        if ext not in ["gpx", "fit", "kml", "geojson"]:
            return jsonify({"success": False, "message": "Please upload a file of the supported types"}), 400
        
        # this reads raw bytes (works for both binary + text formats) for FIT file type
        raw = uploaded_file.read()

        # this decodes text formats (GPX, KML, GeoJSON) 
        text = raw.decode("utf-8", errors="ignore")

        # this handles GPX file types
        if ext == "gpx":
            # Parse GPX XML
            gpx = gpxpy.parse(text)

            converted_points = []

            # Extract all track points into [lat, lon, ele]
            points = [
                [p.latitude, p.longitude, p.elevation]
                for t in gpx.tracks
                for s in t.segments
                for p in s.points
            ]

            for point in points:
                
                lat, lon, ele = point[0], point[1], point[2]

                web_mercator_coords = service.convert_wgs84_to_web_mercator(lon, lat)

                converted_points.append([web_mercator_coords[0], web_mercator_coords[1], ele])

            return jsonify({
                "success": True,
                "coords": converted_points,
            })

        # this handles FIT file types
        elif ext == "fit":
            coords = []
            fitfile = FitFile(raw)

            for record in fitfile.get_messages("record"):
                lat = record.get_value("position_lat")
                lon = record.get_value("position_long")

                # Skip missing coordinate records
                if lat is None or lon is None:
                    continue

                # FIT stores coordinates in semicircles → convert to degrees
                lat_deg = lat * (180 / 2**31)
                lon_deg = lon * (180 / 2**31)

                coords.append([lat_deg, lon_deg])

            return jsonify({"success": True, "coords": coords})

        # this handles KML file types
        elif ext == "kml":
            uploaded_file.stream.seek(0);
            doc = KML.parse(uploaded_file.stream, strict=False)
            coords = extract_kml_coords(doc)
            return jsonify({"success": True, "coords": coords})

        # this handles geojson file types
        elif ext == "geojson":
            geo = json.loads(text)
            coords = []
            geometries = []

            """
            
            structure of geojson files is usually like the below: 

            {{
                "type": "FeatureCollection",
                    "features": [
                        {
                        "type": "Feature",
                        "geometry": {
                            "type": "LineString",
                            "coordinates": [[-1.8, 53.3, 250], [-1.8, 53.4, 260]]
                        },
                        "properties": {}
                        }
                    ]
                } 
            """

            # this extracts the object allowing us to use conditional logic to work towards the coords of the file
            root_type = geo.get("type")

            if root_type == "FeatureCollection":
                for feature in geo.get("features", []):
                    if "geometry" in feature:
                        geometries.append(feature["geometry"])
            elif root_type == "Feature":
                if "geometry" in geo:
                    geometries.append(geo["geometry"])
            else:
                # this is if the root is geometry itself

                # validate that the geom type is actually a geometry 
                if geo.get('type') in ["Point", "LineString", "MultiLineString", "Polygon"]:
                    geometries.append(geo)
                else:
                    log_action('Importing Route', False, 'Invalid GeoJSON Structure', None, "IMPORT_ROUTE");
                    return jsonify({"success": False, "message": "There was an error on our end, please try again later."})

            # this is for processing LineString geometries
            for geom in geometries:
                if geom and geom.get("type") == "LineString":
                    for coord in geom.get("coordinates", []):
                        # this unpacks the values from each coord

                        if len(coord) <= 1:
                            return jsonify({"success": False, "message": "Error whilst parsing GeoJSON: given coordinates have one value only"})

                        lon = coord[0]
                        lat = coord[1]
                        ele = coord[2] if len(coord) > 2 else 0

                        web_mercator_x, web_mercator_y = service.convert_wgs84_to_web_mercator(lon, lat)
                        coords.append([web_mercator_x, web_mercator_y, ele])
            
            log_action('Importing Route', True, ext, None, 'IMPORT_ROUTE')

            return jsonify({"success": True, "coords": coords})
    except Exception as e:
            
            short_traceback = "".join(traceback.format_exception_only(type(e), e)).strip()

            log_action('Importing Route', False, short_traceback, None, 'IMPORT_ROUTE')
            return jsonify({"success": False, "message": "There was an error on our end, please try again later."})



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
        return jsonify({"success": False, "message": "No points found" ,"points": []})
    
    web_mercator_points = []
    for point in points:
        try:
            web_mercator_x, web_mercator_y = json.loads(point.coordinates)

            web_mercator_points.append({
                "name": point.name,
                "coordinates": [web_mercator_x, web_mercator_y]
            })
        except Exception as e:
            
            short_traceback = "".join(traceback.format_exception_only(type(e), e)).strip()

            log_action('Getting Saved Points', False, short_traceback, None, 'GET_SAVED_POINT')
    
    
    return jsonify({"success": True, "points": web_mercator_points})

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

            log_action('Deleting Point', True, None, None, 'DELETE_POINT')

            return jsonify({"success": True, "message": f"Successfully deleted the {point_name} point"})

    except Exception as e:

        short_traceback = "".join(traceback.format_exception_only(type(e), e)).strip()
        
        log_action('Deleting Point', False, short_traceback, None, 'DELETE_POINT')

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
    except Exception as e:

        short_traceback = "".join(traceback.format_exception_only(type(e), e)).strip()
        
        log_action('Deleting Route', False, short_traceback, None, 'DELETE_ROUTE')

        return jsonify({"success": False, "message": "Could not delete the route."})


# GENERAL MAP ROUTES

@app.route('/')
@limiter.exempt
def root_url():
    return redirect(url_for('map_view'))

@app.route('/beta-page', methods=["GET"])
@limiter.exempt
def get_beta_page():
    return render_template("beta-code.html")

# first route 
@app.route("/login-page")
@limiter.exempt
def login_page():

    # check = is_beta_code_validated()

    # if not check:
        # return render_template("beta-code.html")

    return render_template("login.html")

@app.route("/register")
@limiter.exempt
def register_page():

    #check = is_beta_code_validated()

    #if not check:
        #return redirect(url_for(get_beta_page))

    return render_template("register.html")

# After logging in
@app.route("/map")
@limiter.exempt
def map_view():

    # gets list of available routes for the load dropdown
    user = get_current_user()
    if user is None:
        available_routes = []
        saved_points = []
        return redirect(url_for("login_page"))
    
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
                    continue
            
            return render_template("map.html",
                                map_centre = default_centre,
                                map_zoom = 10.5,
                                current_path = session.get('current_path', None),
                                available_routes=available_routes,
                                saved_points=web_mercator_points,
                                logged_in = (user is not None))
        except Exception as e:

            short_traceback = "".join(traceback.format_exception_only(type(e), e)).strip()

            log_action('Loading Map', False, short_traceback, None, 'LOAD_MAP')

            return jsonify({"success": False, "message": f"Error whilst getting map: {e}"})


@app.route("/search_area", methods=["POST"])
@limiter.limit("10 per minute")
def search_area():

    try: 

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
    except Exception as error:
        log_action('Searching for Area', False, traceback.format_exc(), None, 'SEARCH_AREA')




if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)

