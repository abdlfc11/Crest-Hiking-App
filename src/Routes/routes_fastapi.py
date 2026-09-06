# IMPORTS

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
from fastapi import APIRouter, Depends, HTTPException, Request, Response, File, UploadFile
from fastapi.responses import StreamingResponse
from fastapi_limiter.depends import RateLimiter
from pyrate_limiter import Duration, Limiter, Rate

# Local Modules
from src.db import get_session, engine

from src.models import Route, User

from src.constants import DEFAULT_CENTRE

from src.extensions import (
    service,
    log_action,
    get_current_user,
    get_user_from_session_id,
    rate_limit_exceeded_callback
)
from src.Routes.routes_schemas import (
    CalculateRouteModel,
    SaveRouteModel,
    LoadRouteModel,
    DeleteRouteModel,
    DownloadRouteModel,
    NormaliseRouteModel
)

from src.Routes.helpers import (
    check_elevation, 
    check_web_mercator, 
    generate_geojson, 
    generate_gpx, 
    normalise_route,
    extract_kml_coords,
    isRoughlyInCumbria
)

router = APIRouter()

# FASTAPI ROUTES 

#region Normalised Stats
@router.post(
    '/routing/normalise-route-stats',
    dependencies=[
        Depends(
            RateLimiter(
                limiter=Limiter(Rate(60, Duration.MINUTE)),
                callback=rate_limit_exceeded_callback
            )
        )
    ]
)
def calculate_path(
    data: NormaliseRouteModel
):
    try: 
        routeStats = normalise_route(data.coordinates)

        return routeStats
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "message": "There was an error normalising route stats. "
            }
        )
#endregion

#region Calculating Path 

