# Standard Library Imports 

# Third Party Library Imports
from fastapi import APIRouter, HTTPException, Depends
from fastapi_limiter.depends import RateLimiter
from pyrate_limiter import Duration, Limiter, Rate
from traceback import format_exception_only

# Local Modules
from src.extensions import log_action
from .error_logging_schemas import Error

router = APIRouter()

error_codes = [
    "LOGIN",
    "FAILED_REGISTRATION",
    "FAILED_ACCOUNT_DELETION",
    "FAILED_GET_SETTINGS",
    "FAILED_SAVE_SETTINGS",
    "INVALID_COORDS_AUTO_PATH_CREATION",
    "NO_PATH_FOUND",
    "SAVING_POINT",
    "SAVE_ROUTE",
    "TEMPLATE_FILTER_DISTANCE_UNIT",
    "LOAD_ROUTE",
    "DOWNLOAD_ROUTE",
    "IMPORT_ROUTE",
    "GET_SAVED_POINT",
    "DELETE_POINT",
    "DELETE_ROUTE",
    "LOAD_MAP",
    "RESET_VIEW",
    "SEARCH_AREA"
]

# NOTE : Use correct error codes, these are available at the following link (crestr docs) https://docs.crestr.co.uk/technical/action_log_codes/

@router.post(
    '/api/log-error',
    dependencies=[Depends(RateLimiter(limiter=Limiter(Rate(10, Duration.MINUTE * 1))))] # 10 calls per minute 
)
def log_error(data: Error | None = None):
    
    if not data:
        raise HTTPException(
            status_code=422, # NOTE : this status code is for valid JSON received but doesn't have the required info
            detail={
                "success": False,
                "error": "MissingRequestBody",
                "message": "Request payload is required but was empty or missing."
            }
        )
    
    try: 
    
        action = data.action
        outcome = data.outcome
        info = data.info
        duration_ms = data.duration_ms
        error_code = data.error_code

        if error_code not in error_codes:

            raise HTTPException(
                status_code=422,
                detail={
                    "success": False,
                    "message": "Incorrect error code. "
                }
            )

        log_action(action=action, outcome=outcome, info=info, duration_ms=duration_ms, code=error_code)
        
        return {"success": True, "message": "Successfully logged error"}

    except HTTPException:
        raise

    except Exception as error:

        short_traceback = "".join(format_exception_only(type(error), error)).strip()     

        log_action("Logging Error", False, short_traceback, None, 'LOGGING ERROR')

        return {"success": False, "message": "Could not log error"}