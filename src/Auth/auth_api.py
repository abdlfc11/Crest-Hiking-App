#region IMPORTS

# Standard Library Imports
import traceback


# Third-Party Libraries
from flask import (
    jsonify,
    request,
    session,
    Blueprint
)
from sqlmodel import Session, delete, select
from werkzeug.security import check_password_hash, generate_password_hash

# Local Modules
from db import engine
from models import BetaCode, Point, Route, User
from extensions import limiter, log_action, get_current_user

#endregion

#region INITIALISATION

auth_api_bp = Blueprint("auth_api", __name__)

#endregion

#region FLASK ROUTES

@auth_api_bp.route("/validate-beta-code", methods=['POST'])
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
        
@auth_api_bp.route("/login", methods=["POST"])
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

@auth_api_bp.route("/logout", methods=["POST"])
@limiter.limit("10 per minute")
def logout():
    username = session.get("username", "user")
    session.pop('username', None)
    session.clear()
    return jsonify({"success": True, "message": f"Sucessfully logged out of {username}"})
    
@auth_api_bp.route("/registering", methods=["POST"])
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


@auth_api_bp.route("/delete_account", methods=["POST"])
@limiter.limit("10 per minute")
def delete_account():
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

