#region IMPORTS

# Standard Library Imports 
import traceback


# Third-Party Libraries
from flask import (
    jsonify,
    request,
    Blueprint
)
from sqlmodel import Session, select

# Local Modules
from db import engine
from models import Settings
from extensions import log_action, get_current_user

#endregion

#region INITIALISATION

settings_api_bp = Blueprint("settings_api", __name__)

#endregion

#region FLASK ROUTES

@settings_api_bp.route("/get_settings", methods=["GET"])
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

@settings_api_bp.route("/save_settings", methods=["POST"]) 
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
