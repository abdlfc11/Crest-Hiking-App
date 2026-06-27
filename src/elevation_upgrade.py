from app import NodeFinder as n
import rasterio as r
import numpy as np
import pickle as p
import math

node_finder = n() # this is the class containing projection conversion helpers
avg_walking_speed_metres = 1.4 # used for Naismith rule

terrain_costs = {
    # sac_scale
    "demanding_mountain_hiking": 1.70,
    "alpine_hiking": 1.90,
    "demanding_alpine_hiking": 2.40,
    "difficult_alpine_hiking": 3.00,

    # trail_visibility
    "bad": 1.50,
    "intermediate": 1.30,
    "horrible": 2.20,
    "no": 2.80,

    # surface
    "rock": 1.65,
    "scree": 1.80,
    "boulders": 2.30,
    "mud": 1.45,
    "sand": 1.35,
    "gravel": 1.15,
    "asphalt": 0.95,
    "concrete": 0.93,
    "paved": 0.90,
}

with open("Pathfinding/new_path_graph.pkl", "rb") as node_file:
    print("loading graph")
    node_graph = p.load(node_file)

nodes = node_graph.nodes() # this is a live view of all the nodes in my graph

web_mercator_node_coordinates = list(nodes) # this is list of all those nodes' coords so operations can be applied to them

# the below function produces a node coord list of which the projection is WGS84 instead of Web Mercator
def translate_coords(coords_tuple: tuple) -> list:
    WGS84 = []
    for (x, y) in coords_tuple:
        lon, lat = node_finder.convert_web_mercator_to_wgs84(x, y)
        WGS84.append((lon, lat))
    return WGS84

print("Translating nodes")
WGS84_coords = translate_coords(web_mercator_node_coordinates) # making use of the function to generate WGS84 coords
print("Nodes translated")

with r.open("Cumbria-Elevation-File.tif") as elevation_raster: # opens the .tif file containing elevation data
    print("opened elevation file")
    print(elevation_raster.crs)
    elev_samples = list(elevation_raster.sample(WGS84_coords)) # gains the elevation associated with each coordinate in the WGS84 coords

nodata = elevation_raster.nodata

for (coord, elev) in zip(web_mercator_node_coordinates, elev_samples): # for each coordinate and elevation value in the zipped Web Mercator coordinates and elevation values

    val = elev[0]

    if val == nodata:
        val = 0

    node_graph.nodes[coord]['elev'] = float(val) # attaches the elevation in metres as an attribute to the node data item

# this is a function used to calculate the weight of an edge using Naismith's rule
def naismith_helper(horizontal_distance_metres: float, elevation_difference_metres: float) -> dict: # takes euclidean distance and the elevation difference as parameters
    ascent_metres = max(0, elevation_difference_metres) # max is used to ensure there is only a positive value, rather than a negative value for the ASCENT
    descent_metres = abs(min(0, elevation_difference_metres)) # min is used to ensure there is only a negative, or zero, value for the DESCENT
    flat_time = horizontal_distance_metres / avg_walking_speed_metres # this is the time taken to walk the distance if it was a straight line
    climb_time = (ascent_metres / 10) * 60 # this is the time taken to walk UP the slope caused by the difference in elevation
    descent_time = (descent_metres / 7.5) * 60 # this is the time taken to walk DOWN the slope caused by the difference in elevation
    return { # dict is used to reference the helper function more effectively
        "ascent" : flat_time + climb_time,
        "descent" : flat_time + descent_time
    }

# this is a function used to calculate the addition to edge costs based on their surface, sac_scale and visibility tag values
def get_terrain_factor(sac_scale: str, trail_visibility: str, surface: str) -> float:
    factor = 1.0
    
    if sac_scale and sac_scale in terrain_costs:
        factor *= terrain_costs[sac_scale]
    
    if trail_visibility and trail_visibility in terrain_costs:
        factor *= terrain_costs[trail_visibility]
    
    if surface and surface in terrain_costs:
        factor *= terrain_costs[surface]
    
    return factor


# ////// THIS IS WHERE THE ELEVATION ENRICHMENT BEGINS ////// 

print("Edges starting to be modified")
for (start_coord, end_coord, edge_data) in node_graph.edges(data=True): # for each starting coord, end coord and tags of the edge (the dict holding length)
    stretched_distance = edge_data['length'] # tracks the raw stretched map distance from the dictionary
    
    # this calculates the center point latitude of the segment to find the inverse Web Mercator distortion scale factor
    _, mid_lat = node_finder.convert_web_mercator_to_wgs84(
        (start_coord[0] + end_coord[0]) / 2, 
        (start_coord[1] + end_coord[1]) / 2
    )
    scale_factor = 1.0 / math.cos(math.radians(mid_lat))
    horizontal_distance_metres = stretched_distance / scale_factor # adds the corrected horizontal distance to the edge data structure

    start_elevation = node_graph.nodes[start_coord]['elev'] # the elevation is added to the data struct holding the start coord
    end_elevation = node_graph.nodes[end_coord]['elev'] # the elevation is added to the data struct holding the end coord

    elevation_difference_metres = end_elevation - start_elevation 
    slope_ratio = elevation_difference_metres / horizontal_distance_metres if horizontal_distance_metres > 0 else 0 # the slope ratio is calculated (will be used in a filter route feature)

    costs = naismith_helper(horizontal_distance_metres, elevation_difference_metres) # variable set as the return value of the Naismith rule helper

    terrain_factor = get_terrain_factor(
        edge_data.get("sac_scale"),
        edge_data.get("trail_visibility"),
        edge_data.get("surface")
    )

    if elevation_difference_metres >= 0:
        edge_data['cost'] = costs['ascent'] * terrain_factor
    else:
        edge_data['cost'] = costs['descent'] * terrain_factor
        
    edge_data['terrain_factor'] = round(terrain_factor, 2) # terrain factor multiplier is added to the edge data struct
    edge_data['slope'] = slope_ratio # slope ratio is added to the edge data struct

print("Checking nodes")

for i, (node, data) in enumerate(node_graph.nodes(data=True)):
    print(node, data)
    if i == 5:
        break

# new graph is added to the directory 
with open("Pathfinding/better_path_graph.pkl", "wb") as file: 
    p.dump(node_graph, file) 
print("Saved enriched graph successfully.")