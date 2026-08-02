from typing import Annotated
import math
from pydantic import BaseModel, AfterValidator, Field

# better validation for coordinates to ensure that erroneous coordinates are caught before they hit FastAPI routes 
def check_finite(value: float) -> float:
    if not math.isfinite(value):
        raise ValueError("Coordinates must be finite. ")
    return value
    
Longitude = Annotated[float, AfterValidator(check_finite), Field(ge=-180, le=180)]
Latitude = Annotated[float, AfterValidator(check_finite), Field(ge=-90, le=90)]


class PointSchema(BaseModel):
    point_name: str
    lon: Longitude | None = None
    lat: Latitude | None = None