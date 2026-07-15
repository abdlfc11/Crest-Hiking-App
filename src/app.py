#region IMPORTS

# Standard Library Imports 
import json
import math
import os
import traceback
from datetime import datetime


# Third-Party Libraries
import requests
from flask import (
    Flask,
    jsonify,
    redirect,
    render_template,
    request,
    session,
    url_for,
)
from sqlmodel import Session, select

# Local Modules
from config import Config
from db import engine
from models import Point, Route, Settings
from constants import DEFAULT_CENTRE
from extensions import limiter, service, log_action, get_current_user

from Routes.routes_api import route_api_bp
from Points.points_api import point_api_bp
from Auth.auth_api import auth_api_bp
from Settings.settings_api import settings_api_bp
from Report_Issue.report_issue_api import report_issues_bp

#endregion

#region App Initialisation and General Configs 

app = Flask(
    __name__, 
    template_folder='../templates', 
    static_folder='../static'
)

# Binding limiter to specific app instance
limiter.init_app(app)

# Registering Blueprints
app.register_blueprint(route_api_bp)
app.register_blueprint(point_api_bp)
app.register_blueprint(auth_api_bp)
app.register_blueprint(settings_api_bp)
app.register_blueprint(report_issues_bp)

# Configuration Keys
app.config.from_object(Config)
app.secret_key = Config.SECRET_KEY
locationiq_api_key = Config.LOCATIONIQ_API_KEY
app.config["SQLALCHEMY_DATABASE_URI"] = Config.DATABASE_URI

# Environment Specifics
if os.environ.get("FLASK_ENV") == "development":
    app.debug = True

app.config["TEMPLATES_AUTO_RELOAD"] = True

# Session and Security Settings

# This keeps Secure cookies on in production, but disable them in local HTTP development so logins persist
session_cookie_secure = os.environ.get("FLASK_ENV") != "development"

app.config.update(
    SESSION_COOKIE_SECURE=False,
    SESSION_COOKIE_HTTPONLY=True,    # Prevents JavaScript access (XSS mitigation)
    SESSION_COOKIE_SAMESITE='Lax',   # CSRF protection
    PERMANENT_SESSION_LIFETIME=3600  # Expires sessions after 1 hour
)

#endregion

#region TEMPLATE FILTERS

@app.template_filter('format_distance')
def format_distance(distance_km):
    try: 
        with Session(engine) as db:
            distance_unit = db.exec(
                select(Settings.value)
                .where(Settings.key == "distanceUnit")
            ).first()

            if distance_unit == "km":
                return f"{round(distance_km, 2)} km"
            elif distance_unit == "miles":
                return f"{round(distance_km * 0.621371, 2)} mi"
    except Exception as e:
        log_action('Template filter for distance unit', False, e, None, 'TEMPLATE_FILTER: DISTANCE UNIT')

@app.template_filter('format_elevation')
def format_elevation(elevation_gain):
    if not isinstance(elevation_gain, int) or isinstance(elevation_gain, float):
        elevation_gain = int(float(elevation_gain))

    if elevation_gain >= 0:
        return f"+{elevation_gain} m"
    else:
        return f"{elevation_gain} m"

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

#endregion


#region ERROR HANDLER RENDER_TEMPLATES()

@app.errorhandler(404)
def page_error_404(error):
    return render_template('Error-Pages/404.html')

@app.errorhandler(405)
def page_error_405(error):
    return render_template('Error-Pages/405.html')

@app.errorhandler(500)
def page_error_500(error):
    return render_template('Error-Pages/500.html')

#endregion

if os.getenv("LOAD_GRAPH_ON_IMPORT", "1").lower() not in ("0", "false", "no"):
    service.load_graph()

#region FLASK ROUTES: VIEW ROUTERS

@app.route('/')
@limiter.exempt
def root_url():
    return redirect(url_for('map_view'))

@app.route('/beta-page', methods=["GET"])
@limiter.exempt
def get_beta_page():
    return render_template("beta-code.html")

@app.route('/report-an-issue', methods=["GET"])
@limiter.exempt
def report_issue():
    return render_template("report-issue.html")

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

#endregion

#region FLASK ROUTE: MAIN /MAP ROUTE

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
                except Exception:
                    continue
            
            return render_template("map.html",
                                map_centre = DEFAULT_CENTRE,
                                map_zoom = 10.5,
                                current_path = session.get('current_path', None),
                                available_routes=available_routes,
                                saved_points=web_mercator_points,
                                logged_in = (user is not None))
        except Exception as e:

            short_traceback = "".join(traceback.format_exception_only(type(e), e)).strip()

            log_action('Loading Map', False, short_traceback, None, 'LOAD_MAP')

            return jsonify({"success": False, "message": f"Error whilst getting map: {e}"})

#endregion

#region FLASK ROUTE: SEARCHING

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
    except Exception:
        log_action('Searching for Area', False, traceback.format_exc(), None, 'SEARCH_AREA')

#endregion

# This makes config available in Jinja templates
@app.context_processor
def inject_config():
    return {"config": app.config}

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)

