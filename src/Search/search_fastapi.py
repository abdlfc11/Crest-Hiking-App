#region IMPORTS 

# Core Library Imports
import traceback


# Third Party Library Imports
import requests
from fastapi import APIRouter, Depends, HTTPException 
from fastapi_limiter.depends import RateLimiter
from pyrate_limiter import Duration, Limiter, Rate

# Local Module Imports
from src.extensions import service, log_action, rate_limit_exceeded_callback
from src.Search.search_schemas import SearchModel
from src.config import Config


#endregion

router = APIRouter()

@router.post(
    '/search/search-area',
    dependencies=[
        Depends(
            RateLimiter(
                limiter=Limiter(Rate(110, Duration.MINUTE)),
                callback=rate_limit_exceeded_callback
            )
        )
    ]
)
def search_area(
    data: SearchModel
):

    try: 
        search_input = data.search_input
        query_parameters = {
            'key': Config.LOCATIONIQ_API_KEY,
            'q': search_input,
            'format': 'json',
            'countrycodes': 'gb'
        }

        response = requests.get(
           "https://eu1.locationiq.com/v1/search",
            params=query_parameters,
            timeout=(3.05, 10), # 3.05s is connection timeout and 10s is read timeout 
        )
        results = response.json()

        if isinstance(results, list) and len(results) > 0:

            first_result = results[0]

            latitude = first_result.get("lat")
            longitude = first_result.get("lon")

            print(f"Latitude: {latitude}\nLongitude: {longitude}")

            coords = [float(longitude), float(latitude)]

            print(coords)

            return {
                "success": True,
                "coordinates": coords,
                "display_name": first_result.get("display_name")
            }
        else:

            raise HTTPException(
                status_code=404,
                detail={
                    "success": False,
                    "message": "Could not find area"
                }
            )
    except Exception:
        log_action('Searching for Area', False, traceback.format_exc(), None, 'SEARCH_AREA')

        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "message": "Sorry, there was an unexpected error, try again later. "
            }
        )