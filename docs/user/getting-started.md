Follow this detailed guide to set up and run **Crestr** on your local machine.

## Prerequisites

Before starting, ensure you have the following installed:

- **Git** - To clone the repository  
  [Download Git](https://git-scm.com/downloads)

- **Docker** & **Docker Compose** - The app runs locally via Docker containers  
    - Docker Desktop: [Install Docker](https://docs.docker.com/get-docker/)  
    - Docker Compose is included with Docker Desktop (v2+)

---

## Step-by-Step Installation

### Users

#### 1. Clone the Repository

Open your terminal and run:

```bash
# Clone the project
git clone https://github.com/abdlfc11/Crestr-Hiking-App.git

# Navigate into the project folder
cd Crestr-Hiking-App
```

#### 2. After cloning you should see a project structure similar to this

```
Crestr-Hiking-App/
├── docker-compose.yml
├── Dockerfile
├── src/
│   ├── app.py
│   ├── pathfinder.py
│   └── config.py
|   └── ... 
├── data/
├── README.md
└── requirements.txt
└── ...
```

#### 3. Build and Start the App

Run the following command to build the Docker image and start all services

``` bash
docker-compose up --build
```

##### Useful commands

``` bash
docker-compose up --build -d # this builds and starts services in the background (detached mode)
docker-compose --build --force-recreate # this force builds everything and restarts services
docker-compose logs -f # this allows you to follow logs in real time
```

#### 4. Access the App
Wait until the containers are running
<br>
Once they are, the app should  be accessible via [localhost:5000](http://localhost:5000), opening on the Crestr homepage

####  5. Common Issues + Troubleshooting

| Issue          | Solution |
| :----------------: | :------: | 
| Port 5000 already in use      |   Change the port in docker-compose.yml   | 
| Docker permission error           |   Run with sudo (linux) or ensure Docker Desktop is operational   | 
| Build fails    |  run docker system prune -f and try again   | 

### Developers

If you want to run the app locally you can do so with the commands below:

``` bash
# Clone the project
git clone https://github.com/abdlfc11/Crestr-Hiking-App.git

# Navigate into the project folder
cd Crestr-Hiking-App

# Create a virtual environment
python -m venv venv

# Activate virtual environment

# Windows:
venv\Scripts\activate

# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the Flask app
cd src
python app.py
```

The app should then be accessible at [localhost:5000](http://localhost:5000)