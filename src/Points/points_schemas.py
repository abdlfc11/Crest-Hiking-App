from pydantic import BaseModel


class PointSchema(BaseModel):
    point_name: str
    lon: float | None = None
    lat: float | None = None