@router.post(
    '/routing/calculate-path',
    dependencies=[
        Depends(
            RateLimiter(
                limiter=Limiter(Rate(60, Duration.MINUTE)),
                callback=rate_limit_exceeded_callback
            )
        )
    ]
)
def calculate_path(
    data: CalculateRouteModel,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_session)
):
    try: 

        # this extracts start + end point coordinates
        start_array = data.start_point
        end_array = data.end_point

        # this loads the graph into memory 
        graph = service.load_graph() 
        
        # Validation of coord format 
        if not isinstance(start_array, list) or not isinstance(end_array, list):
            raise TypeError("Start and end coordinates are required as arrays")

        if len(start_array) < 2 or len(end_array) < 2:
            raise ValueError("Coordinates must be in format [x, y]")
        

        # this extracts the raw numerical coordinates
        start_coords_x, start_coords_y = start_array[0], start_array[1]
        end_coords_x, end_coords_y = end_array[0], end_array[1]

        if not isRoughlyInCumbria(start_coords_x, start_coords_y) or not isRoughlyInCumbria(end_coords_x, end_coords_y):

            raise HTTPException(
                status_code=400,
                detail={
                    "success": False,
                    "message": "Coordinates outside of Cumbria entered",
                    "user_message": "Please enter coordinates within Cumbria. "
                }
            )

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
        
    except (KeyError, ValueError, TypeError) as e:
        # This is wrapped in a try/except fallback block so that if logging functions fail, the program doesn't crash 
        try:
            with Session(engine) as db:
                if user:
                    db_routes = db.exec(
                        select(Route)
                        .where(Route.user_id == user.id)
                    ).all()

                    # This converts SQLModel objects to serialisable dictionaries
                    available_routes = [r.model_dump() for r in db_routes]
                else:
                    available_routes = []

                short_traceback = "".join(traceback.format_exception_only(type(e), e)).strip()
                log_action('Calculating Path', False, short_traceback, None, 'INVALID_COORDS_AUTO_PATH_CREATION')
        except Exception as logging_error:
            short_traceback = "".join(traceback.format_exception_only(type(logging_error), logging_error)).strip()
            log_action('Calculating Path', False, short_traceback, None, 'INVALID_COORDS_AUTO_PATH_CREATION')
            available_routes = []
        
        raise HTTPException(
            status_code=422,
            detail={
                "success": False,
                "map_centre": DEFAULT_CENTRE,
                "available_routes": available_routes, 
                "message": str(e),
                "user_message": "Invalid coordinates, please try again."
            }
        ) from e

    try:
        # This builds the route using the Web Mercator coordinates
        path, start_node, end_node, time_taken = service.build_route(s_x, s_y, e_x, e_y)

        if not path:  
            with Session(engine) as db:
                if user:
                    db_routes = db.exec(
                        select(Route)
                        .where(Route.user_id == user.id)
                    ).all()

                    # This ( r.model.dump() ) converts SQLModel objects to serialisable dictionaries
                    available_routes = [r.model_dump() for r in db_routes]
                else:
                    available_routes = []
                    

                log_action('Calculating Path', False, 'Path not created', None, 'NO_PATH_FOUND')

                raise HTTPException(
                    status_code=500,
                    detail={
                        "success": False,
                        "map_centre": DEFAULT_CENTRE,
                        "available_routes": available_routes,
                        "message": "No path could be created",
                        "user_message": "Sorry, path could not be generated, please try again later."
                    }
                ) 

        web_mercator_coordinates = [] 
        
        # this populates 'web_mercator_coordinates' in the format [ [x1, y1, elev1], ... ]
        for node in path:  
            x, y = node  
            node_id = service.node_to_id[node]
            elev = graph.vs[node_id]['elev'] if 'elev' in graph.vs.attributes() else None
            if elev is not None:
                web_mercator_coordinates.append([x, y, elev])
            else:
                web_mercator_coordinates.append([x, y])

        elevation_gain = 0
        elevation_change = 0
        
        # this calculates the elevation GAIN
        for node1, node2 in zip(path, path[1:]):
            node1_id = service.node_to_id[node1]
            node2_id = service.node_to_id[node2]
            elev1 = graph.vs[node1_id]['elev'] if 'elev' in graph.vs.attributes() else None
            elev2 = graph.vs[node2_id]['elev'] if 'elev' in graph.vs.attributes() else None

            if elev1 is not None and elev2 is not None:
                elevation_gain += max(0, elev2 - elev1)

        # this calculates the elevation CHANGE
        start_node_id = service.node_to_id[start_node]
        end_node_id = service.node_to_id[end_node]
        
        # This pulls values safely and guard float conversion to avoid NoneType int conversion crashes
        start_elev_val = graph.vs[start_node_id]['elev'] if 'elev' in graph.vs.attributes() else None
        end_elev_val = graph.vs[end_node_id]['elev'] if 'elev' in graph.vs.attributes() else None
        
        start_elevation = int(start_elev_val) if start_elev_val is not None else 0
        end_elevation = int(end_elev_val) if end_elev_val is not None else 0

        elevation_change = end_elevation - start_elevation
        
        start_coords = web_mercator_coordinates[0]
        end_coords = web_mercator_coordinates[-1]

        # builds the coordinate array of [lon, lat, elev] points
        # this is what is returned when the API is called 
        wgs84_coordinates = [] 
        for coord in web_mercator_coordinates:
            lon, lat = service.convert_web_mercator_to_wgs84(coord[0], coord[1])
            if len(coord) >= 3:
                wgs84_coordinates.append([lon, lat, coord[2]])
            else:
                wgs84_coordinates.append([lon, lat])

        start_coords = wgs84_coordinates[0]
        end_coords = wgs84_coordinates[-1]

        # This calculates distance and eta statistics
        total_distance = service.calculate_route_distance(path)
        total_distance_km = total_distance / 1000
        
        # Calculates ETA 
        # NOTE : this is in SECONDS
        eta_seconds = normalise_route(wgs84_coordinates)['eta_seconds']

        path_geojson = {
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": wgs84_coordinates},
            "properties": {"color": "#2563eb"}
        } 
        
        # calculates optimal map centre + zoom using internal Web Mercator
        # then converts centre to lat/lon to send to the frontend
        map_centre_mercator, map_zoom = service.calculate_map_center_and_zoom(web_mercator_coordinates)
        map_centre = list(service.convert_web_mercator_to_wgs84(map_centre_mercator[0], map_centre_mercator[1]))

        route_stats = {
            "start_elevation": start_elevation,
            "end_elevation": end_elevation,
            "elevation_change": elevation_change,
            "elevation_gain": elevation_gain, 
            "total_distance": round(total_distance_km, 2),
            "eta_seconds": eta_seconds
        }

        log_action('Calculating Path', True, f"distance: {round(total_distance_km, 2)}km", time_taken, 'PATH_CREATED')

        if user:
            with Session(engine) as db:
                db_routes = db.exec(
                    select(Route)
                    .where(Route.user_id == user.id)
                ).all()

                # This converts SQLModel objects to serialisable dictionaries
                available_routes = [r.model_dump() if hasattr(r, 'model_dump') else r.dict() for r in db_routes]
        else:
            available_routes = []
                
        return {
            "success": True,
            "pathGeoJSON": path_geojson,
            "map_centre": map_centre,
            "map_zoom": map_zoom,
            "route_stats": route_stats,
            "coordinates": wgs84_coordinates,
            "startCoord": start_coords,
            "endCoord": end_coords
        }

    except HTTPException:
        raise
    except Exception as general_error:
        # This catch-all Exception ensures that any unanticipated errors return a clean JSON payload with the error output

        short_traceback = "".join(traceback.format_exception_only(type(general_error), general_error)).strip()
        log_action('Calculating Path', False, short_traceback, None, 'INVALID_COORDS_AUTO_PATH_CREATION')

        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "map_centre": DEFAULT_CENTRE,
                "available_routes": [],
                "message": "Routing : HTTP 500 Error",
                "user_message": "Sorry, there was an unexpected error whilst creating your route, please try again later."
            }
        )

