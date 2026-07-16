import pickle as pickle  # for saving/loading the graph later on
from pyrosm import OSM
from shapely.geometry import LineString, MultiLineString
import json # used to parse Pyrosm OSM data 
from pyproj import Transformer
import igraph as ig # this is the new high performance library to make the pathfinding graph introduced in v0.2.0 of the app, replaced NetworkX


class PathDataProcessor:
    def __init__(self, input_data_path="data/cumbria_full.osm.pbf", output_pickle_path="graph_generation/unpopulated_igraph.pkl", target_epsg=27700):
        self.input_data_path = input_data_path
        self.output_pickle_path = output_pickle_path
        self.target_epsg = target_epsg
        self.edge_count = 0
        self.node_to_id = None # this will be used to store the coordinate to node id dict mapping
    
    def round_point(self, point):
        return(round(point[0], 2), round(point[1], 2))

    def load_paths(self):
        print("Loading path data...") 
        osm = OSM(self.input_data_path)
        all_paths = osm.get_data_by_custom_criteria(custom_filter={"highway": True}, filter_type="keep")
        print(f"Loaded {len(all_paths)} paths")
        print(all_paths.columns)
        print(all_paths["tags"].head(10))
        return all_paths

    def convert_coordinates(self, geodataframe):
        print("Converting coordinates to BNG...")
        converted = geodataframe.to_crs(epsg=self.target_epsg)
        print("Converted.")
        return converted
    
    def transform_graph(self, graph, desired_epsg):
        """
        Function used to transform the graph from BNG coordinate projection [27700] to the desired EPSG, which as of July 2026 is Web Mercator [3857]
        This also transforms the coordinate_to_node mapping dictionary
        """

        transformer = Transformer.from_crs(self.target_epsg, desired_epsg, always_xy=True)

        # for lat / lon 2 dp will mean poor accuracy, for metres, 2 dp is fine
        decimals = 6 if desired_epsg == 4326 else 2

        # this dictionary will hold the updated coordinates to be used to map coordinates to nodes 
        updated_coord_to_id = {}

        # this updates coordinates to the desired projection
        for i in range(graph.vcount()): # for i in range number of vertices in the graph
            old_x, old_y = graph.vs[i]["coordinate"] # this retrieves the coord attribute for node of ID i
            new_x, new_y = transformer.transform(old_x, old_y) # this calculates the new coordinates based on the desired_epsg

            new_coordinate = (round(new_x, decimals), round(new_y, decimals)) # tuple format 

            graph.vs[i]["coordinate"] = new_coordinate

            updated_coord_to_id[new_coordinate] = i
        
        # this overrides the old coord to id mapping with new one
        self.node_to_id = updated_coord_to_id
        
        print(f"Transformation of the graph into EPSG: {desired_epsg} from EPSG: {self.target_epsg} is complete !")
        return graph




        
    def build_graph(self, geodataframe):
        print("Building graph...")

        node_set = set() # set of unique coordinate tuples ((x1, y1), (x2, y2) ... ) -> Prevents duplicate coordinate entries 

        # The below data structures are in order, i.e first sac_scale belongs to first edge, so does first length etc etc 

        edge_list = [] # List of coordinate pairs [ ((x1, y1), (x2, y2)) ... ]
        lengths = [] # List of floats showing lengths
        sac_scales = [] # List of strings showing the sac scale of an edge
        trail_visibilities = [] # List of strings describing the visibility of an edge
        surfaces = [] # List of surfaces showing the surface of an edge
        

        for _, row in geodataframe.iterrows(): # for row in paths (the geodataframe passed in)
            
            # this extracts the geometry of the row, and if there is none it skips the row
            geometry = row.geometry 
            if geometry is None:
                continue
            
            # this handles both LineStrings (one continious segment) and MultiLineStrings (multiple separate segments)
            if isinstance(geometry, LineString):
                segments = [geometry]
            elif isinstance(geometry, MultiLineString):
                segments = geometry.geoms
            
            # this skips any other geometry data 
            else:
                continue
            
            # this extracts the tag data of each row which hold the desired attributes 
            raw_tags = row.get('tags')

            try:
                tags_dict = json.loads(raw_tags) if raw_tags else {}
            except Exception:
                tags_dict = {}
            
            # this extracts desired tags  
            sac = tags_dict.get("sac_scale")
            tv = tags_dict.get("trail_visibility")
            surface = tags_dict.get("surface")

            for segment in segments: # for each line individual line segment 
                
                # this extracts the coordinates of the segment 
                coordinates = list(segment.coords)

                # this for loop adds the coordinates to the node_set and finds the distance
                # within the loop all data structures are populated
                for i in range(len(coordinates) - 1):
                    p1 = self.round_point(coordinates[i])
                    p2 = self.round_point(coordinates[i+1])

                    node_set.add(p1)
                    node_set.add(p2)

                    distance_x = p2[0] - p1[0]
                    distance_y = p2[1] - p1[1]

                    distance = ((distance_x*distance_x) + (distance_y*distance_y))**0.5

                    edge_list.append((p1, p2))
                    lengths.append(distance)
                    sac_scales.append(sac)
                    trail_visibilities.append(tv)
                    surfaces.append(surface)

        # this builds the iGraph object          
        node_list = list(node_set)
        self.node_to_id = {node: index for index, node in enumerate(node_list)}

        graph = ig.Graph(directed=True)
        graph.add_vertices(len(node_list))

        # this stores coordinates on vertices
        graph.vs['coordinate'] = node_list

        # this converts edges to integer IDs
        int_edge_list = [(self.node_to_id[p1], self.node_to_id[p2]) for p1, p2 in edge_list]
        graph.add_edges(int_edge_list)

        # this adds the attributes to Edge IDs: 
        #   - length            (required)
        #   - sac_scale         (if present)  
        #   - trail_visibility  (if present)
        #   - surface           (if present)
        graph.es['length'] = lengths
        if any(sac_scales):
            graph.es['sac_scale'] = sac_scales
        if any(trail_visibilities):
            graph.es['trail_visibility'] = trail_visibilities
        if any(surfaces):
            graph.es['surface'] = surfaces

        print(f"Graph built: {graph.vcount()} nodes/vertices, {graph.ecount()} edges")
        return graph

    def save_graph(self, graph):
        with open(self.output_pickle_path, "wb") as file:
            pickle.dump((graph, self.node_to_id), file)
        print(f"Graph saved as: {self.output_pickle_path.split('/')[-1]}")

    def run(self, output_epsg=3857):
        all_paths = self.load_paths()
        all_paths = self.convert_coordinates(all_paths)
        graph = self.build_graph(all_paths)
        
        final_graph = self.transform_graph(graph, output_epsg)

        self.save_graph(final_graph)

        return final_graph


if __name__ == "__main__":
    builder = PathDataProcessor()
    builder.run()
