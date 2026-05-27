import os

bind = "0.0.0.0:5000"
workers = int(os.getenv("GUNICORN_WORKERS", "2"))
preload_app = True
accesslog = "-"
errorlog = "-"
loglevel = os.getenv("GUNICORN_LOG_LEVEL", "info")

raw_env = ["LOAD_GRAPH_ON_IMPORT=1"]