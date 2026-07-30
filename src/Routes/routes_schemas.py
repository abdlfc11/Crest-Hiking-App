from pydantic import BaseModel

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