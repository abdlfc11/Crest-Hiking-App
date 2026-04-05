import math as m
import heapq as h
from scipy.spatial import KDTree
import networkx as nx

_global_kdtree = None
_global_node_list = None

def build_global_kdtree(graph):
    global _global_kdtree, _global_node_list
    _global_node_list = list(graph.nodes())
    if _global_node_list:
        _global_kdtree = KDTree(_global_node_list)
        print(f"Global Node List created with {len(_global_node_list)} nodes.")
    else:
        print("Warning, no nodes within graph")

class AStarRouteFinder:
    def __init__(self, graph=None, start_id=None, end_id=None, max_iterations=500000, min_slope=0.0):
        # core algorithm parameters
        self.graph = graph
        self.start_id = start_id
        self.end_id = end_id
        self.max_iterations = max_iterations
        self.min_slope = min_slope 
        
        # pathfinding state (only the essential data structures)
        self.nodes_left = []  # priority queue of nodes to explore
        self.previous_node = {}  # tracks path back to start
        self.actual_cost = {}    # cost from start to each node
        self.full_cost = {}      # total estimated cost (actual + heuristic)

    def find_path(self):
        # starts the search
        self.nodes_left = []
        h.heappush(self.nodes_left, (0, self.start_id))
        self.actual_cost[self.start_id] = 0
        self.full_cost[self.start_id] = self.heuristic()
        
        iterations = 0
        while self.nodes_left and iterations < self.max_iterations:
            iterations += 1
            _, current = h.heappop(self.nodes_left)

            # this returns the path once the end node is found
            if current == self.end_id:  
                path = [current]
                while current in self.previous_node:
                    current = self.previous_node[current]
                    path.append(current)
                return path[::-1]
            else:
                self.explore_neighbors(current)

        print(f"A* stopped after {iterations} iterations")
        return None

    def explore_neighbors(self, current):

        for adjacent_node in self.graph.neighbors(current):

            edge = self.graph[current][adjacent_node]

            if abs(edge['slope']) < self.min_slope:
                continue

            weight = self.graph[current][adjacent_node]["cost"]
            temp_cost = self.actual_cost[current] + weight

            if adjacent_node not in self.actual_cost or temp_cost < self.actual_cost[adjacent_node]:
                # This updates the variables if a node is not visited, or if a quicker path is found
                self.previous_node[adjacent_node] = current
                self.actual_cost[adjacent_node] = temp_cost
                self.full_cost[adjacent_node] = temp_cost + self.heuristic(adjacent_node)
                h.heappush(self.nodes_left, (self.full_cost[adjacent_node], adjacent_node))

    def heuristic(self, node=None):
        # This calculates the Euclidean distance between two given points
        if node is None:
            node = self.start_id

        # Extract x,y coordinates 
        x1, y1 = node[:2]
        x2, y2 = self.end_id[:2]

        euclidean_distance_metres = m.sqrt((x1 - x2)**2 + (y1 - y2)**2)

        base_time = euclidean_distance_metres / 1.4

        current_elev = self.graph.nodes[node].get("elev", 0)
        end_elev = self.graph.nodes[self.end_id].get("elev", 0)

        elev_difference = abs(end_elev - current_elev)

        climb_penalty = (elev_difference / 600) * 3600 * 0.3

        return base_time + climb_penalty
    

def snap_to_largest_component(graph, start_id, end_id):


    nodes = list(graph.nodes()) # this creats a list of the nodes of the smaller groups of nodes
    if not nodes:
        return None


    tree = KDTree(nodes) # this forms a KD-Tree using the list of nodes

    _, start_idx = tree.query(start_id) # the second variable is an array of nodes for the start point
    _, end_idx = tree.query(end_id) # the second variable is an array of nodes for the end point

    return nodes[start_idx], nodes[end_idx]


def a_star(graph, start_xy, end_xy, min_slope=0.0):
    if _global_kdtree is None:
        build_global_kdtree(graph)  # fallback, but better to call once at startup

    buffer = 2000  

    # used to calculate bbox
    min_x = min(start_xy[0], end_xy[0]) - buffer
    max_x = max(start_xy[0], end_xy[0]) + buffer
    min_y = min(start_xy[1], end_xy[1]) - buffer
    max_y = max(start_xy[1], end_xy[1]) + buffer

    centre_x = (start_xy[0] + end_xy[0]) / 2
    centre_y = (start_xy[1] + end_xy[1]) / 2
    bbox_half_diag = ((max_x - min_x)**2 + (max_y - min_y)**2)**0.5 / 2
    radius = bbox_half_diag + buffer * 1.2 

    # filtered nodes
    candidate_indices = _global_kdtree.query_ball_point([centre_x, centre_y], radius)
    candidate_nodes = [_global_node_list[i] for i in candidate_indices]

    # subgraph for much less nodes
    search_graph = graph.subgraph(candidate_nodes).copy()  

    # bbox is applied to reduce nodes even further
    def is_in_bbox(n):
        return min_x <= n[0] <= max_x and min_y <= n[1] <= max_y
    search_graph.remove_nodes_from([n for n in list(search_graph.nodes()) if not is_in_bbox(n)])

    nodes = list(search_graph.nodes())
    if not nodes:
        print("No nodes in search area")
        return None

    # snap nodes to run A*
    tree = KDTree(nodes)
    snapped_start = nodes[tree.query(start_xy)[1]]
    snapped_end = nodes[tree.query(end_xy)[1]]

    pathfinder = AStarRouteFinder(search_graph, snapped_start, snapped_end, min_slope=min_slope)
    path = pathfinder.find_path()

    return path, snapped_start, snapped_end

