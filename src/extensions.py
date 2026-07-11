#region IMPORTS

from flask import session
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from sqlmodel import Session, select
from db import engine
import json
import traceback
from typing import Any, Optional
from sys import stderr

# Local Files
from src.Pathfinding.Nodefinder import NodeFinder
from config import Config
from models import ActionLog, User

#endregion

# Initialises the limiter 
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200 per day", "500 per hour"],
    storage_uri="memory://",
)

service = NodeFinder(graph_path=Config.GRAPH_PATH)

def get_current_user():
    """
    Retrieves the currently logged-in user from the database based on the session data.

    Checks the active Flask session for a 'username'. If present, it queries the database to find and return the matching User record.

    Returns:
        Optional[User]: The User model instance if found; None if no session exists or the user is not found in the database.
    """

    username = session.get("username")
    print(username)
    if not username:
        print("no username detected")
        return None
    with Session(engine) as db:
        return db.exec(select(User).where(User.username == username)).first()

def is_beta_code_validated():
    """
    Checks whether a valid beta code session exists for the current user.

    This acts as a quick state check to determine if the user has already 
    passed beta code validation during their active session.

    Returns:
        bool: True if a 'beta_code' exists in the session, False otherwise.
    """

    beta_code = session.get("beta_code")
    print(beta_code)
    if not beta_code:
        print("No beta code detected")
        return False
    else:
        return True

def log_action(
    action: str, 
    outcome: bool, 
    info: Optional[Any] = None, 
    duration_ms: Optional[int] = None,
    code: Optional[str] = None
) -> None:
    """
    Records an application event or metric into the central ActionLog table.

    This function operates entirely within its own isolated database session 
    to guarantee that transaction failures in the main application flow do 
    not disrupt or prevent the creation of the event log. 

    Args:
        - action (str): The name of the event or endpoint (e.g., 'pathfind_request').

        - outcome (bool): True if the operation succeeded, False if it failed.

        - info (Any, optional): Contextual metadata. Accepts raw exceptions (which 
            are stringified) or dictionaries/lists (which are automatically 
            serialized into JSON strings). Defaults to None.

        - duration_ms (int, optional): Performance metric representing execution 
            time strictly formatted as milliseconds. Defaults to None.

        - code (str, optional): An application-specific identifier 
            (e.g., 'FAILED_SAVE_ROUTE').
            Defaults to None.

    Returns:
        None

    Raises:
        Does not propagate exceptions. Internal failures (e.g., complete database 
        unreachability) are caught silently and dumped safely to system standard error logs.
    """
    with Session(engine) as log_db:
        try:
            # This handles info parsing safely depending on data type, mainly a guard clause as most info (if not all) passed in is a string
            processed_info = None
            if info is not None:
                if isinstance(info, Exception):
                    processed_info = str(info)[:2000]
                elif isinstance(info, (dict, list)):
                    processed_info = json.dumps(info)
                else:
                    processed_info = str(info)[:2000]

            # This builds the record / row
            log_entry = ActionLog(
                action=action,
                outcome=outcome,
                info=processed_info,
                duration_ms=duration_ms,
                error_code=code
            )
            
            log_db.add(log_entry)
            log_db.commit()
            
        except Exception as log_err:
            # Fallback if the database becomes entirely unreachable
            print(f"CRITICAL: Failed to write to ActionLog table: {log_err}", file=stderr)
            print(traceback.format_exc())


