from pydantic import BaseModel


class PointSchema(BaseModel):
    point_name: str
    web_mercator_x: float | None = None
    web_mercator_y: float | None = None