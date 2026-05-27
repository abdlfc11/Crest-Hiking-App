from pydantic import BaseModel, field_validator
from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import RedirectResponse, JSONResponse
from sqlmodel import Session, select, create_engine
from models import BetaCode
import os
from dotenv import load_dotenv

# DATABASE SETUP

load_dotenv()

app = FastAPI()

DATABASE_URL = os.getenv("DATABASE_URI")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URI not found in .env")

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

    return RedirectResponse(url='/register', status_code=303) # this returns the user to the register page if the beta code validation was successful
