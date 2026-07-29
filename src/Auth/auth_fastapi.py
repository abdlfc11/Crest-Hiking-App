#region IMPORTS

# Standard Library Imports
import traceback

# Third Party Library Imports 
import secrets
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Cookie, Response, Depends
from fastapi_limiter.depends import RateLimiter
from pyrate_limiter import Duration, Limiter, Rate
from sqlmodel import Session, delete, select
from werkzeug.security import check_password_hash, generate_password_hash

# Local Modules
from src.db import get_session
from src.models import Point, Route, User, SessionTable, Settings
from src.extensions import limiter, log_action, get_current_user
from src.Auth.auth_schemas import LoginUser, RegisterUser
from src.constants import SPECIAL_CHARACTERS

#endregion

#region INITIALISATION

router = APIRouter()

#endregion

#region LOGIN
        
@router.post(
    "/auth/login",
    dependencies=[Depends(RateLimiter(limiter=Limiter(Rate(10, Duration.MINUTE * 1))))]  # 10 per minute
)
def login(
    data: LoginUser,
    response: Response,
    db: Session = Depends(get_session)
):
    try:
        username = data.username
        password = data.password

        if not username or not password:
            raise HTTPException(
                status_code=422,
                detail={
                    "success": False,
                    "message": "Username and Password are required"
                }
            )

        user = db.exec(
            select(User).where(User.username == username)
        ).first()

        if not user or not check_password_hash(user.password_hashed, password):
            raise HTTPException(
                status_code=401,
                detail={
                    "success": False,
                    "message": "Username and/or Password are incorrect"
                }
            )
        
       

        # this deletes all other valid sessions that the user currently has
        db.exec(
            delete(SessionTable).where(SessionTable.user_id == user.id)
        )

        session = SessionTable(
            session_id=secrets.token_urlsafe(32),
            user_id=user.id,
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        )
        db.add(session)
        db.commit()

        response.set_cookie(
            key="session_id",
            value=session.session_id,
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=60 * 60 * 24 * 7,
        )

        return {
            "success": True,
            "message": "Successfully logged in"
        }

    except HTTPException:
        raise

    except Exception as e:
        short_traceback = "".join(traceback.format_exception_only(type(e), e)).strip()
        log_action('Login', False, short_traceback, None, 'LOGIN')

        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "message": "Sorry, there was an unexpected error whilst logging in."
            }
        )

#endregion

#region LOGOUT

@router.post(
    '/auth/logout',
    dependencies=[Depends(RateLimiter(limiter=Limiter(Rate(10, Duration.MINUTE * 1))))] # 10 per minute 
)
def logout(
    response: Response,
    session_id: str = Cookie(None),
    db: Session = Depends(get_session)
):
    if session_id is None:
        raise HTTPException(
            status_code=401,
            detail={
                "success": False,
                "message": "Not logged in"
            }
        )


    db.exec(delete(SessionTable).where(SessionTable.session_id == session_id))
    db.commit()

    response.delete_cookie(
        key="session_id",
        path="/",
        httponly=True,
        secure=True,
        samesite="lax"
    )

    return {
        "success": True,
        "message": "Successfully logged out"
    }

#endregion

#region REGISTER ACCOUNT

@router.post(
    '/auth/register',
    dependencies=[Depends(RateLimiter(limiter=Limiter(Rate(10, Duration.MINUTE * 1))))] # 10 per minute 
)
def register(
    data: RegisterUser,
    db: Session = Depends(get_session)
):
    try: 

        username = data.username
        p1 = data.password1
        p2 = data.password2
        preferred_name = data.preferred_name # will be None if the user has not entered preferred_name, in this event Null would be in the 'preferred_name' column in the DB 

        if not username:
            
            raise HTTPException(
                status_code=422,
                detail={
                    "success": False,
                    "message": "Username required"
                }
            )

        
        if p1 != p2:

            raise HTTPException(
                status_code=422,
                detail={
                    "success": False,
                    "message": "The passwords must match each other"
                }
            )
        
        if len(p1) <= 11:

            raise HTTPException(
                status_code=422,
                detail={
                    "success": False,
                    "message": "Passwords must have at least 12 characters"
                }
            )
        
        has_digit = any(char.isdigit() for char in p1)
        if not has_digit:

            raise HTTPException(
                status_code=422,
                detail={
                    "success": False,
                    "message": "Passwords must have at least one numerical digit"
                }
            )
        
        if not any(character in p1 for character in SPECIAL_CHARACTERS):

            raise HTTPException(
                status_code=422,
                detail={
                    "success": False,
                    "message": "Passwords must have at least one special character"
                }
            )

        
        existing_user = db.exec(
            select(User).where(User.username == username)
        ).first()


        if existing_user:
        
            raise HTTPException(
                status_code=409,          # or 400/422, your choice
                detail={
                    "success": False,
                    "message": "Someone has already chosen this username"
                }
            )
        
        new_user = User(
            username = username,
            preferred_name = preferred_name,
            password_hashed = generate_password_hash(p1)
        )

        db.add(new_user)
        db.commit()

        return {
            "success": True,
            "message": "Successfully registered"
        }
    
    except HTTPException:
        raise
        
    except Exception as error:
        db.rollback()

        short_traceback = "".join(traceback.format_exception_only(type(error), error)).strip()

        log_action('Registering', False, short_traceback, None, 'FAILED_REGISTRATION')

        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "message": "Sorry, there was an unexpected error whilst registering, try again later."
            }
        )

#endregion

#region DELETE ACCOUNT

@router.post(
    '/auth/delete-account',
    dependencies=[Depends(RateLimiter(limiter=Limiter(Rate(10, Duration.MINUTE * 1))))] # 10 per minute
)
def delete_account(
    response: Response,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
    session_id: str = Cookie(None)
):
    
    if not user:
        raise HTTPException(
            status_code=401,
            detail={
                "success": False,
                "message": "Unauthorised to delete route"
            }
        )
    
    try:
        # Cascading deletes to ensure all user data is deleted (likely to modify DB after refactor to make cascading deletion the default)
        db.exec(
            delete(Route)
            .where(Route.user_id == user.id)
        )

        db.exec(
            delete(Point)
            .where(Point.user_id == user.id)
        )

        db.exec(
            delete(SessionTable)
            .where(SessionTable.user_id == user.id)
        )

        db.exec(
            delete(Settings)
            .where(Settings.user_id == user.id)
        ) 

        db.exec(delete(User).where(User.id == user.id)) 
        db.commit()

        response.delete_cookie(
            key="session_id",
            path='/',
            httponly=True,
            secure=True,
            samesite="lax"
        )

        return {
            "success": True,
            "message": "Successfully deleted account"
        }
            
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()

        short_traceback = "".join(traceback.format_exception_only(type(e), e)).strip()

        log_action('Deleting Account', False, short_traceback, None, 'FAILED_ACCOUNT_DELETION')

        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "message": "Could not delete your account, try again later. "
            }
        )
#endregion

