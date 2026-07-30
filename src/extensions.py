#region IMPORTS

# Standard Library Imports 
import json
import traceback
from datetime import datetime, timedelta, timezone
from sys import stderr
from typing import Any, Optional


# Third Party Libraries
from fastapi import Header, HTTPException, Depends, Cookie, Request, Response
from sqlmodel import Session, select

# Local Files 
from src.config import Config
from src.db import get_session, engine
from src.models import ActionLog, User, SessionTable
from src.Pathfinding.Nodefinder import NodeFinder

#endregion

service = NodeFinder(graph_path=Config.GRAPH_PATH)

async def rate_limit_exceeded_callback(request: Request, response: Response):
    """
    Called by fastapi-limiter when the rate limit is exceeded.
    Raises a HTTPException with status code 429 
    """

    try:
        with Session(engine) as db:

            session_id = request.cookies.get("session_id")
            user = get_user_from_session_id(session_id, db)

            if user:
                db_routes = db.exec(
                    select(Route).where(Route.user_id==user.id)
                ).all()
                available_routes = [route.model_dump() for route in db_routes]
            else:
                available_routes = []
        
            log_action('Rate Limiting', False, 'Rate limit exceeded', None, 'RATE_LIMIT_HIT')
    except Exception as error:
        short_traceback = "".join(traceback.format_exception_only(type(error), error)).strip()
        log_action('MISC', False, short_traceback, None, 'RATE_LIMIT_HIT')
        available_routes = []
    
    raise HTTPException(
        status_code=429,
        detail={
            "success": False,
            "map_centre": DEFAULT_CENTRE, # This keeps the front-end Map safe from crashing
            "available_routes": available_routes, # So does this
            "message": "Too many requests. Please slow down."
        }
    )

def get_user_from_session_id(
    session_id: Optional[str],
    db: Session,
) -> Optional[User]:
    """
    returns the user with corresponding to the session ID 
    """
    if not session_id:
        return None

    session = db.exec(
        select(SessionTable).where(
            SessionTable.session_id == session_id,
            SessionTable.expires_at > datetime.now(timezone.utc),
        )
    ).first()

    if session is None:
        return None

    user = db.exec(
        select(User).where(User.id == session.user_id)
    ).first()

    return user


def get_current_user(
    session_id: Optional[str] = Cookie(default=None),
    db: Session = Depends(get_session),
) -> Optional[User]:
    """
    Silently returns the User if a valid session cookie exists,
    otherwise returns None. Never raises.
    """
    return get_user_from_session_id(session_id, db)


def log_action(
    action: str, 
    outcome: bool, 
    info: Optional[Any] = None, 
    duration_ms: Optional[int] = None,
    code: Optional[str] = None,
) -> None:
    """
    Records an application event or metric into the central ActionLog table.

    This function operates entirely within its own isolated database session 
    to guarantee that transaction failures in the main application flow do 
    not disrupt or prevent the creation of the event log. 

    Parameters:
    
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
        Does not raise any exceptions 
        Internal failures (e.g., complete database unreachability) are caught silently and dumped safely to system standard error logs.
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