#endregion

#region Saving Route

@router.post(
    '/routing/save-route',
    dependencies=[
        Depends(
            RateLimiter(
                limiter=Limiter(Rate(110, Duration.MINUTE)),
                callback=rate_limit_exceeded_callback
            )
        )
    ]
)
def save_route(
    data: SaveRouteModel,
    db: Session = Depends(get_session),
    user: User = Depends(get_current_user)
):
    try:

        if not user: 

            raise HTTPException(
                status_code=401,
                detail={
                    "success": False,
                    "message": "Unauthenticated attempt to save a route.",
                    "user_message": "Please log in to save routes. "
                }
            )

        route_name = data.route_name
        coordinates = data.coordinates # these are in Lon, Lat format

        if not route_name or not route_name.strip():

            raise HTTPException(
                status_code=422,
                detail={
                    "success": False,
                    "message": "A route name is required. ",
                    "user_message": "A route name is required, please try again."
                }
            )
        

        if not coordinates or len(coordinates) < 2:

            raise HTTPException(
                status_code=422,
                detail={
                    "success": False,
                    "message": "Invalid route data",
                    "user_message": "The route data is invalid. Please try again."
                }
            )
        
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

        return {
            "success": True,
            "route_info": route_info
        }


    except IntegrityError as e:
        db.rollback()

        short_traceback = "".join(traceback.format_exception_only(type(e), e)).strip()

        log_action('Saving Route', False, short_traceback, None, 'SAVE_ROUTE')

        raise HTTPException(
            status_code=422,
            detail={
                "success": False,
                "message": "ERROR : route name cannot be the same as other routes.",
                "user_message": "A route with this name already exists. Please pick a new name."
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()

        short_traceback = "".join(traceback.format_exception_only(type(e), e)).strip()
        
        log_action('Saving Route', False, short_traceback, None, 'SAVE_ROUTE')

        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "message": "There was an error saving your route. "
            }
        )

#endregion

#region Loading Route 

