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

# this copies the rest of the app into the container
COPY app.py config.py Pathfinding/path_downloader.py Pathfinding/new_path_graph.pkl pathfinder.py /app/

# this puts my js, html and css into the container 
COPY templates/ templates/
COPY static/ static/

# allows app to run on the localhost:5000 port
EXPOSE 5000

# so that my app runs immediately 
CMD ["python", "app.py"]