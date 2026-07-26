from fastapi import FastAPI
from src.Points.points_fastapi import router as points_router

app = FastAPI()
app.include_router(points_router)