@router.post(
    "/routing/load-route",
    dependencies=[
        Depends(
            RateLimiter(
                limiter=Limiter(Rate(110, Duration.MINUTE)),
                callback=rate_limit_exceeded_callback
            )
        )
    ]
)
def load_route(
    data: LoadRouteModel,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_session)
):

    if not user:
        
        raise HTTPException(
            status_code=401,
            detail={
                "success": False,
                "message": "Unauthenticated attempt to load a route.",
                "user_message": "Please Login to load routes."
            }
        )

    route_name = data.route_name
    
    if not route_name:

        raise HTTPException(
            status_code=422,
            detail={
                "success": False,
                "message": "Route name is required.",
                "user_message": "A route name is required, please try again."
            }
        )
    

    route = db.exec(
        select(Route)
        .where(Route.name == route_name, Route.user_id==user.id)
    ).first()

    if not route:

        raise HTTPException(
            status_code=404,
            detail={
                "success": False,
                "message": "The route could not be found in the server. ",
                "user_message": "Sorry, the route could not be found in the server."
            }
        )
    
    json_coords = json.loads(route.coordinates)

    coordinates = json_coords

    has_elevation = check_elevation(coordinates)
    
    try:
        wgs84_coordinates = []

        # routes saved prior to switch to Lat/Lon projection for storing routes will have coordinates stored in Web Mercator projection
        # this checks these coordinates and converts them to Lon/Lat if Web Mercator coordinates are found
        if check_web_mercator(coordinates[0]):
            for coord in coordinates:
                x, y = coord[0], coord[1]
                z = coord[2] if len(coord) >= 3 else 0   # default elevation = 0
                lon, lat = service.convert_web_mercator_to_wgs84(x, y)
                wgs84_coordinates.append([lon, lat, z])
        else:
            # already lat/lon: normalise lengths
            for coord in coordinates:
                x, y = coord[0], coord[1]
                z = coord[2] if len(coord) >= 3 else 0
                wgs84_coordinates.append([x, y, z])

        if not wgs84_coordinates:

            log_action('Loading Route', False, "No coordinates found in the route", None, 'LOAD_ROUTE')

            raise HTTPException(
                status_code=422,
                detail={
                    "success": False,
                    "message": "There are no valid coordinates within the route file. ",
                    "user_message": "Sorry, the coordinates in the file are not valid. "
                }
            )
        
        # converts coordinates to geojson format for display
        path_geojson = {
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": wgs84_coordinates},
                "properties": {"color": "#2563eb"}
            }]
        }
        
        
        # calculates midpoint for map centring
        midpoint = wgs84_coordinates[len(wgs84_coordinates)//2] if wgs84_coordinates else DEFAULT_CENTRE

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
        
        return {
            "success": True, 
            "message": f"Route '{route_name}' loaded successfully",
            "pathGeoJSON": path_geojson,
            "map_centre": midpoint,
            "coordinates": wgs84_coordinates,
            "route_stats": route_stats
        }

    except HTTPException:
        raise
    
    except Exception as e:

        short_traceback = "".join(traceback.format_exception_only(type(e), e)).strip()
        
        log_action('Loading Route', False, short_traceback, None, 'LOAD_ROUTE')

        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "message": "Sorry, there was an unexpected error whilst loading your route. "
            }
        )

#endregion

#region Delete Route 

