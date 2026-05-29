# Data Preprocessing

Crestr’s routing engine is built on a preprocessed graph derived from OpenStreetMap (OSM) data. This document outlines the full preprocessing pipeline, the structure of the resulting graph, and the reasoning behind the design choices. The aim is to give contributors a clear understanding of how raw geographic data becomes the elevation‑aware, cost‑weighted graph used by the A* routing engine.

---

## Node and Edge Structure

The graph is stored as a directed NetworkX graph. Nodes and edges follow a minimal, performance‑oriented schema.

### Node Structure

Nodes are stored as coordinate tuples in British National Grid (EPSG:27700):

``` bash
Node : (x: float, y: float)

{
    'elev': float # elevation in metres
}
```

**Example:**

``` bash
Node : (340590.76, 481768.28)

{
    ‘elev’: 121.0
}
```

### Edge Structure (Before Elevation Enrichment)

Edges represent **directed segments** between nodes. During graph generation, edges may contain **raw OSM metadata** when available.

``` bash
Edge : ((x1: float, y1: float), (x2: float, y2: float))

{
    'length': [VALUE: float], 
    'cost': [VALUE: float], 
    'slope': [VALUE: float]
    }
```


These values are taken directly from OSM without transformation. Many edges will **not** contain these tags, as OSM coverage varies.

### Edge Structure (After Elevation Enrichment)

During elevation enrichment, raw tags are converted into numeric difficulty multipliers. The final graph used by the routing engine stores:

``` bash
Edge : ((x1: float, y1: float), (x2: float, y2: float))

{
    'length': [VALUE: float], 
    'cost': [VALUE: float], 
    'slope': [VALUE: float]
    }
```

**Example:**

``` bash
Edge : ((340590.76, 481768.28), (340610.26, 481735.76))

{
    ‘length’: 37.9183,
    ‘cost’: 39.0845,
    ‘slope’: 0.0527
}
```

---

## Preprocessing Pipeline Overview

The preprocessing workflow consists of three stages:

1. **Osmium Tag Extraction**  
   Ensures that relevant OSM metadata is preserved before parsing.

2. **Graph Generation**  
   Converts OSM geometries into a directed graph using [Pyrosm](https://pyrosm.readthedocs.io/en/latest/), [Shapely](https://shapely.readthedocs.io/en/stable/), and [NetworkX](https://networkx.org/en/).

3. **Elevation Enrichment**  
   Adds [NASA SRTM](https://www.earthdata.nasa.gov/data/instruments/srtm) elevation data, computes slope, and assigns cost values.

This pipeline produces a clean, lightweight graph optimised for hiking‑focused routing.

---

## Osmium Tag Extraction

Before parsing, the `.osm.pbf` file is passed through Osmium to ensure that metadata such as `sac_scale`, `trail_visibility`, and `surface` is retained.

Command:

```bash
osmium cat input.osm.pbf -o output.osm.pbf
```

These tags are used later to influence cost multipliers, allowing the routing engine to avoid paths that are unsafe or technically difficult.

---

## Graph Generation

Graph generation is handled by a Python script that uses:

- **Pyrosm** to extract highway geometries
- **Shapely** to process LineString and MultiLineString geometry
- **NetworkX** to construct the directed graph

Each OSM way is split into coordinate pairs. Coordinates are rounded to two decimal places to reduce node duplication while maintaining spatial accuracy.

### Node Creation

Each coordinate pair becomes a node. At this stage, nodes contain only their coordinates; elevation is added later.

### Edge Creation

For each pair of consecutive coordinates, a directed edge is created in both directions. Attributes include:

- length: Euclidean distance in metres
- raw OSM tags (if present): sac_scale, surface, trail_visibility

These tags remain as raw strings until elevation enrichment.

--- 

## Elevation Enrichment

A second script enriches the graph with elevation data from NASA SRTM tiles. This stage performs three tasks:

**1. Elevation Assignment**

Each node receives an elev attribute in metres.

**2. Slope Calculation**

For each edge:

```slope = (elevation difference) / length```   **(only if length > 0)**

**3. Cost Calculation**

A dictionary of difficulty multipliers maps raw OSM tag values to numeric weights.

The multiplier is applied to ascent or descent depending on elevation change.

The final cost is stored in the **cost attribute**.

After enrichment, edges contain only **length, slope, and cost**, as these are the values required by the routing engine.

---

## Output

The final output is a **directed, elevation‑aware NetworkX** graph with approximately:

- **1,000,000** nodes (for the Cumbria region)
- **2,000,000** directed edges
- **elevation**, **slope**, and **cost** attributes

This graph is cached on disk and loaded once at backend startup.

--- 

## Design Rationale

The preprocessing pipeline is designed to keep the runtime graph as lightweight as possible:

- Nodes store only **coordinates and elevatio**n**.
- Edges store only the **attributes required for routing**.
- Raw OSM tags are used only during cost calculation and are **not retained** afterward.
- The graph is **fully deterministic and reproducible** from the preprocessing scripts.

This structure ensures that A* remains **fast and memory‑efficient** even on large regional datasets.
