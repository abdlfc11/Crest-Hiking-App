#region IMPORTS

# Standard Library Imports 
import json
import traceback

# Third-Party Libraries
from sqlmodel import Session, select
from flask import (
    Blueprint,
    jsonify,
    request,
)

# Local Modules
from db import engine
from extensions import limiter, log_action, get_current_user
from models import Point

#endregion


point_api_bp = Blueprint("point_api", __name__)


# route which saves a user-chosen point on the map
@point_api_bp.route("/save_point", methods=["POST"])
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

# flask-route which retrieves saved points to be used in the front
@point_api_bp.route("/get_saved_points", methods=["GET"])
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
@point_api_bp.route("/delete_point", methods=['POST'])
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

