
#region IMPORTS

# Standard Library Imports 
import json
from traceback import format_exception_only

# Third-Party Libraries
from fastapi import APIRouter, Depends, HTTPException
from fastapi_limiter.depends import RateLimiter
from pyrate_limiter import Duration, Limiter, Rate
from sqlmodel import Session, select
from sqlalchemy.exc import IntegrityError

# Local Modules
from src.db import engine
from src.extensions import service, log_action, get_current_user
from src.models import Point, User
from .points_schemas import PointSchema

#endregion

router = APIRouter()

@router.get('/points/get-saved-points')
def get_saved_points(user: User | None = Depends(get_current_user)):

    if not user:
        raise HTTPException(
            status_code=401,
            detail={
                "success": False,
                "message": "User not logged in, no saved points to load."  
            }
        )

    with Session(engine) as db:
        points = db.exec(
            select(Point).where(Point.user_id == user.id)
        ).all()

    if not points:
        return {"success": False, "message": "No points found", "points": []}

    wgs84_points = []
    for point in points:
        try:
            coord_x, coord_y = json.loads(point.coordinates)

            # converts coordinates to Lon/Lat if it detects web mercator coordinates (via not Lon/Lat condition)
            if abs(coord_x) > 181 or abs(coord_y) > 181:
                coord_x, coord_y = service.convert_web_mercator_to_wgs84(coord_x, coord_y)

            wgs84_points.append({
                "name": point.name,
                "coordinates": [coord_x, coord_y]
            })
        except Exception as e:
            short_traceback = "".join(format_exception_only(type(e), e)).strip()
            log_action('Getting Saved Points', False, short_traceback, None, 'GET_SAVED_POINT')

    return {
        "success": True,
        "points": wgs84_points
    }

# route which saves a user-chosen point on the map
@router.post(
    '/points/save-point',
    dependencies=[Depends(RateLimiter(limiter=Limiter(Rate(10, Duration.MINUTE * 1))))] # 10 calls per minute 
)
def save_point(
    point: PointSchema,
    user: User | None = Depends(get_current_user)
):

    if not user:
        
        raise HTTPException(
            status_code=401,
            detail={
                "success": False,
                "message": "Please Login to save points." # used by the frontend as the login modal body text 
            }
        )

    # this retrieves the details of the point from the pydantic base model

    point_name = point.point_name
    lon = point.lon
    lat = point.lat
    
    try:

        # this validates that lat/lon are present
        if lon is None or lat is None:
            raise HTTPException(
                status_code=422,
                detail={
                    "success": False,
                    "message": "Invalid coordinate format. Point must include lon and lat."
                }
            )

        coords = json.dumps([float(lon), float(lat)])

        with Session(engine) as db:
            new_point = Point(name=point_name, coordinates=coords, user_id=user.id) 
            db.add(new_point)
            db.commit()

            log_action('Saving Point', True, None, None, 'SAVING_POINT')

        return {"success": True, "message": 'Successfully saved the point'}
    
    except IntegrityError as exception:
        raise HTTPException(
            status_code=409,
            detail={
                "success": False,
                "message": "A point already exists with that name, use a different name."
            }
        ) from exception

    except HTTPException:
        raise
    
    # if float() fails
    except ValueError as e:

        short_traceback = "".join(format_exception_only(type(e), e)).strip()     
        log_action('Saving Point', False, short_traceback, None, 'SAVING_POINT')

        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "message": "Invalid coordinate format. Coordinates must be numbers."
            }
        )
        
    except Exception as e:

        with Session(engine) as db: 

            short_traceback = "".join(format_exception_only(type(e), e)).strip()
        
            log_action('Saving Point', False, short_traceback, None, 'SAVING_POINT')

        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "message": "Failed to save point."
            }
        )

# route which deletes a saved point that is passed into the back-end from the front-end
@router.post(
    "/points/delete-point",
    dependencies=[Depends(RateLimiter(limiter=Limiter(Rate(110, Duration.MINUTE * 1))))])
def delete_point(
    point: PointSchema,
    user: User | None = Depends(get_current_user)
):

    if not user:

        raise HTTPException(
            status_code=401,
            detail={
                "success": False,
                "message": "Unauthenticated attempt to delete point"
            }
        )

    point_name = point.point_name

    if not point_name:
        
        raise HTTPException(
            status_code=400,
            detail= {
                "success": False,
                "message": "Point name is missing"
            }
        )
    
    try:
        with Session(engine) as db:

            point_to_delete = db.exec(
                select(Point)
                .where(Point.name == point_name, Point.user_id == user.id)
            ).first()

            if not point_to_delete:
                
                raise HTTPException(
                    status_code=404,
                    detail={
                        "success": False,
                        "message": "Point to be deleted could not be found"
                    }
                )

            db.delete(point_to_delete)
            db.commit()

            log_action('Deleting Point', True, None, None, 'DELETE_POINT')

            return {"success": True, "message": f"Successfully deleted the {point_name} point"}

    except Exception as e:

        short_traceback = "".join(format_exception_only(type(e), e)).strip()
        
        log_action('Deleting Point', False, short_traceback, None, 'DELETE_POINT')

        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "message": f"Could not successfully save the {point_name} point"
            }
        )