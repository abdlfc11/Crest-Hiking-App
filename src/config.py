import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv('FLASK_SECRET_KEY')
    LOCATIONIQ_API_KEY = os.getenv('LOCATIONIQ_API_KEY')
    DATABASE_URI = os.getenv('DATABASE_URI')
    LOCAL_DATABASE_URI = os.getenv('LOCAL_DATABASE_URI')
    GRAPH_PATH = os.getenv('GRAPH_PATH', 'Pathfinding/better_path_graph.pkl')