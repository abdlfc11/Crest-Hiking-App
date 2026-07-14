#region IMPORTS


# Standard Library Imports 
import traceback

# Third-Party Libraries
from flask import (
    Blueprint,
    jsonify,
    request,
    url_for,
)

# Local Modules
from Report_Issue.helpers import log_issue
from extensions import get_current_user, log_action, limiter


#endregion


#region INITIALISATION

report_issues_bp = Blueprint("report_issues", __name__)

#endregion

@report_issues_bp.route("/api/report-issue", methods=["POST"])
@limiter.limit("5 per minute")
def report_issue_api():
    """
    API endpoint to report an issue.
    """
    try:
        data = request.get_json()
        title = data.get("title")
        description = data.get("description")
        user = get_current_user()

        if not user:
            return url_for("auth_api.login"), 401

        if not title or not description:
            return jsonify({"success": False, "message": "Title and description are required"}), 400

        # This logs the issue to the database and returns True if successful, False otherwise
        success = log_issue(title, description)

        if not success:
            return jsonify({"success": False, "message": "Failed to report issue"}), 500

        return jsonify({"success": True, "message": "Issue reported successfully"})
    except Exception as e:
        log_action('Report Issue', False, traceback.format_exc(), None, 'REPORT_ISSUE')
        return jsonify({"success": False, "message": f"Error reporting issue: {e}"}), 500