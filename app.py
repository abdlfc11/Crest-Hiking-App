from pathfinder import a_star, snap_to_largest_component, build_global_kdtree  # responsible for path generation
from flask import Flask, render_template, request, jsonify, session  # flask runs the local website
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import select
import pickle as pkl  # responsible for loading the graph file saved in a pickle file
import time
from pyproj import Transformer  # responsible for coordinate system conversions
import json  # responsible for json operations used when storing the route file
import math  # responsible for converting coordinates
from datetime import datetime, timezone  # responsible for setting a time created entry for routes saved
from scipy.spatial import KDTree # used to implement a more efficient A* algorithm
from werkzeug.security import generate_password_hash, check_password_hash
import os
import requests 
from dotenv import load_dotenv
from config import Config
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_migrate import Migrate
import networkx as nx
from datetime import timedelta


# default map centre (BNG coordinates)
default_centre = [333543, 505910]

app = Flask(__name__)

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
db = SQLAlchemy(app)
migrate = Migrate(app, db)

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


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username = db.Column(db.String(25), nullable=False, unique=True)
    password_hashed = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, default= lambda: datetime.now(timezone.utc))

    routes = db.relationship("Route", back_populates="user")
    points = db.relationship("Point", back_populates="user")

class Route(db.Model):
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    coordinates = db.Column(db.Text, nullable=False)
    format = db.Column(db.String(25), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    ETA = db.Column(db.String(100), nullable=False)
    distance = db.Column(db.String(100), nullable=False) 
    elevation_change = db.Column(db.String(20), nullable=False)

    user_id = db.Column(db.Integer, db.ForeignKey("user.id"))
    user = db.relationship("User", back_populates="routes")

class Point(db.Model):          
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(50), nullable=False, unique=True)
    coordinates = db.Column(db.String(1000), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    user_id = db.Column(db.Integer, db.ForeignKey("user.id"))
    user = db.relationship("User", back_populates="points")

# useful helper for getting the current user during route and point creation as well as logging in and out 
def get_current_user():
    username = session.get("username")
    print(username)
    if not username:
        print("no username detected")
        return None
    return User.query.filter_by(username=username).first()

# SAVED POINTS DASHBOARD
@app.route("/saved_routes")
def saved_routes():
    user = get_current_user()
    available_routes = Route.query.filter_by(user_id=user.id).all()
    return render_template("saved_routes.html", available_routes=available_routes)

# STRFTIME FILTER
@app.template_filter("strftime")
def strftime_filter(date, format):
    if isinstance(date, str):
        date = datetime.isoformat(date)
    return date.strftime(format)

# LOGGING IN AND OUT

@app.route("/login", methods=["POST"])
@limiter.limit("10 per minute")
def login():
    data = request.get_json()
    username = data.get("username", "").strip()
    password = data.get("password", "")
    user = User.query.filter_by(username=username).first()

    if user and check_password_hash(user.password_hashed, password):
        session["username"] = username
        print(session["username"])
        print(session)
        session.permanent = True  # Make session respect PERMANENT_SESSION_LIFETIME
        return jsonify({"success": True, "message": "Successfully logged in"})
    if user is None:
        return jsonify({"success": False, "message": "User does not exist"})
    else:
        return jsonify({"success": False, "message": "Username and/or Password are incorrect"})

@app.route("/logout", methods=["POST"])
@limiter.limit("10 per minute")
def logout():
    username = session.get("username", "user")
    session.pop('username', None)
    return jsonify({"success": True, "message": f"Sucessfully logged out of {username}"})
    
# REGISTERING 
@app.route("/registering", methods=["POST"])
@limiter.limit("10 per minute")
def registering():
    data = request.get_json()
    username = data.get("username", "").strip()
    p1 = data.get("password1", "")
    p2 = data.get("password2", "")

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
    
    check_user = User.query.filter_by(username=username).first()
    if check_user:
        return jsonify({"success": False, "message": "Someone has already chosen this username"})
    
    try:
        new_user = User(
            username = username,
            password_hashed = generate_password_hash(p1)
        )
        db.session.add(new_user)
        db.session.commit()
        return jsonify({"success": True, "message": "Successfully registered"})
    
    except Exception:
        return jsonify({"success": False, "message": "There was an unexpected error with our database"})

# DELETING ACCOUNT
@app.route("/delete_account", methods=["POST"])
@limiter.limit("10 per minute")
def delete_account():
    username = session.get('username')

    user = User.query.filter_by(username=username).first()
    if user:
        try:
            Route.query.filter_by(user_id=user.id).delete()
            Point.query.filter_by(user_id=user.id).delete()

            db.session.delete(user)
            db.session.commit()
            session.pop('username', None)
            return jsonify({"success": True, "message": "Successfully deleted your account"})
        except Exception as e:
            print("ERROR:", e)
            return jsonify({"success": False, "message": "Could not delete your account, try again later. "})
    return jsonify({"success": False, "message": "Could not delete your account, try again later. "})


# ROUTE CREATION  

class NodeFinder:
    def __init__(self, graph_path="Pathfinding/better_path_graph.pkl", max_distance=5000, early_exit_distance=100):
        self.graph_path = graph_path
        self._graph = None
        self._kdtree = None
        self.max_distance = max_distance
        self.early_exit_distance = early_exit_distance
        self._bng_to_web_mercator = Transformer.from_crs("EPSG:27700", "EPSG:3857", always_xy=True)
        self._bng_to_wgs84 = Transformer.from_crs("EPSG:27700", "EPSG:4326", always_xy=True)
        self._wgs84_to_web_mercator = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)

    def load_graph(self):
        # loads the graph only when needed (lazy loading)
        if self._graph is None:
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
        total_distance = 0
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
                total_distance += segment_distance
        return total_distance

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

