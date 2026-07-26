from json import loads
from traceback import format_exception_only

from fastapi import FastAPI, Depends, APIRouter
from sqlmodel import Session, select

from db import engine
from extensions import log_action, get_current_user_jwt
from models import Point, User

router = APIRouter()

@router.get('/points/get-saved-points')
def get_saved_points(user: User | None = Depends(get_current_user_jwt)):

    if not user:
        return {"success": False, "message": "User not logged in, no saved points to load"}

    with Session(engine) as db:
        points = db.exec(
            select(Point).where(Point.user_id == user.id)
        ).all()

    if not points:
        return {"success": False, "message": "No points found", "points": []}

    web_mercator_points = []
    for point in points:
        try:
            web_mercator_x, web_mercator_y = loads(point.coordinates)
            web_mercator_points.append({
                "name": point.name,
                "coordinates": [web_mercator_x, web_mercator_y]
            })
        except Exception as e:
            short_traceback = "".join(format_exception_only(type(e), e)).strip()
            log_action('Getting Saved Points', False, short_traceback, None, 'GET_SAVED_POINT')

    return {"success": True, "points": web_mercator_points}