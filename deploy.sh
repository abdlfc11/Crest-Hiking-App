#!/bin/bash

cd Crestr-Hiking-App
git pull
docker compose up -d --build
docker image prune -f