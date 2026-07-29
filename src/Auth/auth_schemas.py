from pydantic import BaseModel

class RegisterUser(BaseModel):
    preferred_name: str | None = None
    username: str
    password1: str
    password2: str

class LoginUser(BaseModel):
    username: str
    password: str