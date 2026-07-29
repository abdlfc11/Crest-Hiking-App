#region IMPORTS

# Standard Library Imports 
import json
import traceback
from datetime import datetime, timedelta, timezone
from sys import stderr
from typing import Any, Optional

import jwt


# Third Party Libraries
from fastapi import Header, HTTPException, Depends, Cookie
from flask import session
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from sqlmodel import Session, select

# Local Files 
from src.config import Config
from src.db import get_session, engine
from src.models import ActionLog, User, SessionTable
from src.Pathfinding.Nodefinder import NodeFinder

#endregion

# Initialises the limiter 
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200 per day", "500 per hour"],
    storage_uri="memory://",
)

service = NodeFinder(graph_path=Config.GRAPH_PATH)

def get_current_user(
    session_id: Optional[str] = Cookie(default=None),
    db: Session = Depends(get_session),
) -> Optional[User]:
    """
    Silently returns the User if a valid session cookie exists,
    otherwise returns None. 
    
    Never raises.
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