service = NodeFinder()

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

        if len(start_coords) != 2 or len(end_coords) != 2:
            raise ValueError("Coordinates must be in format 'x, y'")

        # forms variables containing each value of the start and end coordinates with suffixes removed so that they can be used in input validaton
        start_coords_x = start_coords[0]
        start_coords_y = start_coords[1]

        # debug statement to ensure that start_coords_x and y are in the required format 
        print(start_coords_x, start_coords_y)

        end_coords_x = end_coords[0]
        end_coords_y = end_coords[1]

        all_coords = start_coords + end_coords
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
    
    for coord in path:  # converts path coordinates from bng to web mercator for display

        x, y = coord  
        
        web_x, web_y = service.convert_bng_to_web_mercator(x, y)  # converts bng to web mercator
        web_mercator_coordinates.append([web_x, web_y]) # appends coords converted into web mercator into array
    
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
        available_routes = Route.query.filter_by(user_id=user.id).all() if user else []
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
            new_point = Point(name=point_name, coordinates=coords, user_id=user.id) 
            db.session.add(new_point)
            db.session.commit()

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
        route_distance = data.get("route_distance")
        route_distance = route_distance.replace("km", "").replace("m", "").strip()
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

        route = Route(name=route_name, coordinates=coordinates_json, format=format_type, user_id=user.id, ETA=ETA, distance=route_distance, elevation_change=elevation_change)
        db.session.add(route)
        db.session.commit()

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
    
    route = Route.query.filter_by(name=route_name).first()

    if not route:
        return jsonify({"success": False, "message": "Route not found"})
    
    json_coords = json.loads(route.coordinates)


    
    
    
    # success, coordinates, file_type = db_manager.load_route(route_name)
    coordinates = json_coords
    file_type = route.format
    
    try:
        # converts wgs84 coordinates to web mercator for display
        web_mercator_coordinates = []
        bng_coordinates = []
        
        try:
            for coord in coordinates:
                if len(coord) < 2:
                    continue
                    
                lon, lat = coord[0], coord[1]
                
                # checks if coords are large (meaning they are either bng or web mercator and are not wgs84)
                if abs(lon) > 1000 or abs(lat) > 1000:
                    web_x, web_y = lon, lat 
                    
                    # converts web mercator coords into bng
                    bng_x, bng_y = service.convert_web_mercator_to_bng(lon, lat)
                    bng_coordinates.append([bng_x, bng_y])

                else:
                    # small numbers are assumed to be wgs84
                    bng_x, bng_y = service.convert_wgs84_to_bng(lon, lat)
                    bng_coordinates.append([bng_x, bng_y])
                    web_x, web_y = service.convert_bng_to_web_mercator(bng_x, bng_y)
                
                # validation checks
                if math.isnan(web_x) or math.isnan(web_y) or math.isinf(web_x) or math.isinf(web_y):
                    continue
                    
                web_mercator_coordinates.append([web_x, web_y])
        
        except Exception as e:
            return jsonify({"success": False, "message": f"Error converting coordinates: {str(e)}"})
        
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
        distance = route.distance
        elevation_change = route.elevation_change
        
        # route statistics to pass to frontend
        route_stats = {
            "total_distance": distance,
            "eta": ETA,
            "elevation_change": elevation_change
        }
        
        return jsonify({
            "success": True, 
            "message": f"Route '{route_name}' loaded successfully",
            "path_geojson": path_geojson,
            "map_centre": midpoint,
            "coordinates": web_mercator_coordinates,
            "route_stats": route_stats
        })
    
    except Exception:
        return jsonify({"success": False, "message": "The route could not be loaded"})

