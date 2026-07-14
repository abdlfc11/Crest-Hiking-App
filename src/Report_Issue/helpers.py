from models import Issues
from sqlmodel import Session
from db import engine
from extensions import log_action

def log_issue(title: str, description: str) -> bool:
    """
    Logs an issue to the database.

    Args:
        title (str): The title of the issue.
        description (str): The description of the issue.
    
    Returns:
        bool: True if the issue was logged successfully, False otherwise.
    """
    try: 
        new_issue = Issues(title=title, description=description)

        with Session(engine) as db:
            db.add(new_issue)
            db.commit()
        
        return True
    except Exception as e:
        log_action('Logging an issue', False, e, None, 'LOG_ISSUE: DATABASE ERROR')
        return False