import math as m
import heapq as h
from scipy.spatial import KDTree

_global_kdtree = None
_global_node_coords = None # stores [(x, y), ...] for index lookups 

def build_global_kdtree(graph):
    """
    Function which builds a KDTree of node coordinates from iGraph vertex attributes  
    """
    global _global_kdtree, _global_node_coords

    # this extracts the coordinate list from the iGraph vertices 
    _global_node_coords = graph.vs['coordinate']

    # this creates the KDTree from the coordinate list (or shows a warning that no KDTree could be made)
    if _global_node_coords:
        _global_kdtree = KDTree(_global_node_coords)
        print(f"Global Node List created with {len(_global_node_coords)} nodes.")
    else:
        print("Warning, no nodes within graph")

class AStarRouteFinder:
    def __init__(self, graph=None, start_id=None, end_id=None, valid_indices_set=None, max_iterations=500000, min_slope=0.0):
        # core algorithm parameters
        self.graph = graph
        self.start_id = start_id # integer node ID 
        self.end_id = end_id     # integer node ID
        self.valid_indices_set = valid_indices_set # this stores the set of allowed nodes to traverse 
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

        # this finds and loops through all outgoing edges from 'current'  
        for edge_index in self.graph.incident(current, mode='out'):
            edge = self.graph.es[edge_index]
            adjacent_node = edge.target

            # this skips neighbour nodes that aren't within the valid_indices_set (i.e they are not within the boundary box)
            if self.valid_indices_set and adjacent_node not in self.valid_indices_set:
                continue
            
            # this skips edges if they are flatter than the minimum requsted slope (will be used in future app versions which allow for users to choose hike difficulties)
            if abs(edge['slope']) < self.min_slope:
                continue

            # this extracts the weight of the edge and creates a cost from it
            weight = edge['cost']
            temp_cost = self.actual_cost[current] + weight

            # this updates the variables if a node is not visited or a quicker path is found 
            if adjacent_node not in self.actual_cost or temp_cost < self.actual_cost[adjacent_node]:
                self.previous_node[adjacent_node] = current
                self.actual_cost[adjacent_node] = temp_cost
                self.full_cost[adjacent_node] = temp_cost + self.heuristic(adjacent_node)
                h.heappush(self.nodes_left, (self.full_cost[adjacent_node], adjacent_node))

    def heuristic(self, node=None):
        """
        Returns a heuristic value based on euclidean distance and a simple elevation penalty 
        """

        if node is None:
            node = self.start_id

        # This extracts x, y coordinates using iGraph vertex attributes 
        x1, y1 = self.graph.vs[node]['coordinate']
        x2, y2 = self.graph.vs[self.end_id]['coordinate']

        # This calculates the Euclidean (straight-line) distance between the two coordinates and provides a base time heuristic value
        euclidean_distance_metres = m.sqrt((x1 - x2)**2 + (y1 - y2)**2)
        base_time = euclidean_distance_metres / 1.4

        # This extracts the elevation of the nodes (lines 100 + 101) and provides a climb penalty (lines 103 + 104)
        current_elev = self.graph.vs[node]['elev']
        end_elev = self.graph.vs[self.end_id]['elev']

        elev_difference = abs(end_elev - current_elev)
        climb_penalty = (elev_difference / 600) * 3600 * 0.3

        # heuristic returned is formed of the time taken to walk the distance + a simple elevation penalty 
        return base_time + climb_penalty
    

def snap_to_largest_component(graph, start_coord, end_coord):
    """
    This finds the nearest node IDs to the inputted coordinates
    """

    coordinates = graph.vs['coordinate']
    if not coordinates:
        return None, None
    
    tree = KDTree(coordinates) # this forms a KD-Tree using the list of coordinates

    _, start_idx = tree.query(start_coord) # the second return value is the index of the node within the graph that corresponds to the given 'start_coord'
    _, end_idx = tree.query(end_coord) # the second return value is the index of the node within the graph that corresponds to the given 'end_coord'
    return start_idx, end_idx


def a_star(graph, start_xy, end_xy, min_slope=0.0):
    if _global_kdtree is None:
        build_global_kdtree(graph)  # fallback, as the load_graph(graph) (see the Nodefinder class within src/Pathfinding/Nodefinder.py) method builds the KDTree

    # This finds the start and end IDs within the KDTree instantly 
    _, global_start_id = _global_kdtree.query(start_xy)
    _, global_end_id = _global_kdtree.query(end_xy)

    # This calculates the bbox (bounding box)

    buffer = 5000  # 5000 metres, increased from 2000m as 2000m sometimes meant that paths could not be found, especially across ridge walks 

    # This takes the minimum value and subtract the buffer
    # and takes the maximum value and adds the buffer
    # for both the x and y coordinate of the start and end points to create a rectangle 
    min_x = min(start_xy[0], end_xy[0]) - buffer 
    max_x = max(start_xy[0], end_xy[0]) + buffer
    min_y = min(start_xy[1], end_xy[1]) - buffer
    max_y = max(start_xy[1], end_xy[1]) + buffer

    # this finds the coordinate for the centre of the rectangle, used to make a diagonal radius 
    # a diagonal radius is used to ensure that ALL four corners of the rectangle are included within the circle queried by the KDTree.query_ball_point() method 
    centre_x = (start_xy[0] + end_xy[0]) / 2
    centre_y = (start_xy[1] + end_xy[1]) / 2
    bbox_half_diag = ((max_x - min_x)**2 + (max_y - min_y)**2)**0.5 / 2
    radius = bbox_half_diag

    # This filters node indicies within the given circular area using the global KDTree 
    candidate_indices = _global_kdtree.query_ball_point([centre_x, centre_y], radius)

    # This filters nodes further with the bounding box by cutting nodes off that are outside of the rectangle
    # after the KDTree queried for the circle (which has a larger surface area than the rectangle)
    valid_indices_set = set()
    for index in candidate_indices:
        x, y = _global_node_coords[index]
        if min_x <= x <= max_x and min_y <= y <= max_y:
            valid_indices_set.add(index)
    
    # This ensures that the start and end node IDs are in the set
    valid_indices_set.add(global_start_id)
    valid_indices_set.add(global_end_id)
    
    if not valid_indices_set:
        print("No nodes in search area")
        return None, None, None

    pathfinder = AStarRouteFinder(
        graph=graph,
        start_id=global_start_id,
        end_id=global_end_id,
        valid_indices_set=valid_indices_set,
        min_slope=min_slope
    )

    global_path = pathfinder.find_path()

    return global_path, global_start_id, global_end_id