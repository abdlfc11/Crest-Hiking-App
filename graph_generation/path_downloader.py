import networkx as nx  # used to make a graph of nodes + edges
import pickle as pickle  # for saving/loading the graph later on
from pyrosm import OSM
from shapely.geometry import LineString, MultiLineString
import json # used to parse Pyrosm OSM data 
from pyproj import Transformer


class PathDataProcessor:
    def __init__(self, input_data_path="data/cumbria_full.osm.pbf", output_pickle_path="graph_generation/unpopulated_graph.pkl", target_epsg=27700):
        self.input_data_path = input_data_path
        self.output_pickle_path = output_pickle_path
        self.target_epsg = target_epsg
        self.edge_count = 0
    
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

        transformer = Transformer.from_crs(self.target_epsg, desired_epsg, always_xy=True)

        # for lat / lon 2 dp will mean poor accuracy, for metres, 2 dp is fine
        decimals = 6 if desired_epsg == 4326 else 2

        nodes = {}
        for node in graph.nodes:
            new_x, new_y = transformer.transform(node[0], node[1])
            nodes[node] = (round(new_x, decimals), round(new_y, decimals))

        # nx.relabel_nodes copies the data from the graph and updates the nodes to use the appropriate distances
        transformed_graph = nx.relabel_nodes(graph, nodes)
        print("Transformation is complete")
        return transformed_graph

    def build_graph(self, geodataframe):
        print("Building graph...")
        graph = nx.DiGraph()
        self.edge_count = 0


        
        for index, row in geodataframe.iterrows():
            geometry = row.geometry

            if geometry is None:
                continue

            if isinstance(geometry, LineString):
                segments = [geometry]

            elif isinstance(geometry, MultiLineString):
                segments = geometry.geoms
            
            else:
                continue
            
            raw_tags = row["tags"]

            try:
                tags_dict = json.loads(raw_tags) if raw_tags else {}
            except Exception:
                tags_dict = {}
            
            sac = tags_dict.get("sac_scale")
            tv = tags_dict.get("trail_visibility")
            surface = tags_dict.get("surface")

            tags = {}
            if sac:
                tags["sac_scale"] = sac
            if tv:
                tags["trail_visibility"] = tv
            if surface:
                tags["surface"] = surface

            for segment in segments:
                coordinates = list(segment.coords)

                for i in range(len(coordinates) - 1):
                    p1 = self.round_point(coordinates[i])
                    p2 = self.round_point(coordinates[i+1])

                    distance_x = p2[0] - p1[0]
                    distance_y = p2[1] - p1[1]

                    distance = ((distance_x*distance_x) + (distance_y*distance_y))**0.5
                    
                    graph.add_node(p1)
                    graph.add_node(p2)
                    
                    
                    if graph.has_edge(p1, p2):
                        existing = graph[p1][p2]

                        # add distance
                        existing["length"] += distance

                        # merge tags (take worst)
                        if "sac_scale" in tags:
                            existing["sac_scale"] = max(existing.get("sac_scale", ""), tags["sac_scale"])

                        if "surface" in tags:
                            existing["surface"] = max(existing.get("surface", ""), tags["surface"])

                        if "trail_visibility" in tags:
                            existing["trail_visibility"] = max(existing.get("trail_visibility", ""), tags["trail_visibility"])

                    else:
                        graph.add_edge(p1, p2, length=distance, **tags)
                    
                    if graph.has_edge(p2, p1):
                        existing = graph[p2][p1]

                        # add distance
                        existing["length"] += distance

                        # merge tags (take worst)
                        if "sac_scale" in tags:
                            existing["sac_scale"] = max(existing.get("sac_scale", ""), tags["sac_scale"])

                        if "surface" in tags:
                            existing["surface"] = max(existing.get("surface", ""), tags["surface"])

                        if "trail_visibility" in tags:
                            existing["trail_visibility"] = max(existing.get("trail_visibility", ""), tags["trail_visibility"])

                    else:
                        graph.add_edge(p2, p1, length=distance, **tags)

        print(f"Graph built: {graph.number_of_nodes()} nodes, {graph.number_of_edges()} edges")
        return graph

    def save_graph(self, graph):
        with open(self.output_pickle_path, "wb") as file:
            pickle.dump(graph, file)
        print(f"Graph saved → {self.output_pickle_path.split('/')[-1]}")

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
