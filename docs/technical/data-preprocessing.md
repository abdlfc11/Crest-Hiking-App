# Data Preprocessing

# Downloading Data

> This section of data preprocessing focuses on obtaining .osm.pbf files that contain geographic information, which will then be used to form the graph used in pathfinding

OSM (Open Street Map) data is installed via [Geofabric](https://download.geofabrik.de)

# Parsing Data

> This section of data preprocessing focuses on converting the raw downloaded file and turning it into a graph which will then be used by the A\* algorithm during routing

## Overview

The order of parsing the downloaded file is as such:

- **Osmium**: This is where tags such as 'sac_scale', 'trail_visibility' and 'surface' are added to the osm.pbf file to be used in the calculation of cost multipliers
- **Graph Generation**: This is where libraries such as [NetworkX](https://networkx.org/en/), [Pyrosm](https://pyrosm.readthedocs.io/en/latest/) and [Shapely](https://shapely.readthedocs.io/en/stable/) are used to create the directed graph that is then passed onto a second python script to add elevation data to the graph
- **Elevation Encrichment**: This is where NASA SRTM elevation data is added to each node, as well as where a slope factor is set on each graph edge

## Osmium

This file is then passed through an [Osmium](https://osmcode.org) ``` cat ``` command (see below).

``` bash
osmium cat [INPUT FILE PATH] -o [OUTPUT FILE PATH]
```

This is done so as to extract the metadata tags that are used in the calculation of cost multipliers to graph edges, whereby this is used to ensure that the A\* algorithm routes around paths that are less safe. 

## Python Scripts

Two python scripts are used to form the graph, with the first being used to extract geographic information from the .osm.pbf file outputted by the ``` osmium cat``` command and the second being used to add downloaded elevation data into the graph, as well as for calculating slope factors (which will be/is used to provide a difficulty filter for users when routing)

### Graph Generation

NetworkX is used here to parse the osm.pbf file into a graph formed of nodes and edges. 

Each node is stored in the British National Grid format (EPSG: 27000) and in the following format: 

``` bash
Node : (x: float, y: float)
{
    'elev': float # elevation in metres
}
```

Each node has 2 values, forming the x and y coordinate, stored as a float. 

They also have one attribute of which is an elevation attribute, also stored as a float in metres

Each edge is stored in the following format:

``` bash
Edge : ((x1: float, y1: float), (x2: float, y2: float))

{
    'length': [VALUE: float],
    'sac_scale': [VALUE: string],
    'surface': [VALUE: string],
    'trail_visibility': [VALUE: string]
}
```

Each edge has 2 values of which are the start coordinates and the destination coordinates, with values within these being stored as a float.

Each edge also has 4 attributes. 

The length attribute is the distance between the start and end coordinate in metres, whilst the other 3 attributes are meta tags and hold the strings of the tags, i.e 'gravel' for surface or 'poor' for trail_visibility. This is then converted into a cost during elevation enrichment.

### Elevation Enrichment

During elevation enrichment, a dictionary of costs are used, holding numbers that correspond to every possible value that each tag could hold. 

Each edge is looped through, and the value of each tag is passed into a handmade function which returns a multiplier value. 

The multiplier value is then mulitplied with the ascent value if the elevation difference is positive, or the descent value if the elevation difference is negative. The result is then added to the edge as a cost attribute.  

After this, a slope ratio is calculated by dividing the elevation difference in metres by the length attribute of the edge (if the value of this attribute is greater than zero), with this then being set to the 'slope' attribute of the edge.

The result is that each edge now has the following structure: 

``` bash
Edge : ((x1: float, y1: float), (x2: float, y2: float))

{
    'length': [VALUE: float], 
    'cost': [VALUE: float], 
    'slope': [VALUE: float]
    }
```