# flask-route which retrieves saved points to be used in the front
@app.route("/get_saved_points", methods=["GET"])
def get_saved_points():

    user = get_current_user()
    if user:
        points = Point.query.filter_by(user_id=user.id).all()
    
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
            "filename": f"{route.name}.{route.format}"
        })
    
    return jsonify({"routes": routes_list})

# route which deletes a saved point that is passed into the back-end from the front-end
@app.route("/delete_point", methods=['POST'])
@limiter.limit("110 per minute")
def delete_point():
    data = request.get_json()
    point_name = data.get('point_name', '').strip()

    if not point_name:
        return jsonify ({"success": False, "message": "Point name is missing"})
    
    try:
        point_to_delete = Point.query.filter_by(name=point_name).first()
        db.session.delete(point_to_delete)
        db.session.commit()

        return jsonify({"success": True, "message": f"Successfully deleted the {point_name} point"})

    except Exception:
        return jsonify({"success": False, "message": f"Could not successfully save the {point_name} point"})
    
    
#flask-route which deletes a route that is passed from the front-end to the back-end
@app.route("/delete_route", methods=["POST"])
@limiter.limit("110 per minute")
def delete_route():
    data = request.get_json()
    route_name = data.get("route_name")

    if not route_name:
        return jsonify({"success": False, "message": "Route name is missing"}), 400

    try:

        route = Route.query.filter_by(name=route_name).first()
        db.session.delete(route)
        db.session.commit()

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



# route which resets all values within entries and returns the user to the main-menu of the application
@app.route("/js/config.js")
def map_jinja_js():

    print("DEBUG STATEMENT : /js/config.js file reached")

    web_mercator_center = service.convert_bng_to_web_mercator(default_centre[0], default_centre[1])
    
    # gets list of available routes and points for the JavaScript
    user = get_current_user()
    if user is None:
        available_routes = []
        saved_points = []
        current_path = None
        logged_in = False
    else:
        available_routes = Route.query.filter_by(user_id=user.id).all()
        saved_points = Point.query.filter_by(user_id=user.id).all()
        current_path = session.get('current_path', None)
        logged_in = True

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
    
    response = app.make_response(render_template("js/config.js",
                           map_centre = web_mercator_center,
                           map_zoom = 10,
                           current_path = current_path,
                           saved_points = web_mercator_points,
                           logged_in = logged_in))
    response.headers['Content-Type'] = 'application/javascript'
    return response

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
    with app.app_context():
        db.create_all()
    app.run(host="0.0.0.0", port=5000, debug=True)

