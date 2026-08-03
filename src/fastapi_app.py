#region IMPORTS 

# Core Library Imports
import os
import json
from datetime import datetime
from pathlib import Path

# Third Party Library Imports
from fastapi import FastAPI, Request, Depends, HTTPException 
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.exceptions import HTTPException as StarletteHTTPException
import traceback
from sqlmodel import Session, select

# Local Module Imports
from src.extensions import service, get_current_user, log_action
from src.constants import DEFAULT_CENTRE, DEFAULT_ZOOM
from src.models import User, Route, Settings, Point
from src.config import Config
from src.db import get_session, engine # get_session used for fastapi routes and engine used for short-lived Session instances in JINJA templates 

from src.Points.points_fastapi import router as points_router
from src.Report_Issue.report_issue_fastapi import router as report_issue_router
from src.Auth.auth_fastapi import router as auth_router
from src.Settings.setings_fastapi import router as settings_router
from src.Routes.routes_fastapi import router as routes_router
from src.Error_Logging.error_logging import router as error_logging_router
from src.Search.search_fastapi import router as search_router

#endregion

#region INITIALISATION

# Absolute paths to make the correct path for static and template files no matter current environment 
BASE_DIR = Path(__file__).resolve().parent.parent   # project root
STATIC_DIR = BASE_DIR / "static"
TEMPLATES_DIR = BASE_DIR / "templates"

app = FastAPI()

# This mounts static files with a name so url_for('static', ...) works
app.mount(
    "/static",
    StaticFiles(directory=str(STATIC_DIR)),
    name="static",
)

# External Local API routers 
app.include_router(points_router)
app.include_router(report_issue_router)
app.include_router(auth_router)
app.include_router(settings_router)
app.include_router(routes_router)
app.include_router(error_logging_router)
app.include_router(search_router)

templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

#endregion

#region JINJA TEMPLATES 

def format_distance(
    distance_km,
):
    with Session(engine) as db:
        try:
            distance_unit = db.exec(
                select(Settings.value).where(Settings.key == "distanceUnit")
            ).first()
            if distance_unit == "km" or distance_unit is None:
                return f"{round(distance_km, 2)} km"
            elif distance_unit == "miles":
                return f"{round(distance_km * 0.621371, 2)} mi"
        except Exception as e:
            log_action('Template filter for distance unit', False, e, None, 'TEMPLATE_FILTER: DISTANCE UNIT')

def format_elevation(elevation_gain):
    if not isinstance(elevation_gain, int) or isinstance(elevation_gain, float):
        elevation_gain = int(float(elevation_gain))
    return f"+{elevation_gain} m" if elevation_gain >= 0 else f"{elevation_gain} m"

def format_eta(seconds):
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    return f"{minutes}m" if hours == 0 else f"{hours}h {minutes}m"

def strftime_filter(date, format: str):
    if isinstance(date, str):
        date = datetime.fromisoformat(date)  # note: datetime.isoformat is wrong the other way around, this was likely a bug in the Flask version too
    return date.strftime(format)

templates.env.filters["format_distance"] = format_distance
templates.env.filters["format_elevation"] = format_elevation
templates.env.filters["format_eta"] = format_eta
templates.env.filters["strftime"] = strftime_filter

#endregion

# Error handling ( only returns templates of error pages that exist )

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    if exc.status_code in (404, 405, 500):
        return templates.TemplateResponse(
            request=request,
            name=f"Error-Pages/{exc.status_code}.html",
            context={"request": request},
            status_code=exc.status_code,
        )

    return JSONResponse(
        status_code=exc.status_code,
        content=exc.detail if isinstance(exc.detail, (dict, list)) else {"detail": exc.detail},
    )
# Graph initialisation
if os.getenv("LOAD_GRAPH_ON_IMPORT", "1").lower() not in ("0", "false", "no"):
    service.load_graph()

# View endpoints
@app.get("/")
def root_url():
    return RedirectResponse(url="/map")

@app.get("/login-page", response_class=HTMLResponse)
def login_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="login.html",
        context={"request": request},
    )

@app.get('/register-page', response_class=HTMLResponse)
def register_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name='register.html',
        context={'request': request}
    )

@app.get('/privacy-policy', response_class=HTMLResponse)
def privacy_policy(request: Request):
    return templates.TemplateResponse(
        request=request,
        name='privacy-policy.html',
        context={'request': request}
    )

# Main Map view endpoint

@app.get('/map', response_class=HTMLResponse)
def map_view(
    request: Request,
    user: User | None = Depends(get_current_user),
    db: Session = Depends(get_session)
):

    if not user:
        available_routes = []
        saved_points = []
        
        return templates.TemplateResponse(
            request=request,
            name='map.html',
            context = {
                'request': request,
                "map_centre": DEFAULT_CENTRE,
                "map_zoom": 10.5,
                "available_routes": available_routes,
                "saved_points": saved_points,
                "logged_in": "false",
                "config": Config,
                "user": None
            }
        )
    
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
        
        return templates.TemplateResponse(
            request=request,
            name='map.html',
            context = {
                'request': request,
                "map_centre": DEFAULT_CENTRE,
                "map_zoom": 10.5,
                "available_routes": available_routes,
                "saved_points": saved_points,
                "logged_in": "true",
                "config": Config,
                "user": user
            }
        )
    except Exception as e:

        short_traceback = "".join(traceback.format_exception_only(type(e), e)).strip()

        log_action('Loading Map', False, short_traceback, None, 'LOAD_MAP')

        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "message": "Error whilst getting map"
            }
        )