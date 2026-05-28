<p align="center">
  <img src="./assets/images/Crest-Logo.png" width="200">
  <br>
  <p><i>Crestr is an open-source, hiking route planner for Cumbria, aiming to make hiking more accessible</i></p>
</p>

<p align="center">
  <a href="user/getting-started.md" class="md-button md-button--primary">
    Get Started
  </a>
  <a href="user/automatic-routing.md" class="md-button md-button--primary">
  User guide
  </a>
</p>

---

# Quick Start

``` bash
# clone the repo
git clone https://github.com/abdlfc11/Crestr-Hiking-App.git

# go to the project directory
cd Crestr-Hiking-App

# create a docker container for the app
docker-compose up --build
```
Finally, access the app at [localhost:5000](http://localhost:5000){:target="_blank"}

# Features

Crest aims to give users the features they pay for in other apps such as:

- **An Interactive topographic map**: View paths and landmarks in detail at a high resolution
- **Auto mode**: Generate routes using a custom A\* routing engine built from the ground up
- **Manual mode**: click on the map to create points which make up a route, now supporting snap-to-path
- **Search**: Search for any area in Great Britain and the map will be taken there
- **POIs**: Save points of interest to your account
- **Export routes** in:
    - **GPX**: for GPS watches and handheld devices
    - **GeoJSON**: for Google Maps, Strava, OS Maps, and more