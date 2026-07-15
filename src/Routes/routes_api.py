#region IMPORTS

# Standard Library Imports 
import io
import json
import traceback

# Third-Party Libraries
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select
import gpxpy
from fastkml.kml import KML
from fitparse import FitFile
from flask import (
    Blueprint,
    jsonify,
    request,
    send_file,
)

# Local Modules
from db import engine
from models import Route
from constants import DEFAULT_CENTRE
from extensions import service, limiter, log_action, get_current_user
from Routes.helpers import (
    check_elevation, 
    check_web_mercator, 
    get_xy, 
    generate_geojson, 
    generate_gpx, 
    normalise_route,
    extract_kml_coords,
    isRoughlyInCumbria
)


#endregion

#region INITIALISATION

route_api_bp = Blueprint("route_api", __name__)

#endregion

# route which forms a path from the set of points the back-end receives as coordinates and returns it to the front-end
@route_api_bp.route("/calculate_path", methods=["POST"])
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

        if not isRoughlyInCumbria(start_coords_x, start_coords_y) or not isRoughlyInCumbria(end_coords_x, end_coords_y):
            return jsonify({"success": False, "message": "Please enter coordinates within Cumbria. "})

        all_coords = [start_coords_x, start_coords_y, end_coords_x, end_coords_y]
        if not all(isinstance(num, (int, float)) for num in all_coords):
            raise ValueError("Coordinates must be valid numbers")
        
        s_x, s_y = start_coords_x, start_coords_y 
        e_x, e_y = end_coords_x, end_coords_y 
        
        
        # COORD PROJECTION TYPE DETECTION
        # Lat / Lon coordinates will be small numbers, whereas web mercator uses large values in metres
        # NOTE : as of July 2026 only web mercator is available, though WGS84 projection is planned so this remains 
    
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
            "map_centre": DEFAULT_CENTRE,
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
                "map_centre": DEFAULT_CENTRE,
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

    elevation_gain = 0
    elevation_change = 0
    
    # this calculates the elevation GAIN
    for node1, node2 in zip(path, path[1:]):
        elev1 = graph.nodes.get(node1, {}).get('elev')
        elev2 = graph.nodes.get(node2, {}).get('elev')

        if elev1 is not None and elev2 is not None:
            elevation_gain += max(0, elev2 - elev1)

    # this calculates the elevation CHANGE
    start_elevation = int(graph.nodes[start_node]['elev'])
    end_elevation = int(graph.nodes[end_node]['elev'])

    elevation_change = end_elevation - start_elevation
    
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

    route_stats = {
        "start_elevation": start_elevation,
        "end_elevation": end_elevation,
        "elevation_change": elevation_change,
        "elevation_gain": elevation_gain, 
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

# flask-route which is used to save a route that has been passed into the backend into the PostgreSQL database 
@route_api_bp.route("/save_route", methods=["POST"])
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
@route_api_bp.route("/load_route", methods=["POST"])
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
            midpoint = web_mercator_coordinates[len(web_mercator_coordinates)//2] if web_mercator_coordinates else DEFAULT_CENTRE

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
@route_api_bp.route("/download_route", methods=["POST"])
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

@route_api_bp.route("/import_route_file", methods=["POST"])
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
            uploaded_file.stream.seek(0)
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
                    log_action('Importing Route', False, 'Invalid GeoJSON Structure', None, "IMPORT_ROUTE")
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

#flask-route which deletes a route that is passed from the front-end to the back-end
@route_api_bp.route("/delete_route", methods=["POST"])
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


