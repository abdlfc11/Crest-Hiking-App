from fastapi import FastAPI
from src.Points.points_fastapi import router as points_router
from src.Report_Issue.report_issue_fastapi import router as report_issue_router

app = FastAPI()
app.include_router(points_router)
app.include_router(report_issue_router)
