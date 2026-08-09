# This builds the frontend 

FROM node:22-slim AS frontend
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM python:3.11-slim-bookworm

WORKDIR /app

# copies the requirements for parsing the file of unrequired libraries
COPY requirements.txt .

# this upgrades pip
RUN pip install --upgrade pip

# this runs the new requirements
RUN pip install -r requirements.txt

# this installs pg_isready so the entrypoint can wait for postgres
# it also installs curl (to be used when getting the graph)
# no install recommends is used to keep the layer small
RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-client curl \
 && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /app/Pathfinding

# this copies python backend 
COPY src/ /app/src/

# copies the built frontend assets
COPY --from=frontend /app/static/dist /app/static/dist

# this puts my js, html and css into the container 
COPY templates/ templates/
COPY static/ static/

# database copies 
COPY alembic.ini /app/alembic.ini
COPY migrations/ migrations/

# this sets the python path so imports are clean
ENV PYTHONPATH=/app/src

# allows app to run on the localhost:5000 port
EXPOSE 5000

# this entrypoint runs migrations plus eager graph load on every container start
COPY docker-entrypoint.sh /app/
RUN chmod +x /app/docker-entrypoint.sh
ENTRYPOINT [ "/app/docker-entrypoint.sh" ]

# default command
CMD [ "gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--preload", "--access-logfile", "-", "src.app:app" ]
