import os
from dotenv import load_dotenv
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent  # go up from /app to project/

env_path = BASE_DIR / ".env"
example_path = BASE_DIR / ".env.example"

dotenv_path = env_path if env_path.exists() else example_path

load_dotenv(dotenv_path)

class Config:
    SECRET_KEY = os.getenv('FLASK_SECRET_KEY')
    LOCATIONIQ_API_KEY = os.getenv('LOCATIONIQ_API_KEY')
    DATABASE_URI = os.getenv('DATABASE_URI')
    LOCAL_DATABASE_URI = os.getenv('LOCAL_DATABASE_URI')
    GRAPH_PATH = os.getenv('GRAPH_PATH')
    UMAMI_WEBSITE_ID = os.getenv('UMAMI_WEBSITE_ID')
    UMAMI_SCRIPT_URL = os.getenv('UMAMI_SCRIPT_URL')