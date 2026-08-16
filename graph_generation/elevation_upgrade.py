import sys
import os

# This prevents 'ModuleNotFoundError's
# run file via this command : 'python -m graph_generation.elevation_upgrade'
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src")))

from src.Pathfinding.Nodefinder import NodeFinder as n
from src.Routes.helpers import naismith_helper
import rasterio as r
import pickle as p
import math

node_finder = n() # this is the class containing projection conversion helpers
avg_walking_speed_metres = None # used for Naismith rule

# This dictionary sets multipliers 
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

# This loads the graph 
with open("graph_generation/unpopulated_igraph.pkl", "rb") as file:
    print("Loading graph...")
    graph, node_to_id = p.load(file)


def translate_coords(coords_tuple: tuple) -> list:
    """
    Produces a node coord list of which the projection is WGS84 instead of Web Mercator for elevation sampling 
    """
    WGS84 = []
    for (x, y) in coords_tuple:
        lon, lat = node_finder.convert_web_mercator_to_wgs84(x, y)
        WGS84.append((lon, lat))
    return WGS84

# this gets all node coordinates (stored in ['coordinate'])
web_mercator_node_coordinates = graph.vs['coordinate']

print("Translating nodes to WGS84...")
WGS84_coords = translate_coords(web_mercator_node_coordinates)
print("Nodes translated.")

# this samples elevation from the raster file 
with r.open("Cumbria-Elevation-File.tif") as elevation_raster: # opens the .tif file containing elevation data
    print("opened elevation file")
    print(f"ELEVATION FILE ESPG: {elevation_raster.crs}")
    elev_samples = list(elevation_raster.sample(WGS84_coords)) # gains the elevation associated with each coordinate in the WGS84 coords

nodata = elevation_raster.nodata

# this assigns elevation to each vertex 
for i, elev in enumerate(elev_samples):
    value = elev[0]
    if value == nodata or value is None:
        value = 0
    graph.vs[i]['elev'] = float(value)

print(f"Elevation added to all vertices\nTest: {graph.vs[100]['elev']}")

#region HELPER FUNCTIONS

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

def get_edge_or_node_attribute(edge_or_node, attribute_name: str, default=None):
    """
    Function responsible for retrieving the attributes of iGraph edges / nodes
    """
    try:
        return edge_or_node[attribute_name]
    except Exception:
        return default

#endregion

# ////// THIS IS WHERE THE ELEVATION ENRICHMENT BEGINS ////// 

print("Edges starting to be modified")

for edge_index in range(graph.ecount()):
    edge = graph.es[edge_index]
    start_id = edge.source
    end_id = edge.target

    start_coord = graph.vs[start_id]['coordinate']
    end_coord = graph.vs[end_id]['coordinate']

    stretched_distance = edge['length'] # tracks the raw stretched map distance 

    # This corrects for Web Mercator distortion using midpoint latitude
    _, mid_lat = node_finder.convert_web_mercator_to_wgs84(
        (start_coord[0] + end_coord[0]) / 2, 
        (start_coord[1] + end_coord[1]) / 2
    )

    scale_factor = 1.0 / math.cos(math.radians(mid_lat))
    horizontal_distance_metres = stretched_distance / scale_factor

    start_elev = graph.vs[start_id]['elev']
    end_elev = graph.vs[end_id]['elev']

    elevation_difference = end_elev - start_elev
    slope_ratio = elevation_difference / horizontal_distance_metres if horizontal_distance_metres > 0 else 0

    costs = naismith_helper(horizontal_distance_metres, elevation_difference, slope_ratio)

    terrain_factor = get_terrain_factor(
        get_edge_or_node_attribute(edge, 'sac_scale'),
        get_edge_or_node_attribute(edge, 'trail_visibility'),
        get_edge_or_node_attribute(edge, 'surface')
    )

    if elevation_difference >= 0:
        edge["cost"] = costs["ascent"] * terrain_factor
    else:
        edge["cost"] = costs["descent"] * terrain_factor

    edge["terrain_factor"] = round(terrain_factor, 2)
    edge["slope"] = slope_ratio

print("Edge enrichment completed.")

# This saves the graph 
with open("graph_generation/cache/elevation_populated_igraph.pkl", "wb") as file:
    p.dump((graph, node_to_id), file)

print("Saved enriched igraph successfully.")


# This is a quick inspection for validation
print("\nSample vertices:")
for i in range(min(5, graph.vcount())):
    print(graph.vs[i]["coordinate"], "elev =", get_edge_or_node_attribute(graph.vs[i], 'elev'))