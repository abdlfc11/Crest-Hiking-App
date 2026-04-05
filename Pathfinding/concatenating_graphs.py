import pickle as p
import networkx as nx


with open("Pathfinding/wales_path_graph.pkl", "rb") as wales_file:
    wales_graph = p.load(wales_file)

with open("Pathfinding/better_path_graph.pkl", "rb") as cumbria_file:
    cumbria_graph = p.load(cumbria_file)

combined_graph = nx.DiGraph()

combined_graph.update(cumbria_graph)

combined_graph.update(wales_graph)

print(f"Combined graph has {combined_graph.number_of_edges()} edges and {combined_graph.number_of_nodes()} nodes")

with open("Pathfinding/better_path_graph.pkl", "wb") as file:
    p.dump(combined_graph, file)