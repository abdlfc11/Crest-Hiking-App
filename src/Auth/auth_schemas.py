from pydantic import BaseModel

class LogoutUser(BaseModel):
    username: str

class DeleteUser(BaseModel):
    username: str

class RegisterUser(BaseModel):
    preferred_name: str | None = None
    username: str
    password1: str
    password2: str

class LoginUser(BaseModel):
    username: str
    password: str