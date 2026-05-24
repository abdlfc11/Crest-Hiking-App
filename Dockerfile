# Use official Python image
FROM python:3.14

# Set working directory
WORKDIR /app

# copies the requirements for parsing the file of unrequired libraries
COPY requirements.txt .

# this upgrades pip
RUN pip install --upgrade pip

# this runs the new requirements
RUN pip install -r requirements.txt

# this installs pg_isready so the entrypoint can wait for postgres
# no install recommends is used to keep the layer small
RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-client \
 && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /app/Pathfinding

COPY Pathfinding/better_path_graph.pkl /app/Pathfinding/better_path_graph.pkl

# this copies the rest of the app into the container
COPY app.py config.py pathfinder.py /app/

# this puts my js, html and css into the container 
COPY templates/ templates/
COPY static/ static/
COPY migrations/ migrations/

# allows app to run on the localhost:5000 port
EXPOSE 5000

# this entrypoint runs migrations plus eager graph load on every container start
COPY docker-entrypoint.sh /app/
RUN chmod +x /app/docker-entrypoint.sh
ENTRYPOINT [ "/app/docker-entrypoint.sh" ]
CMD [ "gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--preload", "--access-logfile", "-", "app:app" ]
