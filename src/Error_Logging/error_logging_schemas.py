from pydantic import BaseModel

class Error(BaseModel):
    action: str
    info : str
    outcome : bool
    duration_ms : int | None = None
    error_code : str | None = None