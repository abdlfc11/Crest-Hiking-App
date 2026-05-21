# AGENTS.md

Compact guidance for agents working on Crest (hiking route planner). Read README.md first for user setup.

## Run / Dev Commands
- `docker-compose up --build` (primary; requires `.env` first — see README for LOCATIONIQ_API_KEY + postgres vars)
- App: http://localhost:5000 (Flask debug in dev via volume mount + FLASK_ENV=development)
- DB init (tables not auto-created on `flask run`): `docker-compose exec web flask --app app.py db upgrade`
- Graph requires LFS: after clone run `git lfs install && git lfs pull` (else `better_path_graph.pkl` missing at runtime)
- No `npm`, `make`, `pytest`, `ruff`, `mypy` etc. configured — manual verification only

## Architecture & Boundaries
- Entrypoint: `app.py` (Flask app + all models + routes + NodeFinder service); `pathfinder.py` (AStarRouteFinder + KDTree helpers)
- Graph: `Pathfinding/better_path_graph.pkl` (networkx, ~120MB+, LFS-tracked, BNG EPSG:27700 coords, elevation-augmented); lazy-loaded on first calc
- Data scripts (`elevation_upgrade.py`, `Pathfinding/path_downloader.py`) are one-off; need extra pkgs (`pyrosm`, `rasterio`, ...) not in `requirements.txt`
- Frontend: Jinja2 templates + `static/js/{map.js,ui.js,...}` (vanilla + OpenLayers CDN) — no bundler
- DB: Postgres (docker) + SQLAlchemy + Flask-Migrate (migrations/); .env DATABASE_URI must target `db:5432` service

## Docker / Build Gotchas
- `Dockerfile` explicitly COPYs only `new_path_graph.pkl` + CMD `python app.py`; `docker-compose.yml` overrides to `flask run` + `.:/app` volume (dev works, plain `docker build` will 404 on graph)
- `.gitignore` has `*.pkl` (prevents temp pickles) + `.env`; LFS pointer for `better_*` bypasses
- Update Dockerfile COPY/CMD if targeting prod image without volume

## Verification & Style
- No tests or CI; run app and exercise `/calculate_path`, save/load routes, exports (GPX/GeoJSON)
- Auth uses Flask sessions + werkzeug hashes; rate limits on login/register
- Keep changes in `app.py`/`pathfinder.py` minimal — graph in memory, heavy imports at top
- Python 3.14 in Dockerfile (verify pins for scipy/networkx/geopandas on updates)

## Tech Stack (verified)
- Backend: Python, Flask 3, Flask-SQLAlchemy, Flask-Migrate, psycopg, networkx, scipy, gpxpy
- Frontend: HTML/CSS/JS, OpenLayers (CDN)
- Data/Path: OSM .pbf (pyrosm for build), SRTM .tif (elevation), custom A* + KDTree
- Infra: Docker, Postgres 15

See README.md for features, export formats, and user-facing commands. Reconcile any drift against `docker-compose.yml`, `app.py`, `pathfinder.py`, and `requirements.txt`.
