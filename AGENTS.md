# AGENTS.md

Compact guidance for agents working on Crestr (hiking route planner). Read [README.md](README.md) first for user setup.

**Last Updated: 8th August 2026**

## Run / Dev Commands
- `docker-compose up --build` (primary; requires `example.env` and optional `.env` — see README for LOCATIONIQ_API_KEY + postgres vars)
- App (via Caddy): http://localhost/ (Caddy proxies to the app). For direct debugging the FastAPI service is reachable on `http://localhost:5001` when `web-fastapi` is exposed.
- Development run (fast reload):
	- `uvicorn fastapi_app:app --reload --host 0.0.0.0 --port 5001` (useful when iterating locally)
- DB / migrations:
	- Migrations run automatically in the container entrypoint (`docker-entrypoint.sh` runs `alembic upgrade heads`).
	- To run manually: `docker-compose exec web-fastapi alembic upgrade heads` (or run `alembic upgrade heads` inside the container)
- Frontend build: Dockerfile uses a multi-stage Node build to produce `static/dist` (frontend assets). In local dev the `static/dist` and `src` folders are mounted via volumes so a separate `npm run build` isn't required for development.
- Graph handling: the container entrypoint will ensure a path graph exists at `/app/graph_generation/elevation_populated_igraph.pkl` (it will download a release asset if missing). If you prefer a tracked graph, `git lfs install && git lfs pull` may be required for older workflows.
- No formal test harness (pytest/CI) configured — manual verification is expected.

## Architecture & Boundaries
- Entrypoint: `src/fastapi_app.py` (FastAPI app). The compose service is `web-fastapi` (see `docker-compose.yml`).
- Pathfinding: `src/Pathfinding/` contains `Nodefinder.py` and `pathfinder.py` (A* / KDTree helpers). The runtime graph is in `graph_generation/elevation_populated_igraph.pkl` (igraph-format, large) and is loaded lazily by the `service.load_graph()` helper.
- Data scripts: `graph_generation/` contains one-off scripts such as `path_downloader.py` and `elevation_upgrade.py` which require extra geospatial packages (pyrosm, rasterio, igraph, etc.) not bundled in `requirements.txt`.
- Frontend: Jinja2 templates in `templates/` plus `static/` assets (vanilla JS + OpenLayers). Vite is used in the frontend build pipeline (see `package.json` / `vite.config.js`) and built assets are placed in `static/dist` by the Docker multi-stage build.
- DB: Postgres (docker) + SQLModel/SQLAlchemy + Alembic migrations. The app expects the DB service name `db` (compose) and `POSTGRES_*` env vars set via `example.env` / `.env`.

## Docker / Build Gotchas
- Multi-stage build: the Dockerfile builds the frontend with Node then copies `static/dist` into the Python image. If you `docker build` without providing built assets or running the frontend stage, you may miss `static/dist` for non-volume builds.
- Runtime graph: `docker-entrypoint.sh` looks for `graph_generation/elevation_populated_igraph.pkl` and will download a release artifact if missing. Local `.pkl` files are typically large and may be LFS-tracked; use `git lfs install && git lfs pull` when working from a clone that uses LFS.
- Compose vs Dockerfile command mismatch: `docker-compose.yml` uses a `gunicorn` command for `web-fastapi` (prod) and includes a commented `uvicorn` dev command. For local debugging prefer the `uvicorn` command or use the mapped port `5001`.
- Environment files: `example.env` contains required variable names; `.env` may override secrets locally. Ensure `LOCATIONIQ_API_KEY`, database credentials, and any analytics secrets are present.

## Verification & Style
- No automated tests or CI; verify changes by running the app and exercising:
	- `GET /map` (map view), `POST /calculate_path` (pathfinding), save/load route endpoints, GPX/GeoJSON exports.
- Keep heavy imports and graph-loading logic in `src/extensions.py` / `service` to avoid import-time slowness. Avoid eager re-builds of the graph during simple code edits.
- Follow existing patterns in `src/` for routers: files like `src/Routes/routes_fastapi.py`, `src/Points/points_fastapi.py`, and other `*_fastapi.py` modules register routers used by `src/fastapi_app.py`.

## Tech Stack
- Backend: Python (Docker: 3.11-slim), FastAPI, SQLModel/SQLAlchemy, Alembic, gunicorn/uvicorn
- Pathfinding & Data: igraph / custom A* + KDTree helpers, OSM `.pbf`, SRTM tiles for elevation
- Frontend: HTML/CSS/JS, OpenLayers, Vite (build), static Jinja templates
- Infra: Docker, docker-compose, Postgres 16 (compose), Caddy (reverse proxy), pgAdmin, Umami (analytics)

See [README.md](README.md) for user-facing docs, and reconcile drift against `docker-compose.yml`, `Dockerfile`, `docker-entrypoint.sh`, `graph_generation/`, and `requirements.txt`.
