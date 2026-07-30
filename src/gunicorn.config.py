"""
This file uses gunicorn to manage uvicorn workers 
Needed as uvicorn does not support shared memory between workers
"""

import os

bind = "0.0.0.0:5000"
workers = int(os.getenv("GUNICORN_WORKERS", "2"))


worker_class = "uvicorn.workers.UvicornWorker"

# this ensures shared memory between workers 
preload_app = True

# Environment and logging
raw_env = ["LOAD_GRAPH_ON_IMPORT=1"]
accesslog = "-"
errorlog = "-"
loglevel = os.getenv("GUNICORN_LOG_LEVEL", "info")
