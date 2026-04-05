import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv('FLASK_SECRET_KEY')
    LOCATIONIQ_API_KEY = os.getenv('LOCATIONIQ_API_KEY')
    DATABASE_URI = os.getenv('DATABASE_URI')