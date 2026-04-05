# Crest — Hiking Route Finder



> Hosting is in process
---


An open-source alternative to paid hiking apps, built for hikers who want to plan, save, and export routes without a subscription. Crest lets you generate optimal hiking routes within the county of Cumbria, save points of interest, and export your routes in standard formats compatible with GPS devices and popular mapping apps.
~~Manual route creation as well as the plotting of points across the entire world is supported~~.
After the addition of snap to paths in manual routing on 1st April 2026, manual routing is no longer possible outside of Cumbria. 

> **Disclaimer:** Crest is intended as a desktop planning tool only. Always 
carry an OS map and compass, check weather conditions, and do not rely solely 
on this app for navigation in the field. Never use routes that, upon your discretion, is above your skill level.

---

> Built as my A-level Computer Science NEA project, using a custom A\* pathfinding algorithm over a graph of just over 990,000 OSM nodes and over 2M edges.

---

## Setup

### Prequisites
You must have [Docker](https://www.docker.com/products/docker-desktop/) installed and running.

### Downloading the repo
Clone the repo as can be seen below 
```
git clone https://github.com/abdlfc11/Crest-Hiking-App.git
cd hiking_app
```

### Making the Environment file
Create a .env file in the hiking_app directory

Copy and Paste the below into the .env file and replace the variables **excepting the LOCATIONIQAPI and DATABASE_URI variable** with your own values (they can be anything)
```
FLASK_SECRET_KEY=dev_secret_key
LOCATIONIQ_API_KEY=your_own_key
DATABASE_URI=postgresql://[POSTGRES_USER]:[POSTGRES_PASSWORD]@db:5432/[POSTGRES_DB]
POSTGRES_USER=pick_a_username
POSTGRES_PASSWORD=pick_a_password
POSTGRES_DB=pick_a_name_for_your_database
```
**For the LOCATIONIQAPI** variable you must make an account and retrieve an API key from [their site](https://locationiq.com)

**For the DATABASE URI** variable, replace the replace placeholder such as [POSTGRES_DB]

using the example variables above the URI would be postgresql://pick_a_username:pick_a_password@db:5432/pick_a_name_for_your_database

### Running with Docker 
You can start the app using docker-compose, the exact command is shown below
```
docker-compose up --build
```
### Accessing the App
The app should now be able to be accessed in your web browser at [](http://localhost:5000)

### Choosing A Username and Password 
Username and Password conditions are to be added to the login page as soon as possible but for now the conditions will be shown here

Conditions for a username are:
  - must not be the same as the username of a separate user you may have added
  - must have 8 or more characters

Conditions for a password are :
  - The password must be at least 12 characters
  - The password must have a special character
  - The password must have at least one numerical digit

## Features

- **Interactive topographic map** of the world
- **Auto mode** — use saved points, or the set by centre button on the map to set start/end points via crosshair
- **Manual mode** — click on the map to create points which make up a route
- **Search** up any area in Great Britain and the map will be taken there
- **Save points of interest** to your account
- **Generate and save routes** using a custom A\* algorithm
- **Export routes** in:
  - **GPX** — for GPS watches and handheld devices
  - **GeoJSON** — for Google Maps, Strava, OS Maps, and more
- **User accounts** — register, log in, and manage your saved routes

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript, OpenLayers |
| Backend | Python, Flask |
| Database | PostgreSQL + SQLAlchemy ORM |
| Pathfinding | Custom A\* algorithm + KDTree spatial indexing |
| Map Data | OpenStreetMap (OSM) via XML parsing |
| Auth | Flask session-based authentication |

---


## Using the Route Maker

### Generating a Route 
You can either enter coordinates directly, use the set by centre button, or use point names to generate routes

Examples can be seen below:

#### Using the set-by-centre button
![SCR-20260331-ozxt](https://github.com/user-attachments/assets/1b59370f-1a5a-4ec0-bc64-6f38b6c045b6)


Pressing the highlighted buttons above will retrieve the coordinates in the middle of the map, shown by the crosshair (which is also highlighted), and place them into their respective start or end coodinate entries

### How Routes are Presented

#### Automatically Generated Routes 
The program will automatically move to the centre of the route if the route was generated as opposed to being manually created. The Elevation change (elevation gain will eventually be added to join elevation change or replace it) as well as the distance will be displayed. As can be seen in the two screenshots below, the distance can be displayed either in KM or Miles. Along with this, the estimated time taken to complete the route is displayed. Currently there is only support for one way routes, but eventually round trip routes will be available to choose as an option. 

![SCR-20260327-bclx](https://github.com/user-attachments/assets/17386e7c-da2a-4bdd-8866-a3aef48cde48)
*Wasdale Campsite → Scafell Pike | 4.03km | +899m | ETA 2h 21m*

![SCR-20260327-beza](https://github.com/user-attachments/assets/ee520d4d-baf3-4d1e-84be-63d55aa043f0)
*Wasdale Campsite → Scafell Pike | 2.46 Miles | +903m | ETA 2h 20m*

#### Manually Generated Routes
Currently, manually plotted routes **do not have elevation data available nor snap to paths**. This is because I am pre-occupied with exams and, unfortunately, don't have the time to add elevation data.
Due to this, manually plotted routes **will not use Naismith's rule** and thus **ETA calculations are inaccurate**. As well as this the **elevation change value will show 'N/A'** as can be seen below

![SCR-20260331-pgep](https://github.com/user-attachments/assets/db4ff1dc-1ab9-4aff-9784-10b1b333b888)
This is during the creation of a manually plotted route

![SCR-20260331-pgso](https://github.com/user-attachments/assets/d73f6504-baab-4d35-933f-b52ac68995ac)
This is after loading a manually plotted route

## How It Works

Routes are generated using a custom implementation of the **A\* search algorithm**, operating over a graph built from OpenStreetMap XML data (~100,000+ nodes). Spatial lookups are accelerated using a **KDTree**, which makes finding nearby nodes from an entered coordinate fast even at that scale.

Routes and saved points are stored in a **PostgreSQL database** via SQLAlchemy, linked to user accounts so everything persists between sessions.

### The A* Algorithm
The A* pathfinding algorithm was chosen, as I needed a heuristic that allowed me to increase edge weights according to the elevation gain between nodes. I have modified the algorithm so that it cuts the graph significantly in accordance to the boundaries calculated, which use a 1.5KM buffer around the start and end coordinates. This greatly reduced the time spent calculating a route, meaning there is near instant calculation of routes, both in automatic route generation and manual route creation (via snap to paths). As mentioned earlier, the heuristic uses the cost of the edge whereby elevation data (and other data such as a slope gradient which will be used for difficulty settings in a later iteration) is baked into the cost (as the cost is a tuple). 

#### KDTree
I implemented a KDTree in finding the start and end nodes relative to the start and end coordinates inputted by the user. This is significant as it reduces the time spent on finding start and end points, as I had to increase the number of nodes and edges the graph had to expand from the Lake District, to the entire county of Cumbria to accommodate for a larger area, as stakeholders identified that as a result of the bounding box being too restrictive, the area that users could generate routes within were too limited. 

The KDTree is a specialised data structure which makes searching through a large array of nodes faster, as it uses binary partitions (which divide each element within the array to exactly two groups each time the partition occurs) to divide elements of more than one dimensions (of which are my x and y coordinates in two dimension). This makes searching for nodes faster as the one half of the elements being searched are discarded with each binary partition, significantly reducing the time spent on finding the start and end nodes relative to the coordinates entered by the user. This was implemented into my program using the [scipy.spatial library](https://docs.scipy.org/doc/scipy/reference/generated/scipy.spatial.KDTree.html)

#### Elevation Data
I used SRTM data via the [elevation library available in python](https://pypi.org/project/elevation/), and extracted a .tif file for elevation within the bounds that Cumbria is held in. I had to modify my graph slightly and change the graph from an undirected graph to a directed graph as the descent time is slightly shorter than the ascent but significantly longer than a flat walking distance **(the significance of this is that without this change a descent from scafell pike to wasdale head is calculated as 2hrs shorter)**. I then retrieved all the nodes of the graph, and iterated through them via a for loop to add elevation data to each node using rasterio's _dataset_.sample() method, having passed both my coordinates and the elevation to this method.

---

## Export Formats

| Format | Compatible With |
|---|---|
| `.gpx` | Garmin watches, handheld GPS devices, Komoot |
| `.geojson` | Google Maps, Strava, OS Maps, any GIS tool |

---

## Roadmap

- [x] Add screenshots
- [ ] Expand automatic route creation beyond the Lake District
- [x] Route elevation profiles
- [x] Snap to Paths for Manual Routing
- [ ] Elevation data in Manual Routine
- [ ] Tag Data (such as trail_visibility and surface) in Pathfinding
- [ ] Transition to a Bi-Directional A* algorithm

---

## License

This project is open source as per the MIT license. Feel free to use it, fork it, or build on top of it.

---

*Made by [Abdul](https://github.com/abdlfc11)*
