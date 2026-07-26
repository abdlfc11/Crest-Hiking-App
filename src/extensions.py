#region IMPORTS

# Standard Library Imports 
import json
import traceback
from datetime import datetime, timedelta, timezone
from sys import stderr
from typing import Any, Optional

import jwt


# Third Party Libraries
from fastapi import Header, HTTPException
from flask import session
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from sqlmodel import Session, select

# Local Files 
from config import Config
from db import engine
from models import ActionLog, User
from src.Pathfinding.Nodefinder import NodeFinder

#endregion

# Initialises the limiter 
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200 per day", "500 per hour"],
    storage_uri="memory://",
)

service = NodeFinder(graph_path=Config.GRAPH_PATH)

def get_current_user_jwt(authorisation: str | None = Header(default=None, alias="Authorization")) -> User | None:
    """
    Extracts, validates, and decodes a JWT from the HTTP Authorization header, 
    then retrieves the corresponding user from the database.

    Args:
        authorisation (str | None): The raw Authorization header value (e.g., 'Bearer <token>').

    Returns:
        User | None: The User model instance corresponding to the 'sub' claim in the JWT, 
        or None if no matching user is found.

    Raises:
        HTTPException: 
            - 401 "Missing Token" if the header is absent.
            - 401 "Invalid auth scheme" if the header does not start with 'Bearer '.
            - 401 "Token Expired" if the token has passed its expiration time.
            - 401 "Invalid Token" if the token signature or structure is invalid.

    Examples:
        >>> get_current_user_jwt("Bearer eyJhbGciOiJIUzI1Ni...")
        <User id=1 username='johndoe'>
    """

    # this returns an error if no token is found 
    if not authorisation:
        raise HTTPException(status_code=401, detail="Missing Token")

    # this returns an error if the structure of the token is invalid
    if not authorisation.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid auth scheme")

    # this retrieves the actual token (as the first 7 chars are 'Bearer ')
    token = authorisation[7:]

    try:
        payload = jwt.decode(token, Config.JWT_SECRET, algorithms="HS256")
        
        # this returns the username 
        username = payload['sub']

        with Session(engine) as db:
            return db.exec(select(User).where(User.username == username)).first()
    except jwt.ExpiredSignatureError as e:
        raise HTTPException(status_code=401, detail=f"Token Expired: {e}")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid Token: {e}")

def create_access_token(username: str) -> str | bool:
    """
    Generates a JWT access token for a given user that expires in 24 hours

    Args:
        username (str): The unique identifier of the user to encode in the token.

    Returns:
        str: The encoded JWT string if successful.
        bool: False if the username is empty or falsy.

    Examples:
        >>> create_access_token("johndoe")
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
        >>> create_access_token("")
        False
    """
    if not username:
        return False

    payload = {
        "sub": username,
        "exp": datetime.now(timezone.utc) + timedelta(hours=24)
    }

    return jwt.encode(payload, Config.JWT_SECRET, algorithm="HS256")

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


