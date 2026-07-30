from pydantic import BaseModel

class ReportIssueData(BaseModel):
    title: str
    description: str