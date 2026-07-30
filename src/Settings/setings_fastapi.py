# IMPORTS 

# Standard Library Imports 
import traceback


# Third-Party Libraries
from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select

# Local Modules
from src.db import get_session
from src.models import Settings, User
from src.extensions import log_action, get_current_user
from src.Settings.settings_schemas import SettingsModel

# INITIALISATION
router = APIRouter()

# ROUTES

@router.get(
    '/settings/get-settings'
)
def get_settings(
    user: User = Depends(get_current_user),
    db : Session = Depends(get_session)
):
    if not user:
        raise HTTPException(
            status_code=401,
            detail={
                "success": False,
                "message": "No user found"
            }
        )
    
    try:
        existing_records = db.exec(
            select(Settings)
            .where(Settings.user_id == user.id)
        ).all()

        settings_payload = {record.key : record.value for record in existing_records}

        return {
            "success": True,
            "settings_dict": settings_payload
        }
    except HTTPException:
        raise
    except Exception as error:
        short_traceback = "".join(traceback.format_exception_only(type(error), error)).strip()

        log_action('Getting Settings', False, short_traceback, None, 'FAILED_GET_SETTINGS')

        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "message": "There was an error whilst retrieving settings."
            }
        )

        return jsonify({"success": False, "message": "There was an error whilst retrieving settings"}), 500

@router.post(
    '/settings/save-settings'
)
def save_settings(
    data: SettingsModel,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_session)
):

    settings = data.settings_dict

    if not user:
        raise HTTPException(
            status_code=401,
            detail={
                "success": False,
                "message": "No user found"
            }
        )
    
    try:

        existing_records = db.exec(
            select(Settings)
            .where(Settings.user_id == user.id)
        ).all()

        # this creates a dictionary of settings based on the existing settings records retrieved
        settings_dict = {record.key : record for record in existing_records}

        # this is a tracker used to check if the DB changed so that it can be determined whether any action is needed 
        db_changed = False

        # this creates a dictionary of settings based on the exisiting records retrieved 
        # it then sets the db_changed tracker value to True if there is change detected
        # it also adds any new settings detected
        for key, new_value in settings.items():             # for key, new_value in settings received from frontend
            if key in settings_dict:                # if the key is in settings retrieved from backend
                record = settings_dict[key]         
                if record.value != new_value:       # if the value of the settings received from backend differs from that of the frontend
                    record.value = new_value        # change value to the one received from the frontend
                    db_changed = True
            else:                               # if the key is NOT in settings received from the backend 
                new_record = Settings(user_id=user.id, key=key, value=new_value)    # create and add the settings record to the DB
                db.add(new_record)
                db_changed = True
        
        # if the db has changed, these are commited 
        if db_changed:
            db.commit()
        
        return {
            "success": True,
            "message": "Successfully saved settings"
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()

        short_traceback = "".join(traceback.format_exception_only(type(e), e)).strip()

        log_action('Saving Settings', False, short_traceback, None, 'FAILED_SAVE_SETTINGS')

        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "message": "There was an error whilst saving settings"
            }
        ) 



"""

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
"""