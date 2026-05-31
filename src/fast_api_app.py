from pydantic import BaseModel, field_validator
from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import RedirectResponse, JSONResponse
from sqlmodel import Session, select, create_engine
from .models import BetaCode
import os
from dotenv import load_dotenv
import jwt
import datetime

# DATABASE SETUP

load_dotenv()

app = FastAPI()

DATABASE_URL = os.getenv("DATABASE_URI")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URI not found in .env")

JWT_SECRET = os.getenv("JWT_SECRET")

engine = create_engine(DATABASE_URL) 

def get_db():
    with Session(engine) as session:
        yield session

# SCHEMAS

class BetaCodeRequest(BaseModel):
    beta_code: str

    @field_validator("beta_code")
    @classmethod
    def check_present(cls, value: str) -> str: # -> str shows that the function should return a string
        value = value.strip() # this is to ensure whitespace is removed
        
        # this is a check to ensure that the beta code is of desired length
        if len(value) != 20:
            raise ValueError("The beta code is not of the desired length")
        
        # this is a check to ensure that the user has actually entered the beta code
        if not value:
            raise ValueError("There must be a value in this entry")
        
        # .upper() is to ensure that the way that the user enters the beta code is case-insensitive 
        return value.upper() 

# FAST API ROUTES

@app.post("/beta-validate")
async def beta_validate(data: BetaCodeRequest, db: Session = Depends(get_db)):

    # this retrieves (or tries to) a record within the beta code database table
    beta_entry = db.exec(
        select(BetaCode)
        .where(BetaCode.code == data.beta_code)
    ).first()

    # this returns an appropriate message if the beta code is not present
    if not beta_entry:
        return {"success": False, "message": "Invalid beta code"}
    
    # this returns an appropriate message to the user if the beta code has been used already
    if beta_entry.used:
        return {"success": False, "message": "Beta code has already been used"}
    
    beta_entry.used = True # this is to ensure one-time use only 
    db.commit() # this saves the changes made to beta_entry.used to the database

    # this creates the payload to be used for the creation of the jwt (json web token)
    payload = {
        "beta_passed": True,
        "exp": datetime.utcnow() + datetime.timedelta(minutes=10)
    }

    # this creates a jwt which is used by the flask backend 
    token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")

    response =  RedirectResponse(url='/register', status_code=303) # this sets a var to a redirect to the register page if the beta code validation was successful

    # this sets a cookie so that the flask backend can validate that the user has entered a beta code and not just entered the register page url
    response.set_cookie(
        key="beta-code", # cookie name
        value=token, 
        httponly=True, # ensures that JavaScript cannot read the cookie
        secure=True, # cookie only sent via HTTPS
        samesite="strict", # cookie is not sent via cross-site requests -> CSRF protection
        max_age=600 # 10 mins
    )

    return response