@router.post(
    "/routing/delete-route",
    dependencies=[
        Depends(
            RateLimiter(
                limiter=Limiter(Rate(110, Duration.MINUTE)),
                callback=rate_limit_exceeded_callback
            )
        )
    ]
)
def delete_route(
    data: DeleteRouteModel,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_session)
):
    route_name = data.route_name

    if not user:
        
        raise HTTPException(
            status_code=401,
            detail={
                "success": False,
                "message": "Unauthenticated attmept to delete route",
                "user_message": "Please log in to delete routes."
            }
        )


    if not route_name:

        raise HTTPException(
            status_code=422,
            detail={
                "success": False,
                "message": "Route name is required.",
                "user_message": "A route name is required, please try again."
            }
        )

    try:

        route = db.exec(
            select(Route)
            .where(Route.name == route_name, Route.user_id == user.id)
        ).first()
        
        if not route:

            raise HTTPException(
                status_code=404,
                detail={
                    "success": False,
                    "message": "Route to be deleted could not be found",
                    "user_message": "Could not find the route you want to delete."
                }
            )
        deleted_route_name = route.name
        db.delete(route)
        db.commit()

        return {
            "success": True,
            "message": f"Successfully deleted the route : {deleted_route_name}"
        }

    except HTTPException:
        raise
    except Exception as e:

        short_traceback = "".join(traceback.format_exception_only(type(e), e)).strip()
        
        log_action('Deleting Route', False, short_traceback, None, 'DELETE_ROUTE')

        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "message": "Sorry, there was an unexpected error whilst trying to delete your route. "
            }
        )

#endregion

#region Import Route

@router.post(
    "/routing/import-route-file",
    dependencies=[
        Depends(
            RateLimiter(
                limiter=Limiter(Rate(110, Duration.MINUTE)),
                callback=rate_limit_exceeded_callback
            )
        )
    ]
)
async def import_route(
    route_file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_session)
):
    """
    This function handles route file uploads for GPX, FIT, KML, and GeoJSON formats.

    it received as parameters:
        - route file

    it returns:
        JSON containing:
            success (bool)
            coords (list of [lat, lon, ele?])
    """

    MAX_FILE_MB = 5

    if not user:

        raise HTTPException(
            status_code=401,
            detail={
                "success": False,
                "message": "Please Login to import files. "
            }
        )

    if not route_file:

        log_action('Importing Route', False, 'Uploaded file could not be retrieved', None, 'IMPORT_ROUTE')

        raise HTTPException(
            status_code=422,
            detail={
                "success": False,
                "message": "Cannot receive uploaded file",
                "user_message": "We could not receive the uploaded file, please try again later."
            }
        )
    
    if route_file.size > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=422,
            detail={
                "success": False,
                "message": "Imported route is too large. ",
                "user_message": "Imported route is too large, please pick a route under 5MB in size. "
            }
        )
    
    try: 
    
        # this extracts the filename and file extension
        filename = route_file.filename or ""
        ext = filename.rsplit('.', 1)[-1].lower() if "." in filename else ""

        # this validates the supported formats 
        if ext not in ["gpx", "fit", "kml", "geojson"]:

            raise HTTPException(
                status_code=400,
                detail={
                    "success": False,
                    "message": "ERROR : Unsupported file type",
                    "user_message": "Please upload a file of the supported types. "
                }
            )
        
        # this reads raw bytes asynchronously (works for both binary + text formats) for FIT file type
        raw = await route_file.read()

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

                if len(point) > 2:
                    lat, lon, ele = point[0], point[1], point[2]
                else:
                    lat, lon, ele = point[0], point[1], 0

                converted_points.append([lon, lat, ele])

            log_action('Importing Route', True, ext, None, 'IMPORT_ROUTE')

            return {
                "success": True,
                "coords": converted_points,
            }

        # this handles FIT file types
        elif ext == "fit":
            coords = []
            converted_coords = []
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
            
            for coord in coords:
                
                lat, lon = coord[0], coord[1]

                converted_coords.append([lon, lat])

            log_action('Importing Route', True, ext, None, 'IMPORT_ROUTE')

            return {
                "success": True,
                "coords": converted_coords
            }

        # this handles KML file types
        elif ext == "kml":

            # moves file pointer back to the first byte to allow the entire file to be read 
            await route_file.seek(0)

            doc = KML.parse(route_file.file, strict=False)
            kml_coords = extract_kml_coords(doc)

            # extract_kml_coords returns [lat, lon, ele] (KML native)
            # this normalises to the app's [lon, lat, ele] format.
            coords = [
                [c[1], c[0], c[2]] if len(c) >= 3 else [c[1], c[0], 0]
                for c in kml_coords
            ]
            
            # logging is commented out as KML imports are not fully supported --> prevents false positives 
            # log_action('Importing Route', True, ext, None, 'IMPORT_ROUTE')

            return {
                "success": True,
                "coords": coords
            }

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

                    raise HTTPException(
                        status_code=500,
                        detail={
                            "success": False,
                            "message": "There was an error on our end, please try again later."
                        }
                    )

            # this is for processing LineString geometries
            for geom in geometries:
                if geom and geom.get("type") == "LineString":
                    for coord in geom.get("coordinates", []):
                        # this unpacks the values from each coord

                        if len(coord) <= 1:
                            return {
                                "success": False,
                                "message": "Error whilst parsing GeoJSON: given coordinates have one value only"
                            }

                        lon = coord[0]
                        lat = coord[1]
                        ele = coord[2] if len(coord) > 2 else 0

                        coords.append([lon, lat, ele])
            
            log_action('Importing Route', True, ext, None, 'IMPORT_ROUTE')

            return {
                "success": True,
                "coords": coords
            }
        
    except HTTPException:
        raise
    except Exception as e:
            
            short_traceback = "".join(traceback.format_exception_only(type(e), e)).strip()

            log_action('Importing Route', False, short_traceback, None, 'IMPORT_ROUTE')

            raise HTTPException(
                        status_code=500,
                        detail={
                            "success": False,
                            "message": "There was an error on our end, please try again later."
                        }
                    )

