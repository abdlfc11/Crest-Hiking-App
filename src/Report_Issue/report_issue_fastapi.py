#region IMPORTS


# Standard Library Imports 
import traceback

# Third-Party Libraries
from fastapi import APIRouter, HTTPException, Depends
from fastapi_limiter.depends import RateLimiter
from pyrate_limiter import Duration, Limiter, Rate

# Local Modules
from .helpers import log_issue
from .report_issue_schema import ReportIssueData
from extensions import log_action


#endregion


#region INITIALISATION

router = APIRouter()

#endregion

@router.post(
    '/api/report-issue',
    dependencies=[Depends(RateLimiter(limiter=Limiter(Rate(5, Duration.MINUTE * 1))))] # 5 per minute 
)
def report_issue_api(data: ReportIssueData):
    """
    Submit a detailed issue report or bug to the support team.

    
    Rate Limited
        - 5 requests per minute per client. Exceeding this returns a `429 Too Many Requests` error.

    Request Body
        - Must conform to the `ReportIssueData` schema (requires issue title + description, likely to add more in the future)

    Errors
        - 400 Bad Request: Invalid payload or missing required fields.
        - 429 Too Many Requests: Rate limit exceeded
    """
    try:

        title = data.title
        description = data.description

        if not title or not description:

            raise HTTPException(
                status_code=400,
                detail={
                    "success": False, 
                    "message": "Title and description are required"
                }
            )

        # This logs the issue to the database and returns True if successful, False otherwise
        success = log_issue(title, description)

        if not success:

            raise HTTPException(
                status_code=500,
                detail={
                    "success": False, 
                    "message": "Failed to report issue"
                }
            )

        return {"success": True, "message": "Issue reported successfully"}
    except HTTPException:
        raise
    except Exception as e:
        log_action('Report Issue', False, traceback.format_exc(), None, 'REPORT_ISSUE')

        raise HTTPException(
                status_code=500,
                detail={
                    "success": False, 
                    "message": "Well this is Awkward. Something went wrong while reporting that issue. Our team has been notified."
                }
            )