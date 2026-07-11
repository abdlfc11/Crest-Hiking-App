# Standard Library Imports
import math as m
from os import path
import pickle as pkl
import time

# Third-Party Library Imports
import networkx as nx
from pyproj import Transformer
from scipy.spatial import KDTree

# Local File Imports
from config import Config
from pathfinder import a_star, build_global_kdtree


class NodeFinder:
    def __init__(self, graph_path=None, max_distance=5000, early_exit_distance=100):
        if graph_path is None:
            graph_path = Config.GRAPH_PATH
        self.graph_path = graph_path
        self._graph = None
        self._kdtree = None
        self.max_distance = max_distance
        self.early_exit_distance = early_exit_distance
        
        # Coord conversions
        self._bng_to_web_mercator = Transformer.from_crs("EPSG:27700", "EPSG:3857", always_xy=True)
        self._bng_to_wgs84 = Transformer.from_crs("EPSG:27700", "EPSG:4326", always_xy=True)
        self._wgs84_to_web_mercator = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
        self._web_mercator_to_wgs84 = Transformer.from_crs("EPSG:3857", "EPSG:4326", always_xy=True)

    def load_graph(self):
        if self._graph is None:
            if not path.exists(self.graph_path):
                raise FileNotFoundError(
                    f"\n\n=== GRAPH FILE MISSING ===\n"
                    f"Expected graph at: {path.abspath(self.graph_path)}\n\n"
                )

            with open(self.graph_path, "rb") as file:
                self._graph = pkl.load(file)

            largest_cc_nodes = max(nx.weakly_connected_components(self._graph), key=len)
            self._graph = self._graph.subgraph(largest_cc_nodes).copy()

            nodes_coords = list(self._graph.nodes())
            self._nodes_list = nodes_coords
            self._kdtree = KDTree(nodes_coords)

            build_global_kdtree(self._graph)

            print(f"Graph initialised with {len(self._nodes_list)} reachable nodes.")

            if self._nodes_list:
                sample_node = self._graph.nodes[self._nodes_list[0]]
                if 'elev' not in sample_node:
                    print("WARNING: Graph loaded successfully but nodes have no 'elev' attribute.")
        
        return self._graph
    
    def convert_bng_to_web_mercator(self, bng_x, bng_y):
        x, y = self._bng_to_web_mercator.transform(bng_x, bng_y)
        return x, y

    def convert_web_mercator_to_bng(self, x, y):
        bng_x, bng_y = self._bng_to_web_mercator.transform(x, y, direction="INVERSE")
        return bng_x, bng_y

    def convert_bng_to_wgs84(self, bng_x, bng_y):
        wgs84_lon, wgs84_lat = self._bng_to_wgs84.transform(bng_x, bng_y)
        return wgs84_lon, wgs84_lat

    def convert_wgs84_to_bng(self, wgs84_lon, wgs84_lat):
        bng_x, bng_y = self._bng_to_wgs84.transform(wgs84_lon, wgs84_lat, direction="INVERSE")
        return bng_x, bng_y
    
    def convert_wgs84_to_web_mercator(self, wgs84_lon, wgs84_lat):
        x, y = self._wgs84_to_web_mercator.transform(wgs84_lon, wgs84_lat)
        return x, y
    
    def convert_web_mercator_to_wgs84(self, x: float, y: float):
        lon, lat = self._web_mercator_to_wgs84.transform(x, y)
        return lon, lat  


    def euclidean_distance(self, node, target_x, target_y):
        return ((node[0] - target_x) ** 2 + (node[1] - target_y) ** 2) ** 0.5
    
    def find_nearest_node(self, target_x, target_y):
        self.load_graph()
        target_point = (target_x, target_y)
        distance, index = self._kdtree.query(target_point)

        if distance > self.max_distance:
            return None  
        
        return self._nodes_list[index]

    def build_route(self, s_x, s_y, e_x, e_y):
        start_time = time.time()
        full_graph = self.load_graph()

        path, start_node, end_node = a_star(full_graph, (s_x, s_y), (e_x, e_y))

        if not path:
            print("Pathfinding failed")
            return None, None, None, None

        end_time = time.time()
        
        time_taken = round(end_time - start_time, 3) * 1000 
        
        return path, start_node, end_node, time_taken

    def calculate_route_distance(self, path):
        # Calculates total distance of the route in true meters
        total_distance_metres = 0
        if len(path) > 1:
            for i in range(1, len(path)):
                if len(path[i]) == 2 and len(path[i-1]) == 2:
                    x1, y1 = path[i-1]
                    x2, y2 = path[i]
                else:
                    continue

                # these calculations compensate for distortion caused by web mercator projection
                
                # this gets the raw web_merc distance
                stretched_distance = ((x2 - x1)**2 + (y2 - y1)**2)**0.5
                
                # this finds the centre latitude of the segment to find out the distortion
                _, mid_lat = self.convert_web_mercator_to_wgs84((x1 + x2) / 2, (y1 + y2) / 2)
                
                # this finds the scale factor, the equation is 1/ cos(latitude_radians)
                scale_factor = 1.0 / m.cos(m.radians(mid_lat))
                
                # this divides the distance by the scale factor to get the real value
                total_distance_metres += (stretched_distance / scale_factor)
                
        return total_distance_metres

    def calculate_eta(self, path, graph):
        total_seconds = sum(
            graph[start_coordinate][end_coordinate]['cost'] for start_coordinate, end_coordinate in zip(path, path[1:])
        )

        return total_seconds

    def calculate_map_center_and_zoom(self, web_mercator_coordinates):
        if len(web_mercator_coordinates) > 1:
            x_coords = [coord[0] for coord in web_mercator_coordinates]
            y_coords = [coord[1] for coord in web_mercator_coordinates]
            
            min_x, max_x = min(x_coords), max(x_coords)
            min_y, max_y = min(y_coords), max(y_coords)
            
            center_x = (min_x + max_x) / 2
            center_y = (min_y + max_y) / 2
            
            width = max_x - min_x
            height = max_y - min_y
            
            padded_width = width * 1.4
            padded_height = height * 1.4
            max_dimension = max(padded_width, padded_height)
            
            if max_dimension < 1000:
                zoom_level = 14
            elif max_dimension < 5000:
                zoom_level = 12
            elif max_dimension < 20000:
                zoom_level = 10
            elif max_dimension < 50000:
                zoom_level = 8
            else:
                zoom_level = 6
            
            map_center = [center_x, center_y]
            map_zoom = zoom_level
        else:
            midpoint = web_mercator_coordinates[0] if web_mercator_coordinates else [0, 0]
            map_center = [midpoint[0], midpoint[1]]
            map_zoom = 10
        
        return map_center, map_zoom