#endregion

#region Downloading Route 

@router.post(
    "/routing/download-route",
    dependencies=[
        Depends(
            RateLimiter(
                limiter=Limiter(Rate(110, Duration.MINUTE)),
                callback=rate_limit_exceeded_callback
            )
        )
    ]
)
def download_route_file(
    data: DownloadRouteModel,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_session)
):

    if not user:

        raise HTTPException(
            status_code=401,
            detail={
                "success": False,
                "message": "Unauthenticated attempt to download a route"
            }
        )
    
    route_name = data.route_name
    file_type = data.route_type

    # ensures that routes have a name (defensive programming since it is almost impossible a route doesn't have a name due to design of app)
    if not route_name or not file_type:

        raise HTTPException(
            status_code=422,
            detail={
                "success": False,
                "message": "Route name and file type is required. ",
                "user_message": "Both the route name and route file type are required, please try again."
            }
        )

    # ensures that routes have a file type 
    # also impossible that this is the case since download occurs through either a gpx or a geojson button and not path / query params
    # as path / query params may be implemented in the future, it is kept + it is a good habit 
    if file_type not in ["gpx", "geojson"]:

        raise HTTPException(
            status_code=422,
            detail={
                "success": False,
                "message": "Invalid file type. Use 'gpx' or 'geojson' format. ",
                "user_message": "Invalid file type. Download routes as 'gpx' or 'geojson'."
            }
        )


    route = db.exec(
        select(Route)
        .where(Route.name == route_name, Route.user_id == user.id)
    ).first()
    
    # ensures that a route is found before attempting to convert
    if not route:

        log_action('Downloading Route', False, 'Route not found', None, 'DOWNLOAD_ROUTE')

        raise HTTPException(
            status_code=404,
            detail={
                "success": False,
                "message": "Route not found or you don't own it",
                "user_message": "Could not download the route. Check that it exists and belongs to you."
            }
        )


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

        

        file_io = io.BytesIO(content.encode('utf-8'))

        log_action('Downloading Route', True, extension, None, 'DOWNLOAD_ROUTE')

        return StreamingResponse(
            file_io,
            media_type=mimetype,
            headers={
                "Content-Disposition": f'attachment; filename="{safe_name}.{extension}"'
            }
        )

    except HTTPException:
        raise
    except Exception as e:

        short_traceback = "".join(traceback.format_exception_only(type(e), e)).strip()

        log_action('Downloading Route', False, short_traceback, None, 'DOWNLOAD_ROUTE')

        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "message": "Sorry, there was an unexpected error, try again later. "
            }
        )


#endregion





