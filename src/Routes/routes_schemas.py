from pydantic import BaseModel
from typing import Optional

class Coordinate(BaseModel):
    lon: float
    lat: float
    elevation: Optional[int] = None


class CalculateRouteModel(BaseModel):
    start_point: list
    end_point: list

class SaveRouteModel(BaseModel):
    route_name: str
    coordinates: list

class LoadRouteModel(BaseModel):
    route_name: str

class DeleteRouteModel(BaseModel):
    route_name: str

class DownloadRouteModel(BaseModel):
    route_name: str
    route_type: str

class NormaliseRouteModel(BaseModel):
    coordinates: list[Coordinate]